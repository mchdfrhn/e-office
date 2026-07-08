import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { query } from "../db.js";

export const reportsRouter = Router();

reportsRouter.get("/", requireAuth, requireRole("administrator"), async (request, response, next) => {
  try {
    const { start, end, type, status } = request.query;

    if (!start || !end || !type) {
      return response.status(400).json({ message: "Parameter start, end, dan type wajib diisi." });
    }

    let sql = "";
    let params = [start, end];
    let index = 3;

    if (type === "Surat Masuk") {
      sql = `
        SELECT 
          il.agenda_number, 
          il.letter_number, 
          il.sender, 
          il.subject,
          CASE il.status
            WHEN 'diregistrasi' THEN 'Diregistrasi'
            WHEN 'diteruskan' THEN 'Diteruskan'
            WHEN 'didisposisikan' THEN 'Didisposisikan'
            WHEN 'ditindaklanjuti' THEN 'Ditindaklanjuti'
            WHEN 'selesai' THEN 'Selesai'
            ELSE il.status::text
          END as status
        FROM incoming_letters il
        JOIN letter_types lt ON lt.id = il.letter_type_id
        WHERE il.letter_date BETWEEN $1 AND $2
      `;
      if (status && status !== "Semua Status") {
        sql += ` AND il.status = $${index}`;
        // Map status filter from Indonesian label to DB enum
        const statusMap = {
          "Diregistrasi": "diregistrasi",
          "Diteruskan": "diteruskan",
          "Didisposisikan": "didisposisikan",
          "Ditindaklanjuti": "ditindaklanjuti",
          "Selesai": "selesai"
        };
        params.push(statusMap[status] || status.toLowerCase());
        index++;
      }
      sql += " ORDER BY il.created_at DESC";
    } else if (type === "Surat Keluar") {
      sql = `
        SELECT 
          ol.letter_number, 
          lt.name as letter_type_name, 
          ol.destination, 
          ol.subject,
          CASE ol.status
            WHEN 'draft' THEN 'Draf'
            WHEN 'diperiksa' THEN 'Diperiksa'
            WHEN 'menunggu_approval' THEN 'Menunggu Approval'
            WHEN 'disetujui' THEN 'Disetujui'
            WHEN 'ditolak' THEN 'Ditolak'
            WHEN 'dikirim' THEN 'Dikirim'
            ELSE ol.status::text
          END as status
        FROM outgoing_letters ol
        JOIN letter_types lt ON lt.id = ol.letter_type_id
        WHERE ol.letter_date BETWEEN $1 AND $2
      `;
      if (status && status !== "Semua Status") {
        sql += ` AND ol.status = $${index}`;
        const statusMap = {
          "Draf": "draft",
          "Diperiksa": "diperiksa",
          "Menunggu Approval": "menunggu_approval",
          "Disetujui": "disetujui",
          "Ditolak": "ditolak",
          "Dikirim": "dikirim"
        };
        params.push(statusMap[status] || status.toLowerCase());
        index++;
      }
      sql += " ORDER BY ol.created_at DESC";
    } else if (type === "Ajuan Surat") {
      sql = `
        SELECT 
          lr.request_number, 
          lt.name as letter_type_name, 
          u.full_name as applicant_name,
          lr.subject,
          CASE lr.status
            WHEN 'draft' THEN 'Draf'
            WHEN 'dikirim' THEN 'Dikirim'
            WHEN 'diproses_operator' THEN 'Diproses'
            WHEN 'menunggu_approval' THEN 'Menunggu Approval'
            WHEN 'disetujui' THEN 'Disetujui'
            WHEN 'ditolak' THEN 'Ditolak'
            WHEN 'selesai' THEN 'Selesai'
            ELSE lr.status::text
          END as status
        FROM letter_requests lr
        JOIN letter_types lt ON lt.id = lr.letter_type_id
        JOIN users u ON u.id = lr.applicant_id
        WHERE lr.request_date BETWEEN $1 AND $2
      `;
      if (status && status !== "Semua Status") {
        sql += ` AND lr.status = $${index}`;
        const statusMap = {
          "Draf": "draft",
          "Dikirim": "dikirim",
          "Diproses": "diproses_operator",
          "Menunggu Approval": "menunggu_approval",
          "Disetujui": "disetujui",
          "Ditolak": "ditolak",
          "Selesai": "selesai"
        };
        params.push(statusMap[status] || status.toLowerCase());
        index++;
      }
      sql += " ORDER BY lr.created_at DESC";
    } else if (type === "Disposisi") {
      sql = `
        SELECT 
          d.disposition_number, 
          il.letter_number, 
          COALESCE(u.full_name, un.name) as target,
          d.instruction,
          CASE d.status
            WHEN 'dikirim' THEN 'Dikirim'
            WHEN 'diterima' THEN 'Diterima'
            WHEN 'ditindaklanjuti' THEN 'Ditindaklanjuti'
            WHEN 'selesai' THEN 'Selesai'
            ELSE d.status::text
          END as status
        FROM dispositions d
        JOIN incoming_letters il ON il.id = d.incoming_letter_id
        LEFT JOIN users u ON u.id = d.target_user_id
        LEFT JOIN units un ON un.id = d.target_unit_id
        WHERE d.sent_at::date BETWEEN $1 AND $2
      `;
      if (status && status !== "Semua Status") {
        sql += ` AND d.status = $${index}`;
        const statusMap = {
          "Dikirim": "dikirim",
          "Diterima": "diterima",
          "Ditindaklanjuti": "ditindaklanjuti",
          "Selesai": "selesai"
        };
        params.push(statusMap[status] || status.toLowerCase());
        index++;
      }
      sql += " ORDER BY d.created_at DESC";
    } else {
      return response.status(400).json({ message: "Jenis laporan tidak valid." });
    }

    const result = await query(sql, params);
    
    // Map database result rows to array representation expected by frontend table
    let rows = [];
    if (type === "Surat Masuk") {
      rows = result.rows.map(r => [r.agenda_number, r.letter_number, r.sender, r.subject, r.status]);
    } else if (type === "Surat Keluar") {
      rows = result.rows.map(r => [r.letter_number, r.letter_type_name, r.destination, r.subject, r.status]);
    } else if (type === "Ajuan Surat") {
      // Frontend expects: [nomor, jenis, pengaju, perihal, status]
      rows = result.rows.map(r => [r.request_number, r.letter_type_name, r.applicant_name, r.subject, r.status]);
    } else if (type === "Disposisi") {
      rows = result.rows.map(r => [r.disposition_number, r.letter_number, r.target, r.instruction, r.status]);
    }

    response.json({ rows });
  } catch (error) {
    next(error);
  }
});
