import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { query, withTransaction } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";

export const dispositionsRouter = Router();

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePriority(value) {
  const priority = normalizeText(value).toLowerCase();
  if (["biasa", "penting", "segera"].includes(priority)) return priority;
  if (priority === "normal" || priority === "rendah") return "biasa";
  if (priority === "tinggi") return "penting";
  return "biasa";
}

function normalizeStatusLabel(status) {
  const value = normalizeText(status).toLowerCase();
  if (value === "diterima") return "Diterima";
  if (value === "ditindaklanjuti") return "Ditindaklanjuti";
  if (value === "selesai") return "Selesai";
  return "Dikirim";
}

async function resolveIncomingLetter(client, body) {
  const incomingLetterId = normalizeText(body.incomingLetterId);
  const agendaNumber = normalizeText(body.agendaNumber);
  const params = [];
  const filters = ["incoming_letters.deleted_at IS NULL"];
  if (incomingLetterId) {
    params.push(incomingLetterId);
    filters.push(`incoming_letters.id = $${params.length}`);
  } else if (agendaNumber) {
    params.push(agendaNumber);
    filters.push(`incoming_letters.agenda_number = $${params.length}`);
  } else {
    return null;
  }

  const result = await client.query(
    `SELECT id, agenda_number, letter_number, sender, subject, forwarded_to, status
     FROM incoming_letters
     WHERE ${filters.join(" AND ")}
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

async function resolveTargetUser(client, body) {
  const targetUserId = normalizeText(body.targetUserId);
  if (targetUserId) {
    const result = await client.query(
      `SELECT users.id, users.full_name
       FROM users
       JOIN roles ON roles.id = users.role_id
       WHERE users.id = $1
         AND users.status = 'aktif'
         AND users.deleted_at IS NULL
         AND roles.code IN ('user', 'pegawai')`,
      [targetUserId]
    );
    return result.rows[0] || null;
  }

  const targetName = normalizeText(body.targetName);
  const result = await client.query(
    `SELECT users.id, users.full_name
     FROM users
     JOIN roles ON roles.id = users.role_id
     LEFT JOIN units ON units.id = users.unit_id
     WHERE users.status = 'aktif'
       AND users.deleted_at IS NULL
       AND roles.code IN ('user', 'pegawai')
     ORDER BY
       CASE
         WHEN lower(users.full_name) = lower($1) THEN 0
         WHEN lower(COALESCE(units.name, '')) = lower($1) THEN 1
         WHEN lower(COALESCE(users.position, '')) = lower($1) THEN 2
         ELSE 3
       END,
       users.created_at
     LIMIT 1`,
    [targetName]
  );
  return result.rows[0] || null;
}

function mapDisposition(row) {
  return {
    id: row.id,
    disposition_number: row.disposition_number,
    incoming_letter_id: row.incoming_letter_id,
    agenda_number: row.agenda_number,
    letter_number: row.letter_number,
    sender: row.sender,
    subject: row.subject,
    instruction: row.instruction,
    priority: row.priority,
    status: row.status,
    status_label: normalizeStatusLabel(row.status),
    due_date: row.due_date,
    sent_at: row.sent_at,
    giver_name: row.giver_name,
    target_user_name: row.target_user_name,
    document: row.document
  };
}

dispositionsRouter.get("/", requireAuth, requireRole("administrator", "operator", "pimpinan", "user"), async (request, response, next) => {
  try {
    const page = Math.max(Number(request.query.page || 1), 1);
    const perPage = Math.min(Math.max(Number(request.query.perPage || 10), 1), 100);
    const offset = (page - 1) * perPage;
    const params = [perPage, offset];
    let roleFilter = "";

    if (request.user.role_code === "user") {
      params.push(request.user.id);
      roleFilter = `AND dispositions.target_user_id = $${params.length}`;
    } else if (request.user.role_code === "pimpinan") {
      params.push(request.user.id);
      roleFilter = `AND dispositions.giver_id = $${params.length}`;
    }

    const result = await query(
      `SELECT dispositions.id, dispositions.disposition_number, dispositions.incoming_letter_id,
              dispositions.instruction, dispositions.priority, dispositions.status, dispositions.due_date,
              dispositions.sent_at,
              incoming_letters.agenda_number, incoming_letters.letter_number, incoming_letters.sender,
              incoming_letters.subject,
              giver.full_name AS giver_name,
              target.full_name AS target_user_name,
              CASE WHEN document.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', document.id,
                'original_name', document.original_name,
                'file_size_bytes', document.file_size_bytes,
                'mime_type', document.mime_type,
                'uploaded_at', document.uploaded_at,
                'download_path', '/incoming-letters/' || incoming_letters.id || '/documents/' || document.id || '/download'
              ) END AS document
       FROM dispositions
       JOIN incoming_letters ON incoming_letters.id = dispositions.incoming_letter_id
       JOIN users giver ON giver.id = dispositions.giver_id
       LEFT JOIN users target ON target.id = dispositions.target_user_id
       LEFT JOIN LATERAL (
         SELECT documents.id, documents.original_name, documents.file_size_bytes,
                documents.mime_type, documents.uploaded_at
         FROM documents
         WHERE documents.owner_type = 'incoming_letter'
           AND documents.owner_id = incoming_letters.id
           AND documents.deleted_at IS NULL
         ORDER BY documents.uploaded_at DESC
         LIMIT 1
       ) document ON true
       WHERE dispositions.deleted_at IS NULL
         ${roleFilter}
       ORDER BY dispositions.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    response.json({ data: result.rows.map(mapDisposition), meta: { page, perPage } });
  } catch (error) {
    next(error);
  }
});

dispositionsRouter.post("/", requireAuth, requireRole("administrator", "pimpinan"), async (request, response, next) => {
  try {
    const instruction = normalizeText(request.body.instruction);
    const errors = {};
    if (!instruction) errors.instruction = "Instruksi wajib diisi.";
    if (!normalizeText(request.body.incomingLetterId) && !normalizeText(request.body.agendaNumber)) errors.incomingLetterId = "Surat sumber wajib dipilih.";
    if (Object.keys(errors).length) return response.status(422).json({ message: "Validasi gagal.", errors });

    const created = await withTransaction(async (client) => {
      const incoming = await resolveIncomingLetter(client, request.body);
      if (!incoming) {
        const error = new Error("Surat masuk sumber disposisi tidak ditemukan.");
        error.status = 404;
        throw error;
      }

      if (request.user.role_code === "pimpinan" && incoming.forwarded_to && incoming.forwarded_to !== request.user.id) {
        const error = new Error("Anda tidak memiliki akses ke surat masuk ini.");
        error.status = 403;
        throw error;
      }

      const targetUser = await resolveTargetUser(client, request.body);
      if (!targetUser) {
        const error = new Error("User tujuan disposisi aktif belum tersedia.");
        error.status = 422;
        throw error;
      }

      const dispositionNumber = normalizeText(request.body.dispositionNumber) || `DSP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const result = await client.query(
        `INSERT INTO dispositions (
           disposition_number, incoming_letter_id, giver_id, target_user_id,
           instruction, due_date, priority, status
         )
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, $7, 'dikirim')
         RETURNING *`,
        [
          dispositionNumber,
          incoming.id,
          request.user.id,
          targetUser.id,
          instruction,
          normalizeText(request.body.dueDate),
          normalizePriority(request.body.priority)
        ]
      );
      const disposition = result.rows[0];

      await client.query(
        `UPDATE incoming_letters
         SET status = 'didisposisikan'
         WHERE id = $1
           AND deleted_at IS NULL`,
        [incoming.id]
      );

      await client.query(
        `INSERT INTO notifications (recipient_id, type, title, message, source_type, source_id)
         VALUES ($1, 'disposition_created', 'Disposisi baru diterima', $2, 'dispositions', $3)`,
        [targetUser.id, `${dispositionNumber} dari ${request.user.full_name}: ${instruction}`, disposition.id]
      );

      return { incoming, targetUser, disposition };
    });

    await writeAuditLog({
      userId: request.user.id,
      activity: "create_disposition",
      module: "dispositions",
      dataId: created.disposition.id,
      dataLabel: created.disposition.disposition_number,
      metadata: { incomingLetterId: created.incoming.id, targetUserId: created.targetUser.id },
      request
    });

    response.status(201).json({ data: mapDisposition({
      id: created.disposition.id,
      disposition_number: created.disposition.disposition_number,
      incoming_letter_id: created.disposition.incoming_letter_id,
      instruction: created.disposition.instruction,
      priority: created.disposition.priority,
      status: created.disposition.status,
      due_date: created.disposition.due_date,
      sent_at: created.disposition.sent_at,
      agenda_number: created.incoming.agenda_number,
      letter_number: created.incoming.letter_number,
      sender: created.incoming.sender,
      subject: created.incoming.subject,
      giver_name: request.user.full_name,
      target_user_name: created.targetUser.full_name
    }) });
  } catch (error) {
    if (error.code === "23505") return response.status(409).json({ message: "Nomor disposisi sudah digunakan." });
    next(error);
  }
});

dispositionsRouter.post("/:id/receive", requireAuth, requireRole("user"), async (request, response, next) => {
  try {
    const result = await query(
      `UPDATE dispositions
       SET status = 'diterima',
           received_at = COALESCE(received_at, now())
       WHERE id = $1
         AND target_user_id = $2
         AND status = 'dikirim'
         AND deleted_at IS NULL
       RETURNING id, disposition_number, status`,
      [request.params.id, request.user.id]
    );
    const disposition = result.rows[0];
    if (!disposition) return response.status(404).json({ message: "Disposisi tidak ditemukan atau sudah diterima." });

    await writeAuditLog({
      userId: request.user.id,
      activity: "receive_disposition",
      module: "dispositions",
      dataId: disposition.id,
      dataLabel: disposition.disposition_number,
      request
    });

    response.json({ data: disposition });
  } catch (error) {
    next(error);
  }
});
