import { query } from "../db.js";
import { verifyToken } from "../auth/token.js";

export async function requireAuth(request, response, next) {
  try {
    const authorization = request.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const payload = verifyToken(token);
    if (!payload?.sub) {
      return response.status(401).json({ message: "Unauthenticated." });
    }

    const result = await query(
      `SELECT users.id, users.full_name, users.username, users.email, users.status, users.position,
              roles.code AS role_code, roles.name AS role_name,
              units.name AS unit
       FROM users
       JOIN roles ON roles.id = users.role_id
       LEFT JOIN units ON units.id = users.unit_id
       WHERE users.id = $1 AND users.deleted_at IS NULL`,
      [payload.sub]
    );

    const user = result.rows[0];
    if (!user || user.status !== "aktif") {
      return response.status(401).json({ message: "Akun Anda tidak aktif. Hubungi administrator." });
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user?.role_code)) {
      return response.status(403).json({ message: "Anda tidak memiliki akses ke halaman ini." });
    }
    next();
  };
}
