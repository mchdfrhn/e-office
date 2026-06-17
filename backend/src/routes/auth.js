import { Router } from "express";
import { createToken } from "../auth/token.js";
import { requireAuth } from "../middleware/auth.js";
import { query } from "../db.js";
import { writeAuditLog } from "../utils/audit.js";

export const authRouter = Router();

authRouter.post("/login", async (request, response, next) => {
  try {
    const { username, password } = request.body || {};
    if (!username || !password) {
      return response.status(422).json({ message: "Username/email dan password wajib diisi." });
    }

    const result = await query(
      `SELECT users.id, users.full_name, users.username, users.email, users.status, users.position,
              roles.code AS role_code, roles.name AS role_name,
              units.name AS unit
       FROM users
       JOIN roles ON roles.id = users.role_id
       LEFT JOIN units ON units.id = users.unit_id
       WHERE (users.username = $1 OR users.email = $1)
         AND users.password_hash = crypt($2, users.password_hash)
         AND users.deleted_at IS NULL`,
      [username, password]
    );

    const user = result.rows[0];
    if (!user) {
      return response.status(401).json({ message: "Username atau password salah." });
    }
    if (user.status !== "aktif") {
      return response.status(403).json({ message: "Akun Anda tidak aktif. Hubungi administrator." });
    }

    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    await writeAuditLog({ userId: user.id, activity: "login", module: "auth", request });

    const token = createToken({ sub: user.id, role: user.role_code });
    response.json({ token, user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireAuth, async (request, response, next) => {
  try {
    await writeAuditLog({ userId: request.user.id, activity: "logout", module: "auth", request });
    response.json({ message: "Logout berhasil." });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});
