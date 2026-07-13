import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { query, withTransaction } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";
import { config } from "../config.js";

export const incomingLettersRouter = Router();

function normalizeText(value) {
  return String(value || "").trim();
}

function safeStoredName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "surat-masuk.pdf";
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(normalizeText(dataUrl));
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function validateIncomingPayload(body = {}) {
  const errors = {};
  if (!normalizeText(body.letterNumber)) errors.letterNumber = "Nomor surat wajib diisi.";
  if (!normalizeText(body.letterDate)) errors.letterDate = "Tanggal surat wajib diisi.";
  if (!normalizeText(body.receivedDate)) errors.receivedDate = "Tanggal terima wajib diisi.";
  if (!normalizeText(body.sender)) errors.sender = "Pengirim wajib diisi.";
  if (!normalizeText(body.subject)) errors.subject = "Perihal wajib diisi.";
  return errors;
}

async function getDefaultLetterTypeId(client) {
  const result = await client.query(
    "SELECT id FROM letter_types WHERE is_active = true ORDER BY CASE WHEN name = 'Surat Lainnya' THEN 0 ELSE 1 END, name LIMIT 1"
  );
  return result.rows[0]?.id || null;
}

async function getDefaultLetterNatureId(client) {
  const result = await client.query(
    "SELECT id FROM letter_natures WHERE is_active = true ORDER BY CASE WHEN code = 'biasa' THEN 0 ELSE 1 END, name LIMIT 1"
  );
  return result.rows[0]?.id || null;
}

async function getActiveLeaders(client) {
  const result = await client.query(
    `SELECT users.id, users.full_name
     FROM users
     JOIN roles ON roles.id = users.role_id
     WHERE roles.code = 'pimpinan'
       AND users.status = 'aktif'
       AND users.deleted_at IS NULL
     ORDER BY users.created_at
     LIMIT 10`
  );
  return result.rows;
}

async function saveIncomingDocument({ client, incomingId, document, userId }) {
  if (!document?.dataUrl) return null;
  const parsed = parseDataUrl(document.dataUrl);
  const originalName = normalizeText(document.name) || "surat-masuk.pdf";
  const extension = path.extname(originalName).replace(".", "").toLowerCase();
  const mimeType = normalizeText(document.type) || parsed?.mimeType || "";
  if (!parsed || extension !== "pdf" || mimeType !== "application/pdf") {
    const error = new Error("Dokumen surat masuk harus berupa PDF.");
    error.status = 422;
    throw error;
  }
  if (!parsed.buffer.length || parsed.buffer.length > config.app.maxUploadSize) {
    const error = new Error("Ukuran dokumen surat masuk maksimal 10 MB.");
    error.status = 422;
    throw error;
  }

  const uploadRoot = path.resolve(process.cwd(), "storage", "incoming-letters");
  await mkdir(uploadRoot, { recursive: true });
  const checksum = createHash("sha256").update(parsed.buffer).digest("hex");
  const storedName = `${Date.now()}-${checksum.slice(0, 12)}-${safeStoredName(originalName)}`;
  const storagePath = path.join(uploadRoot, storedName);
  await writeFile(storagePath, parsed.buffer);

  const result = await client.query(
    `INSERT INTO documents (
       owner_type, owner_id, original_name, stored_name, storage_path, mime_type,
       file_extension, file_size_bytes, checksum_sha256, previewable, uploaded_by
     )
     VALUES ('incoming_letter', $1, $2, $3, $4, $5, 'pdf', $6, $7, true, $8)
     RETURNING id, original_name, file_size_bytes`,
    [incomingId, originalName, storedName, storagePath, "application/pdf", parsed.buffer.length, checksum, userId]
  );
  return result.rows[0];
}

incomingLettersRouter.get("/", requireAuth, requireRole("administrator", "operator", "pimpinan"), async (request, response, next) => {
  try {
    const page = Math.max(Number(request.query.page || 1), 1);
    const perPage = Math.min(Math.max(Number(request.query.perPage || 10), 1), 100);
    const offset = (page - 1) * perPage;
    const params = [perPage, offset];
    const roleFilter = request.user.role_code === "pimpinan" ? "AND incoming_letters.forwarded_to = $3" : "";
    if (request.user.role_code === "pimpinan") params.push(request.user.id);

    const result = await query(
      `SELECT incoming_letters.id, agenda_number, letter_number, letter_date, received_date,
              sender, subject, summary, incoming_letters.status AS status, forwarded_at,
              leader.full_name AS forwarded_to_name,
              registrar.full_name AS registered_by_name,
              CASE WHEN document.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', document.id,
                'original_name', document.original_name,
                'file_size_bytes', document.file_size_bytes,
                'mime_type', document.mime_type,
                'previewable', document.previewable,
                'uploaded_at', document.created_at,
                'download_path', '/incoming-letters/' || incoming_letters.id || '/documents/' || document.id || '/download'
              ) END AS document
       FROM incoming_letters
       JOIN users registrar ON registrar.id = incoming_letters.registered_by
       LEFT JOIN users leader ON leader.id = incoming_letters.forwarded_to
       LEFT JOIN LATERAL (
         SELECT id, original_name, file_size_bytes, mime_type, previewable,
                documents.uploaded_at AS created_at
         FROM documents
         WHERE owner_type = 'incoming_letter'
           AND owner_id = incoming_letters.id
           AND deleted_at IS NULL
         ORDER BY documents.uploaded_at DESC
         LIMIT 1
       ) document ON true
       WHERE incoming_letters.deleted_at IS NULL
       ${roleFilter}
       ORDER BY incoming_letters.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    response.json({ data: result.rows, meta: { page, perPage } });
  } catch (error) {
    next(error);
  }
});

incomingLettersRouter.post("/", requireAuth, requireRole("administrator", "operator"), async (request, response, next) => {
  try {
    const errors = validateIncomingPayload(request.body);
    if (Object.keys(errors).length > 0) {
      return response.status(422).json({ message: "Validasi gagal.", errors });
    }

    const created = await withTransaction(async (client) => {
      const letterTypeId = normalizeText(request.body.letterTypeId) || await getDefaultLetterTypeId(client);
      const letterNatureId = normalizeText(request.body.letterNatureId) || await getDefaultLetterNatureId(client);
      if (!letterTypeId || !letterNatureId) {
        const error = new Error("Master jenis atau sifat surat belum tersedia.");
        error.status = 422;
        throw error;
      }

      const agendaNumber = normalizeText(request.body.agendaNumber) || `AG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const summaryParts = [
        normalizeText(request.body.summary),
        normalizeText(request.body.followUp) ? `Proses: ${normalizeText(request.body.followUp)}` : "",
        normalizeText(request.body.followUpTo) ? `Tujuan tindak lanjut: ${normalizeText(request.body.followUpTo)}` : "",
        Array.isArray(request.body.recipients) && request.body.recipients.length ? `Kepada: ${request.body.recipients.join(", ")}` : "",
        Array.isArray(request.body.instructions) && request.body.instructions.length ? `Instruksi: ${request.body.instructions.join(", ")}` : ""
      ].filter(Boolean);

      const result = await client.query(
        `INSERT INTO incoming_letters (
           agenda_number, letter_number, letter_date, received_date, sender, subject,
           letter_type_id, letter_nature_id, summary, status, registered_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), 'diregistrasi', $10)
         RETURNING *`,
        [
          agendaNumber,
          normalizeText(request.body.letterNumber),
          normalizeText(request.body.letterDate),
          normalizeText(request.body.receivedDate),
          normalizeText(request.body.sender),
          normalizeText(request.body.subject),
          letterTypeId,
          letterNatureId,
          summaryParts.join("\n"),
          request.user.id
        ]
      );
      const incoming = result.rows[0];
      const document = await saveIncomingDocument({
        client,
        incomingId: incoming.id,
        document: request.body.document,
        userId: request.user.id
      });
      return { incoming, document };
    });

    await writeAuditLog({
      userId: request.user.id,
      activity: "create_incoming_letter",
      module: "incoming_letters",
      dataId: created.incoming.id,
      dataLabel: created.incoming.agenda_number,
      metadata: { documentId: created.document?.id || null },
      request
    });
    if (created.document) {
      await writeAuditLog({
        userId: request.user.id,
        activity: "upload_incoming_letter_document",
        module: "incoming_letters",
        dataId: created.incoming.id,
        dataLabel: created.document.original_name,
        metadata: { documentId: created.document.id, size: created.document.file_size_bytes },
        request
      });
    }

    response.status(201).json({ data: { ...created.incoming, document: created.document } });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({ message: "Nomor agenda sudah digunakan." });
    }
    next(error);
  }
});

incomingLettersRouter.get("/:id/documents/:documentId/download", requireAuth, requireRole("administrator", "operator", "pimpinan"), async (request, response, next) => {
  try {
    const roleFilter = request.user.role_code === "pimpinan" ? "AND incoming_letters.forwarded_to = $3" : "";
    const params = [request.params.id, request.params.documentId];
    if (request.user.role_code === "pimpinan") params.push(request.user.id);

    const result = await query(
      `SELECT incoming_letters.id AS incoming_id,
              incoming_letters.agenda_number,
              documents.id AS document_id,
              documents.original_name,
              documents.storage_path,
              documents.mime_type
       FROM incoming_letters
       JOIN documents ON documents.owner_type = 'incoming_letter'
        AND documents.owner_id = incoming_letters.id
       WHERE incoming_letters.id = $1
         AND documents.id = $2
         AND incoming_letters.deleted_at IS NULL
         AND documents.deleted_at IS NULL
         ${roleFilter}`,
      params
    );
    const document = result.rows[0];
    if (!document) return response.status(404).json({ message: "Dokumen surat masuk tidak ditemukan atau tidak dapat diakses." });

    await writeAuditLog({
      userId: request.user.id,
      activity: "download_incoming_letter_document",
      module: "incoming_letters",
      dataId: document.incoming_id,
      dataLabel: document.original_name,
      metadata: { documentId: document.document_id, agendaNumber: document.agenda_number },
      request
    });

    response.type(document.mime_type || "application/octet-stream");
    response.download(document.storage_path, document.original_name, (error) => {
      if (error && !response.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});

incomingLettersRouter.post("/:id/forward", requireAuth, requireRole("administrator", "operator"), async (request, response, next) => {
  try {
    const forwarded = await withTransaction(async (client) => {
      const leaders = await getActiveLeaders(client);
      const leader = leaders[0];
      if (!leader) {
        const error = new Error("User pimpinan aktif belum tersedia.");
        error.status = 422;
        throw error;
      }

      const updateResult = await client.query(
        `UPDATE incoming_letters
         SET status = 'diteruskan',
             forwarded_to = $2,
             forwarded_by = $3,
             forwarded_at = COALESCE(forwarded_at, now())
         WHERE id = $1
           AND deleted_at IS NULL
           AND status = 'diregistrasi'
         RETURNING *`,
        [request.params.id, leader.id, request.user.id]
      );
      const incoming = updateResult.rows[0];
      if (!incoming) {
        const error = new Error("Surat masuk tidak ditemukan atau sudah diteruskan.");
        error.status = 404;
        throw error;
      }

      await client.query(
        `INSERT INTO notifications (recipient_id, type, title, message, source_type, source_id)
         VALUES ($1, 'incoming_letter_forwarded', 'Surat masuk diteruskan', $2, 'incoming_letters', $3)`,
        [leader.id, `${incoming.agenda_number} dari ${incoming.sender} menunggu review pimpinan.`, incoming.id]
      );
      return { incoming, leader };
    });

    await writeAuditLog({
      userId: request.user.id,
      activity: "forward_incoming_letter",
      module: "incoming_letters",
      dataId: forwarded.incoming.id,
      dataLabel: forwarded.incoming.agenda_number,
      metadata: { forwardedTo: forwarded.leader.id, leaderTargets: request.body?.leaderTargets || [] },
      request
    });

    response.json({ data: forwarded.incoming });
  } catch (error) {
    next(error);
  }
});
