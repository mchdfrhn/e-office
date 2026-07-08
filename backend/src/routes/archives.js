import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { query, withTransaction } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";

export const archivesRouter = Router();

// GET /api/archives
archivesRouter.get("/", requireAuth, requireRole("administrator"), async (request, response, next) => {
  try {
    const pageParam = typeof request.query.page === "string" ? request.query.page : "1";
    const perPageParam = typeof request.query.perPage === "string" ? request.query.perPage : "20";
    const searchParam = typeof request.query.search === "string" ? request.query.search : "";
    const sourceTypeParam = typeof request.query.source_type === "string" ? request.query.source_type : "";

    const page = Math.max(Number(pageParam || 1), 1);
    const perPage = Math.min(Math.max(Number(perPageParam || 20), 1), 100);
    const offset = (page - 1) * perPage;

    const dbSearchPattern = searchParam ? `%${searchParam}%` : "";

    const countResult = await query(
      `SELECT COUNT(*) 
       FROM archives
       WHERE ($1 = '' OR source_type = $1::archive_source_type)
         AND ($2 = '' OR archive_number ILIKE $2 OR subject ILIKE $2 OR status ILIKE $2)`,
      [sourceTypeParam, dbSearchPattern]
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT id, archive_number, source_type, source_id, subject, status, archived_at
       FROM archives
       WHERE ($1 = '' OR source_type = $1::archive_source_type)
         AND ($2 = '' OR archive_number ILIKE $2 OR subject ILIKE $2 OR status ILIKE $2)
       ORDER BY archived_at DESC
       LIMIT $3 OFFSET $4`,
      [sourceTypeParam, dbSearchPattern, perPage, offset]
    );

    // Get aggregate counts for the summary cards
    const summaryResult = await query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN source_type = 'letter_request' THEN 1 END) as ajuan_count,
        COUNT(CASE WHEN source_type = 'incoming_letter' THEN 1 END) as incoming_count,
        COUNT(CASE WHEN source_type = 'disposition' THEN 1 END) as disposition_count
      FROM archives
    `);
    const summary = summaryResult.rows[0];

    response.json({
      data: result.rows,
      total: totalCount,
      page,
      perPage,
      summary: {
        total: parseInt(summary.total_count || 0, 10),
        ajuan: parseInt(summary.ajuan_count || 0, 10),
        incoming: parseInt(summary.incoming_count || 0, 10),
        disposition: parseInt(summary.disposition_count || 0, 10)
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/archives/sync
archivesRouter.post("/sync", requireAuth, requireRole("administrator"), async (request, response, next) => {
  try {
    let count = 0;
    await withTransaction(async (client) => {
      // 1. letter_requests
      const lrResult = await client.query(`
        INSERT INTO archives (archive_number, source_type, source_id, letter_type_id, subject, status, archived_by, archived_at)
        SELECT 
          'ARC/AJ/' || lr.request_number,
          'letter_request',
          lr.id,
          lr.letter_type_id,
          lr.subject,
          CASE lr.status
            WHEN 'disetujui' THEN 'Disetujui'
            WHEN 'selesai' THEN 'Selesai'
            ELSE lr.status::varchar
          END,
          lr.applicant_id,
          COALESCE(lr.completed_at, lr.approved_at, now())
        FROM letter_requests lr
        WHERE lr.status IN ('disetujui', 'selesai')
          AND NOT EXISTS (
            SELECT 1 FROM archives a 
            WHERE a.source_type = 'letter_request' AND a.source_id = lr.id
          )
        ON CONFLICT (source_type, source_id) DO NOTHING
        RETURNING id
      `);
      count += lrResult.rowCount || 0;

      // 2. incoming_letters
      const ilResult = await client.query(`
        INSERT INTO archives (archive_number, source_type, source_id, letter_type_id, subject, status, archived_by, archived_at)
        SELECT 
          'ARC/SM/' || il.agenda_number,
          'incoming_letter',
          il.id,
          il.letter_type_id,
          il.subject,
          CASE il.status
            WHEN 'selesai' THEN 'Selesai'
            ELSE il.status::varchar
          END,
          il.registered_by,
          COALESCE(il.completed_at, now())
        FROM incoming_letters il
        WHERE il.status = 'selesai'
          AND NOT EXISTS (
            SELECT 1 FROM archives a 
            WHERE a.source_type = 'incoming_letter' AND a.source_id = il.id
          )
        ON CONFLICT (source_type, source_id) DO NOTHING
        RETURNING id
      `);
      count += ilResult.rowCount || 0;

      // 3. outgoing_letters
      const olResult = await client.query(`
        INSERT INTO archives (archive_number, source_type, source_id, letter_type_id, subject, status, archived_by, archived_at)
        SELECT 
          'ARC/SK/' || ol.letter_number,
          'outgoing_letter',
          ol.id,
          ol.letter_type_id,
          ol.subject,
          CASE ol.status
            WHEN 'dikirim' THEN 'Dikirim'
            ELSE ol.status::varchar
          END,
          ol.created_by,
          COALESCE(ol.sent_at, now())
        FROM outgoing_letters ol
        WHERE ol.status = 'dikirim'
          AND NOT EXISTS (
            SELECT 1 FROM archives a 
            WHERE a.source_type = 'outgoing_letter' AND a.source_id = ol.id
          )
        ON CONFLICT (source_type, source_id) DO NOTHING
        RETURNING id
      `);
      count += olResult.rowCount || 0;

      // 4. dispositions
      const dResult = await client.query(`
        INSERT INTO archives (archive_number, source_type, source_id, letter_type_id, subject, status, archived_by, archived_at)
        SELECT 
          'ARC/DSP/' || d.disposition_number,
          'disposition',
          d.id,
          il.letter_type_id,
          il.subject,
          CASE d.status
            WHEN 'selesai' THEN 'Selesai'
            ELSE d.status::varchar
          END,
          d.giver_id,
          COALESCE(d.completed_at, now())
        FROM dispositions d
        JOIN incoming_letters il ON il.id = d.incoming_letter_id
        WHERE d.status = 'selesai'
          AND NOT EXISTS (
            SELECT 1 FROM archives a 
            WHERE a.source_type = 'disposition' AND a.source_id = d.id
          )
        ON CONFLICT (source_type, source_id) DO NOTHING
        RETURNING id
      `);
      count += dResult.rowCount || 0;
    });

    await writeAuditLog(request.user.id, "sync_archives", "archives", null, "Sinkronisasi arsip digital otomatis", {
      synced_count: count
    });

    response.json({ message: "Arsip berhasil disinkronkan.", count });
  } catch (error) {
    next(error);
  }
});
