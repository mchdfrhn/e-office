import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import path from "path";
import { config } from "../config.js";
import { withTransaction } from "../db.js";

const allowedEmailAttachments = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"]
]);

function assertEmailConfigured(mode = "imap") {
  const target = mode === "smtp" ? config.email.smtp : config.email.imap;
  if (!config.email.enabled || !target.host || !target.user || !target.password) {
    const error = new Error("Sinkronisasi email belum dikonfigurasi. Isi EMAIL_* di file .env backend.");
    error.status = 503;
    throw error;
  }
}

function normalizeEmailProviderError(error) {
  if (error?.authenticationFailed) {
    const authError = new Error("Login email ditolak oleh server. Periksa password/app-password dan pastikan IMAP aktif untuk mailbox sekretariat.");
    authError.status = 401;
    return authError;
  }
  if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ETIMEOUT"].includes(error?.code)) {
    const connectionError = new Error(`Server email tidak dapat dijangkau (${error.code}). Periksa host, port, DNS, dan koneksi jaringan.`);
    connectionError.status = 503;
    return connectionError;
  }
  return error;
}

function normalizeAddressList(addresses) {
  return (addresses?.value || []).map((item) => item.address || item.name).filter(Boolean);
}

function textPreview(value, maxLength = 2000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildMessageId(parsed, fallback) {
  if (parsed.messageId) return parsed.messageId;
  return `<eoffice-${createHash("sha256").update(fallback).digest("hex")}@local>`;
}

function generatedAgendaNumber(uid) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const raw = String(uid || Date.now());
  const sequence = raw.replace(/\D/g, "").slice(-6) || createHash("sha256").update(raw).digest("hex").slice(0, 6).toUpperCase();
  return `EMAIL/${year}/${month}/${sequence.padStart(6, "0")}`;
}

function safeStoredName(value) {
  return String(value || "lampiran-email")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "lampiran-email";
}

function getAttachmentExtension(attachment) {
  const mimeExtension = allowedEmailAttachments.get(attachment.contentType);
  const filenameExtension = path.extname(attachment.filename || "").replace(".", "").toLowerCase();
  if (mimeExtension === "jpg" && filenameExtension === "jpeg") return "jpeg";
  return mimeExtension || filenameExtension;
}

function validateEmailAttachment(attachment) {
  const extension = getAttachmentExtension(attachment);
  const allowedExtensions = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
  if (!allowedEmailAttachments.has(attachment.contentType) || !allowedExtensions.includes(extension)) {
    return "Format lampiran email tidak didukung.";
  }
  if (!attachment.size || attachment.size > config.app.maxUploadSize) {
    return "Ukuran lampiran email melebihi batas 10 MB.";
  }
  return "";
}

async function saveIncomingEmailAttachments({ client, attachments, ownerId, userId, messageId }) {
  const uploadRoot = path.resolve(process.cwd(), "storage", "email-attachments");
  await mkdir(uploadRoot, { recursive: true });

  const savedAttachments = [];
  for (const attachment of attachments || []) {
    const validationError = validateEmailAttachment(attachment);
    if (validationError) {
      savedAttachments.push({
        filename: attachment.filename || "lampiran-email",
        contentType: attachment.contentType,
        size: attachment.size,
        skipped: true,
        reason: validationError
      });
      continue;
    }

    const extension = getAttachmentExtension(attachment);
    const checksum = createHash("sha256").update(attachment.content).digest("hex");
    const storedName = `${Date.now()}-${checksum.slice(0, 12)}-${safeStoredName(attachment.filename)}.${extension}`;
    const storagePath = path.join(uploadRoot, storedName);
    await writeFile(storagePath, attachment.content);

    const documentResult = await client.query(
      `INSERT INTO documents (
         owner_type, owner_id, original_name, stored_name, storage_path, mime_type,
         file_extension, file_size_bytes, checksum_sha256, previewable, uploaded_by
       )
       VALUES ('incoming_letter', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        ownerId,
        attachment.filename || storedName,
        storedName,
        storagePath,
        attachment.contentType,
        extension,
        attachment.size,
        checksum,
        ["application/pdf", "image/jpeg", "image/png"].includes(attachment.contentType),
        userId
      ]
    );

    savedAttachments.push({
      filename: attachment.filename || storedName,
      contentType: attachment.contentType,
      size: attachment.size,
      documentId: documentResult.rows[0].id,
      checksum,
      messageId
    });
  }

  return savedAttachments;
}

async function getDefaultLetterMetadata(client) {
  const typeResult = await client.query(
    `SELECT id FROM letter_types
     WHERE lower(name) IN ('surat lainnya', 'lainnya')
     ORDER BY name
     LIMIT 1`
  );
  const natureResult = await client.query(
    `SELECT id FROM letter_natures
     WHERE code = 'biasa'
     LIMIT 1`
  );
  if (!typeResult.rows[0] || !natureResult.rows[0]) {
    const error = new Error("Master jenis/sifat surat belum tersedia. Jalankan seed database terlebih dahulu.");
    error.status = 422;
    throw error;
  }
  return {
    letterTypeId: typeResult.rows[0].id,
    letterNatureId: natureResult.rows[0].id
  };
}

async function storeIncomingEmail({ parsed, uid, rawSource, userId, mailbox }) {
  const messageId = buildMessageId(parsed, rawSource);
  return withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT id, related_id FROM email_messages WHERE direction = 'incoming' AND message_id = $1",
      [messageId]
    );
    if (existing.rows[0]) {
      return { skipped: true, emailMessageId: existing.rows[0].id, incomingLetterId: existing.rows[0].related_id };
    }

    const subject = String(parsed.subject || "(Tanpa subjek)").slice(0, 255);
    const sender = parsed.from?.text || normalizeAddressList(parsed.from)[0] || "Pengirim eksternal";
    const attachments = await saveIncomingEmailAttachments({
      client,
      attachments: parsed.attachments,
      ownerId: null,
      userId,
      messageId
    });

    const emailResult = await client.query(
      `INSERT INTO email_messages (
         direction, message_id, mailbox, sender, recipients, cc, subject, text_body, html_body,
         attachment_metadata, related_module, related_id, provider_metadata, received_at, synced_by,
         process_status
       )
       VALUES ('incoming', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'incoming_letters', NULL, $10, $11, $12, 'belum_diproses')
       RETURNING id`,
      [
        messageId,
        mailbox,
        sender,
        normalizeAddressList(parsed.to),
        normalizeAddressList(parsed.cc),
        subject,
        parsed.text || null,
        parsed.html || null,
        JSON.stringify(attachments),
        JSON.stringify({ uid }),
        parsed.date || new Date(),
        userId
      ]
    );
    await notifyOperatorsForIncomingEmail(client, {
      emailId: emailResult.rows[0].id,
      subject,
      sender
    });

    return {
      skipped: false,
      emailMessageId: emailResult.rows[0].id,
      incomingLetterId: null,
      subject,
      sender
    };
  });
}

async function notifyOperatorsForIncomingEmail(client, { emailId, subject, sender }) {
  const operators = await client.query(
    `SELECT users.id
     FROM users
     JOIN roles ON roles.id = users.role_id
     WHERE roles.code = 'operator'
       AND users.status = 'aktif'
       AND users.deleted_at IS NULL`
  );

  for (const operator of operators.rows) {
    await client.query(
      `INSERT INTO notifications (recipient_id, type, title, message, source_type, source_id)
       VALUES ($1, 'generic', $2, $3, 'email_messages', $4)`,
      [
        operator.id,
        "Email surat masuk baru",
        `${sender || "Pengirim eksternal"} mengirim email: ${subject || "(Tanpa subjek)"}`,
        emailId
      ]
    );
  }
}

export async function processIncomingEmailAsLetter({ emailId, userId }) {
  return withTransaction(async (client) => {
    const emailResult = await client.query(
      `SELECT id, message_id, sender, subject, text_body, html_body, attachment_metadata,
              received_at, related_id, process_status, provider_metadata
       FROM email_messages
       WHERE id = $1 AND direction = 'incoming'
       FOR UPDATE`,
      [emailId]
    );
    const email = emailResult.rows[0];
    if (!email) {
      const error = new Error("Email masuk tidak ditemukan.");
      error.status = 404;
      throw error;
    }
    if (email.process_status === "sudah_diproses" || email.related_id) {
      const error = new Error("Email ini sudah pernah diproses menjadi surat masuk.");
      error.status = 409;
      throw error;
    }

    const { letterTypeId, letterNatureId } = await getDefaultLetterMetadata(client);
    const receivedAt = email.received_at || new Date();
    const letterNumber = String(email.message_id || `EMAIL-${email.id}`).slice(0, 100);
    const incomingResult = await client.query(
      `INSERT INTO incoming_letters (
         agenda_number, letter_number, letter_date, received_date, sender, subject,
         letter_type_id, letter_nature_id, summary, status, registered_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'diregistrasi', $10)
       RETURNING id, agenda_number, letter_number, status`,
      [
        generatedAgendaNumber(email.id),
        letterNumber,
        receivedAt,
        receivedAt,
        String(email.sender || "Pengirim eksternal").slice(0, 255),
        String(email.subject || "(Tanpa subjek)").slice(0, 255),
        letterTypeId,
        letterNatureId,
        textPreview(email.text_body || email.html_body),
        userId
      ]
    );
    const incoming = incomingResult.rows[0];
    const attachments = Array.isArray(email.attachment_metadata) ? email.attachment_metadata : [];
    const documentIds = attachments.map((attachment) => attachment.documentId).filter(Boolean);

    if (documentIds.length > 0) {
      await client.query(
        `UPDATE documents
         SET owner_type = 'incoming_letter', owner_id = $1
         WHERE id = ANY($2::uuid[])`,
        [incoming.id, documentIds]
      );
    }

    await client.query(
      `UPDATE email_messages
       SET related_id = $1,
           process_status = 'sudah_diproses',
           processed_at = now(),
           processed_by = $2,
           processing_error = NULL
       WHERE id = $3`,
      [incoming.id, userId, email.id]
    );

    await client.query(
      `INSERT INTO notifications (recipient_id, type, title, message, source_type, source_id)
       VALUES ($1, 'generic', 'Email diproses sebagai surat masuk', $2, 'incoming_letters', $3)`,
      [userId, `${incoming.agenda_number} dibuat dari email ${email.subject}.`, incoming.id]
    );

    return {
      emailMessageId: email.id,
      incomingLetter: incoming,
      attachmentsProcessed: documentIds.length
    };
  });
}

export async function syncIncomingEmails({ userId }) {
  assertEmailConfigured("imap");

  const client = new ImapFlow({
    host: config.email.imap.host,
    port: config.email.imap.port,
    secure: config.email.imap.secure,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      family: 4,
      servername: config.email.imap.host
    },
    auth: {
      user: config.email.imap.user,
      pass: config.email.imap.password
    }
  });

  const since = new Date(Date.now() - config.email.syncSinceDays * 24 * 60 * 60 * 1000);
  const synced = [];
  const skipped = [];

  let lock;
  try {
    await client.connect();
    lock = await client.getMailboxLock(config.email.imap.mailbox);
    const uids = await client.search({ since });
    const latestUids = uids.slice(-config.email.syncLimit);
    if (latestUids.length === 0) {
      return { synced, skipped, meta: { mailbox: config.email.imap.mailbox, since, limit: config.email.syncLimit } };
    }

    for await (const message of client.fetch(latestUids, { source: true, envelope: true, uid: true })) {
      const raw = message.source;
      const parsed = await simpleParser(raw);
      const result = await storeIncomingEmail({
        parsed,
        uid: message.uid,
        rawSource: raw.toString("utf8"),
        userId,
        mailbox: config.email.imap.mailbox
      });
      if (result.skipped) skipped.push(result);
      else synced.push(result);
    }
  } catch (error) {
    throw normalizeEmailProviderError(error);
  } finally {
    if (lock) lock.release();
    try {
      await client.logout();
    } catch {
      // The connection may not be authenticated yet; nothing else to clean up.
    }
  }

  return { synced, skipped, meta: { mailbox: config.email.imap.mailbox, since, limit: config.email.syncLimit } };
}

export async function sendOutgoingEmail({ userId, to, cc = [], subject, text, html = "", letterNumber = "" }) {
  assertEmailConfigured("smtp");
  if (!to || !subject || !text) {
    const error = new Error("Tujuan email, subjek, dan isi pesan wajib diisi.");
    error.status = 422;
    throw error;
  }

  const transport = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.secure,
    auth: {
      user: config.email.smtp.user,
      pass: config.email.smtp.password
    }
  });

  const recipients = Array.isArray(to) ? to : [to];
  const ccRecipients = Array.isArray(cc) ? cc : String(cc || "").split(",").map((item) => item.trim()).filter(Boolean);
  const info = await transport.sendMail({
    from: `"${config.email.fromName}" <${config.email.address}>`,
    to: recipients,
    cc: ccRecipients,
    subject,
    text,
    html: html || undefined
  });

  const saved = await withTransaction(async (client) => {
    const outgoingResult = await client.query(
      `INSERT INTO outgoing_letters (
         letter_number, letter_date, destination, subject, summary, status,
         created_by, sent_method, sent_reference, sent_at
       )
       VALUES ($1, CURRENT_DATE, $2, $3, $4, 'dikirim', $5, 'email', $6, now())
       RETURNING id, letter_number`,
      [
        letterNumber || `EMAIL-OUT-${Date.now()}`,
        recipients.join(", "),
        subject,
        textPreview(text),
        userId,
        info.messageId
      ]
    );
    const outgoing = outgoingResult.rows[0];
    const emailResult = await client.query(
      `INSERT INTO email_messages (
         direction, message_id, sender, recipients, cc, subject, text_body, html_body,
         related_module, related_id, provider_metadata, sent_at, synced_by
       )
       VALUES ('outgoing', $1, $2, $3, $4, $5, $6, $7, 'outgoing_letters', $8, $9, now(), $10)
       RETURNING id`,
      [
        info.messageId,
        config.email.address,
        recipients,
        ccRecipients,
        subject,
        text,
        html || null,
        outgoing.id,
        JSON.stringify({ accepted: info.accepted, rejected: info.rejected, response: info.response }),
        userId
      ]
    );
    return { outgoingLetter: outgoing, emailMessageId: emailResult.rows[0].id, provider: info };
  });

  return saved;
}
