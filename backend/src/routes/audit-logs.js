import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { query } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";

export const auditLogsRouter = Router();

auditLogsRouter.get("/", requireAuth, requireRole("administrator"), async (request, response, next) => {
  try {
    const pageParam = typeof request.query.page === "string" ? request.query.page : "1";
    const perPageParam = typeof request.query.perPage === "string" ? request.query.perPage : "20";
    const searchParam = typeof request.query.search === "string" ? request.query.search : "";
    const moduleParam = typeof request.query.module === "string" ? request.query.module : "";
    const statusParam = typeof request.query.status === "string" ? request.query.status : "";

    const page = Math.max(Number(pageParam || 1), 1);
    const perPage = Math.min(Math.max(Number(perPageParam || 20), 1), 100);
    const offset = (page - 1) * perPage;

    const dbSearchPattern = searchParam ? `%${searchParam}%` : "";

    const countResult = await query(
      `SELECT COUNT(*) 
       FROM audit_logs
       LEFT JOIN users ON users.id = audit_logs.user_id
       WHERE ($1 = '' OR audit_logs.module = $1)
         AND ($2 = '' OR 
              ($2 = 'unreviewed' AND audit_logs.review_status IS NULL) OR 
              (audit_logs.review_status = $2))
         AND ($3 = '' OR 
              audit_logs.activity ILIKE $3 OR 
              audit_logs.module ILIKE $3 OR 
              audit_logs.data_label ILIKE $3 OR 
              users.full_name ILIKE $3)`,
      [moduleParam, statusParam, dbSearchPattern]
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT audit_logs.id, audit_logs.activity, audit_logs.module, audit_logs.data_label,
              audit_logs.metadata, audit_logs.ip_address, audit_logs.user_agent, audit_logs.created_at,
              audit_logs.review_status, audit_logs.review_notes, audit_logs.reviewed_at,
              users.full_name AS user_name,
              reviewer.full_name AS reviewer_name
       FROM audit_logs
       LEFT JOIN users ON users.id = audit_logs.user_id
       LEFT JOIN users AS reviewer ON reviewer.id = audit_logs.reviewed_by
       WHERE ($1 = '' OR audit_logs.module = $1)
         AND ($2 = '' OR 
              ($2 = 'unreviewed' AND audit_logs.review_status IS NULL) OR 
              (audit_logs.review_status = $2))
         AND ($3 = '' OR 
              audit_logs.activity ILIKE $3 OR 
              audit_logs.module ILIKE $3 OR 
              audit_logs.data_label ILIKE $3 OR 
              users.full_name ILIKE $3)
       ORDER BY audit_logs.created_at DESC
       LIMIT $4 OFFSET $5`,
      [moduleParam, statusParam, dbSearchPattern, perPage, offset]
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

auditLogsRouter.put("/:id/review", requireAuth, requireRole("administrator"), async (request, response, next) => {
  try {
    const { id } = request.params;
    const { status, notes } = request.body || {};

    if (!status) {
      return response.status(422).json({ message: "Status review wajib diisi." });
    }

    const validStatuses = ["valid", "perlu_tindak_lanjut", "anomali"];
    if (!validStatuses.includes(status)) {
      return response.status(422).json({ message: "Status review tidak valid." });
    }

    const auditLog = await query(
      `UPDATE audit_logs
       SET review_status = $1,
           review_notes = $2,
           reviewed_by = $3,
           reviewed_at = now()
       WHERE id = $4
       RETURNING id, activity, module`,
      [status, notes || null, request.user.id, id]
    );

    if (!auditLog.rows[0]) {
      return response.status(404).json({ message: "Log audit tidak ditemukan." });
    }

    await writeAuditLog({
      userId: request.user.id,
      activity: "review_audit_log",
      module: "audit-logs",
      dataId: id,
      dataLabel: `Review ${auditLog.rows[0].activity} (${auditLog.rows[0].module})`,
      request
    });

    response.json({ message: "Tinjauan audit log berhasil disimpan." });
  } catch (error) {
    next(error);
  }
});

