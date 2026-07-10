import dotenv from "dotenv";

dotenv.config();

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  app: {
    name: process.env.APP_NAME || "E-Office",
    env: process.env.APP_ENV || "local",
    port: readNumber(process.env.APP_PORT, 8000),
    frontendUrls: (process.env.FRONTEND_URL || "http://localhost:3000,http://127.0.0.1:3000")
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean),
    timezone: process.env.TIMEZONE || "Asia/Jakarta",
    jwtSecret: process.env.JWT_SECRET || "change_this_secret",
    maxUploadSize: readNumber(process.env.MAX_UPLOAD_SIZE, 10 * 1024 * 1024)
  },
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: readNumber(process.env.DB_PORT, 5432),
    database: process.env.DB_DATABASE || "eoffice_db",
    user: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    ssl: readBoolean(process.env.DB_SSL, false) ? { rejectUnauthorized: false } : false
  },
  email: {
    enabled: readBoolean(process.env.EMAIL_SYNC_ENABLED, false),
    address: process.env.EMAIL_ADDRESS || "sekretariat@sttpu.ac.id",
    fromName: process.env.EMAIL_FROM_NAME || "Sekretariat STTPU",
    protocol: (process.env.EMAIL_PROTOCOL || "imap").toLowerCase(),
    imap: {
      host: process.env.EMAIL_IMAP_HOST || process.env.EMAIL_HOST || "",
      port: readNumber(process.env.EMAIL_IMAP_PORT || process.env.EMAIL_PORT, 993),
      secure: readBoolean(process.env.EMAIL_IMAP_SECURE, true),
      user: process.env.EMAIL_USERNAME || process.env.EMAIL_USER || process.env.EMAIL_ADDRESS || "sekretariat@sttpu.ac.id",
      password: process.env.EMAIL_PASSWORD || "",
      mailbox: process.env.EMAIL_IMAP_MAILBOX || "INBOX"
    },
    smtp: {
      host: process.env.EMAIL_SMTP_HOST || "",
      port: readNumber(process.env.EMAIL_SMTP_PORT, 465),
      secure: readBoolean(process.env.EMAIL_SMTP_SECURE, true),
      user: process.env.EMAIL_USERNAME || process.env.EMAIL_USER || process.env.EMAIL_ADDRESS || "sekretariat@sttpu.ac.id",
      password: process.env.EMAIL_PASSWORD || ""
    },
    syncLimit: readNumber(process.env.EMAIL_SYNC_LIMIT, 25),
    syncSinceDays: readNumber(process.env.EMAIL_SYNC_SINCE_DAYS, 14)
  }
};
