import { Router } from "express";
import { config } from "../config.js";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { processIncomingEmailAsLetter, syncIncomingEmails, sendOutgoingEmail } from "../services/email-sync.js";
import { writeAuditLog } from "../utils/audit.js";

export const emailRouter = Router();

emailRouter.get("/config", requireAuth, requireRole("administrator", "operator"), (request, response) => {
  response.json({
    data: {
      enabled: config.email.enabled,
      address: config.email.address,
      protocol: config.email.protocol,
      imapHost: config.email.imap.host || null,
      smtpHost: config.email.smtp.host || null,
      mailbox: config.email.imap.mailbox,
      syncLimit: config.email.syncLimit,
      syncSinceDays: config.email.syncSinceDays
    }
  });
});

function mapProcessStatus(value) {
  return value === "sudah_diproses" ? "Sudah Diproses" : "Belum Diproses";
}

emailRouter.get("/incoming", requireAuth, requireRole("administrator", "operator", "pimpinan"), async (request, response, next) => {
  try {
    const { sender = "", subject = "", status = "", dateFrom = "", dateTo = "" } = request.query;
    const params = [];
    const conditions = ["em.direction = 'incoming'"];

    if (sender) {
      params.push(`%${String(sender).toLowerCase()}%`);
      conditions.push(`lower(em.sender) LIKE $${params.length}`);
    }
    if (subject) {
      params.push(`%${String(subject).toLowerCase()}%`);
      conditions.push(`lower(em.subject) LIKE $${params.length}`);
    }
    if (status && ["belum_diproses", "sudah_diproses"].includes(status)) {
      params.push(status);
      conditions.push(`em.process_status = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`COALESCE(em.received_at, em.created_at)::date >= $${params.length}::date`);
    }
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`COALESCE(em.received_at, em.created_at)::date <= $${params.length}::date`);
    }

    const result = await query(
      `SELECT
         em.id,
         em.sender,
         em.subject,
         em.attachment_metadata,
         em.process_status,
         em.processed_at,
         em.received_at,
         em.created_at,
         il.agenda_number,
         il.letter_number,
         il.status
       FROM email_messages em
       LEFT JOIN incoming_letters il ON il.id = em.related_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY COALESCE(em.received_at, em.created_at) DESC
       LIMIT 100`,
      params
    );
    response.json({
      data: result.rows.map((row) => ({
        id: row.id,
        agenda: row.agenda_number,
        letterNumber: row.letter_number,
        sender: row.sender,
        subject: row.subject,
        status: mapProcessStatus(row.process_status),
        processStatus: row.process_status,
        incomingLetterStatus: row.status,
        processedAt: row.processed_at,
        receivedAt: row.received_at || row.created_at,
        attachments: row.attachment_metadata || []
      }))
    });
  } catch (error) {
    next(error);
  }
});

emailRouter.get("/incoming/:id", requireAuth, requireRole("administrator", "operator", "pimpinan"), async (request, response, next) => {
  try {
    const result = await query(
      `SELECT em.id, em.message_id, em.mailbox, em.sender, em.recipients, em.cc, em.subject,
              em.text_body, em.html_body, em.attachment_metadata, em.process_status,
              em.processed_at, em.received_at, em.created_at, em.related_id,
              il.agenda_number, il.letter_number, il.status AS incoming_letter_status
       FROM email_messages em
       LEFT JOIN incoming_letters il ON il.id = em.related_id
       WHERE em.id = $1 AND em.direction = 'incoming'`,
      [request.params.id]
    );
    const row = result.rows[0];
    if (!row) return response.status(404).json({ message: "Email masuk tidak ditemukan." });

    response.json({
      data: {
        id: row.id,
        messageId: row.message_id,
        mailbox: row.mailbox,
        sender: row.sender,
        recipients: row.recipients,
        cc: row.cc,
        subject: row.subject,
        textBody: row.text_body,
        htmlBody: row.html_body,
        attachments: row.attachment_metadata || [],
        status: mapProcessStatus(row.process_status),
        processStatus: row.process_status,
        processedAt: row.processed_at,
        receivedAt: row.received_at || row.created_at,
        incomingLetter: row.related_id
          ? {
              id: row.related_id,
              agenda: row.agenda_number,
              letterNumber: row.letter_number,
              status: row.incoming_letter_status
            }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
});

emailRouter.post("/incoming/:id/process", requireAuth, requireRole("administrator", "operator"), async (request, response, next) => {
  try {
    const result = await processIncomingEmailAsLetter({
      emailId: request.params.id,
      userId: request.user.id
    });
    await writeAuditLog({
      userId: request.user.id,
      activity: "process_incoming_email_as_letter",
      module: "incoming_letters",
      dataId: result.incomingLetter.id,
      dataLabel: result.incomingLetter.agenda_number,
      metadata: {
        emailMessageId: result.emailMessageId,
        attachmentsProcessed: result.attachmentsProcessed
      },
      request
    });
    response.status(201).json({
      message: "Email berhasil diproses sebagai surat masuk.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

emailRouter.get("/incoming/:emailId/attachments/:documentId/download", requireAuth, requireRole("administrator", "operator", "pimpinan"), async (request, response, next) => {
  try {
    const result = await query(
      `SELECT d.id, d.original_name, d.storage_path, d.mime_type
       FROM email_messages em
       CROSS JOIN LATERAL jsonb_array_elements(em.attachment_metadata) AS attachment
       JOIN documents d ON d.id = (attachment ->> 'documentId')::uuid
       WHERE em.id = $1
         AND em.direction = 'incoming'
         AND d.id = $2
         AND d.deleted_at IS NULL`,
      [request.params.emailId, request.params.documentId]
    );
    const document = result.rows[0];
    if (!document) return response.status(404).json({ message: "Lampiran email tidak ditemukan." });

    await writeAuditLog({
      userId: request.user.id,
      activity: "download_incoming_email_attachment",
      module: "incoming_letters",
      dataId: request.params.emailId,
      dataLabel: document.original_name,
      request
    });

    response.download(document.storage_path, document.original_name, (error) => {
      if (error && !response.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});

emailRouter.post("/sync-incoming", requireAuth, requireRole("administrator", "operator"), async (request, response, next) => {
  try {
    const result = await syncIncomingEmails({ userId: request.user.id });
    await writeAuditLog({
      userId: request.user.id,
      activity: "sync_incoming_email",
      module: "incoming_letters",
      dataLabel: config.email.address,
      metadata: {
        synced: result.synced.length,
        skipped: result.skipped.length,
        mailbox: result.meta.mailbox
      },
      request
    });
    response.json({
      message: "Sinkronisasi email masuk selesai.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

emailRouter.post("/send-outgoing", requireAuth, requireRole("administrator", "operator"), async (request, response, next) => {
  try {
    const payload = request.body || {};
    const result = await sendOutgoingEmail({
      userId: request.user.id,
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      text: payload.text || payload.body,
      html: payload.html,
      letterNumber: payload.letterNumber
    });
    await writeAuditLog({
      userId: request.user.id,
      activity: "send_outgoing_email",
      module: "outgoing_letters",
      dataId: result.outgoingLetter.id,
      dataLabel: result.outgoingLetter.letter_number,
      metadata: {
        emailMessageId: result.emailMessageId,
        accepted: result.provider.accepted,
        rejected: result.provider.rejected
      },
      request
    });
    response.status(201).json({
      message: "Surat keluar berhasil dikirim melalui email.",
      data: {
        outgoingLetter: result.outgoingLetter,
        emailMessageId: result.emailMessageId
      }
    });
  } catch (error) {
    next(error);
  }
});
