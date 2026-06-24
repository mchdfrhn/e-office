import { Router } from "express";
import { exec } from "node:child_process";
import { stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { query, withTransaction } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";
import { config } from "../config.js";

export const backupsRouter = Router();

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const backupsStorageDir = path.resolve(currentDir, "..", "..", "storage", "backups");

const backupLimiterStore = new Map();
function backupRateLimiter(request, response, next) {
  const ip = request.ip;
  const now = Date.now();
  const limitWindow = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5; // max 5 requests per 15 minutes per IP

  const clientData = backupLimiterStore.get(ip) || { requests: [], blockedUntil: null };

  if (clientData.blockedUntil && clientData.blockedUntil > now) {
    const retryAfter = Math.ceil((clientData.blockedUntil - now) / 1000);
    return response.status(429).json({
      message: `Terlalu banyak permintaan. Silakan coba lagi setelah ${retryAfter} detik.`
    });
  }

  clientData.requests = clientData.requests.filter(timestamp => now - timestamp < limitWindow);

  if (clientData.requests.length >= maxRequests) {
    clientData.blockedUntil = now + limitWindow;
    backupLimiterStore.set(ip, clientData);
    return response.status(429).json({
      message: "Batas percobaan terlampaui. IP Anda diblokir sementara dari akses backup (15 menit)."
    });
  }

  clientData.requests.push(now);
  backupLimiterStore.set(ip, clientData);
  next();
}

// Promisified exec helper
function execPromise(cmd, env = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Format date to BKP-YYYY-MMDD-HHMM in Asia/Jakarta timezone
function generateBackupCode() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;
  const hour = parts.find(p => p.type === "hour").value;
  const minute = parts.find(p => p.type === "minute").value;
  return `BKP-${year}-${month}${day}-${hour}${minute}`;
}

backupsRouter.get("/", requireAuth, requireRole("administrator"), async (request, response, next) => {
  try {
    const page = Math.max(Number(request.query.page || 1), 1);
    const perPage = Math.min(Math.max(Number(request.query.perPage || 10), 1), 100);
    const offset = (page - 1) * perPage;

    // Get total count
    const countResult = await query("SELECT COUNT(*) FROM backups");
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT backups.id, backups.backup_code, backups.status, backups.file_size_bytes,
              backups.notes, backups.executed_at,
              users.full_name AS executor_name,
              documents.id AS document_id, documents.original_name, documents.stored_name
       FROM backups
       LEFT JOIN users ON users.id = backups.executed_by
       LEFT JOIN documents ON documents.id = backups.document_id
       ORDER BY backups.executed_at DESC
       LIMIT $1 OFFSET $2`,
      [perPage, offset]
    );

    response.json({
      data: result.rows,
      meta: {
        page,
        perPage,
        totalCount,
        totalPages: Math.ceil(totalCount / perPage)
      }
    });
  } catch (error) {
    next(error);
  }
});

backupsRouter.post("/", requireAuth, requireRole("administrator"), backupRateLimiter, async (request, response, next) => {
  const backupCode = generateBackupCode();
  const fileName = `${backupCode}.dump`;
  const relativePath = `storage/backups/${fileName}`;
  const absolutePath = path.join(backupsStorageDir, fileName);

  try {
    // Ensure backup directory exists
    await mkdir(backupsStorageDir, { recursive: true });

    // Construct pg_dump command
    // Use custom format (-F c) which is standard, compressed, and supports pg_restore
    const pgDumpCmd = `pg_dump -h "${config.db.host}" -p "${config.db.port}" -U "${config.db.user}" -d "${config.db.database}" -F c -b -v -f "${absolutePath}"`;
    
    // Execute pg_dump with PGPASSWORD env variable
    await execPromise(pgDumpCmd, { PGPASSWORD: config.db.password });

    // Verify backup file stats
    const fileStats = await stat(absolutePath);
    const fileSizeBytes = fileStats.size;

    // Save metadata in database with a transaction
    const backupRecord = await withTransaction(async (client) => {
      // 1. Insert into documents
      const storedName = `${crypto.randomUUID()}.dump`;
      const docResult = await client.query(
        `INSERT INTO documents (owner_type, owner_id, original_name, stored_name, storage_path, mime_type, file_extension, file_size_bytes, uploaded_by)
         VALUES ('backup', NULL, $1, $2, $3, 'application/octet-stream', 'dump', $4, $5)
         RETURNING id`,
        [fileName, storedName, relativePath, fileSizeBytes, request.user.id]
      );
      const documentId = docResult.rows[0].id;

      // 2. Insert into backups
      const backupResult = await client.query(
        `INSERT INTO backups (backup_code, document_id, status, file_size_bytes, notes, executed_by)
         VALUES ($1, $2, 'success', $3, 'Manual backup triggered by Administrator', $4)
         RETURNING id, backup_code, status, file_size_bytes, notes, executed_at`,
        [backupCode, documentId, fileSizeBytes, request.user.id]
      );

      // 3. Update document owner_id to link back to the backup record
      await client.query("UPDATE documents SET owner_id = $1 WHERE id = $2", [backupResult.rows[0].id, documentId]);

      return backupResult.rows[0];
    });

    // Write audit log
    await writeAuditLog({
      userId: request.user.id,
      activity: "backup_database",
      module: "backups",
      dataId: backupRecord.id,
      dataLabel: backupCode,
      request
    });

    response.status(201).json({
      message: "Backup database berhasil diselesaikan.",
      data: backupRecord
    });
  } catch (error) {
    console.error("Backup failed: ", error);
    
    // Log failure in backups table
    try {
      await query(
        `INSERT INTO backups (backup_code, status, notes, executed_by)
         VALUES ($1, 'failed', $2, $3)`,
        [backupCode, `Gagal: ${error.message}`, request.user.id]
      );

      await writeAuditLog({
        userId: request.user.id,
        activity: "backup_database_failed",
        module: "backups",
        metadata: { error: error.message },
        request
      });
    } catch (dbError) {
      console.error("Failed to log backup failure to database: ", dbError);
    }

    response.status(500).json({
      message: "Gagal memproses backup database.",
      error: error.message
    });
  }
});

backupsRouter.get("/:id/download", requireAuth, requireRole("administrator"), backupRateLimiter, async (request, response, next) => {
  try {
    const { id } = request.params;

    const result = await query(
      `SELECT backups.id, backups.backup_code, documents.original_name, documents.storage_path
       FROM backups
       JOIN documents ON documents.id = backups.document_id
       WHERE backups.id = $1 AND backups.status = 'success'`,
      [id]
    );

    const backup = result.rows[0];
    if (!backup) {
      return response.status(404).json({ message: "File backup tidak ditemukan atau status backup gagal." });
    }

    const absolutePath = path.resolve(currentDir, "..", "..", backup.storage_path);

    // Audit log before downloading
    await writeAuditLog({
      userId: request.user.id,
      activity: "download_backup",
      module: "backups",
      dataId: backup.id,
      dataLabel: backup.backup_code,
      request
    });

    response.download(absolutePath, backup.original_name);
  } catch (error) {
    next(error);
  }
});
