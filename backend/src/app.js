import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { auditLogsRouter } from "./routes/audit-logs.js";
import { authRouter } from "./routes/auth.js";
import { backupsRouter } from "./routes/backups.js";
import { emailRouter } from "./routes/email.js";
import { healthRouter } from "./routes/health.js";
import { incomingLettersRouter } from "./routes/incoming-letters.js";
import { metaRouter } from "./routes/meta.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.app.frontendUrls, credentials: true }));
  app.use(express.json({ limit: "15mb" }));
  app.use(morgan("dev"));

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", metaRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/incoming-letters", incomingLettersRouter);
  app.use("/api/audit-logs", auditLogsRouter);
  app.use("/api/backups", backupsRouter);
  app.use("/api/email", emailRouter);

  app.use((_request, response) => {
    response.status(404).json({ message: "Data tidak ditemukan." });
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(error.status || 500).json({
      message: error.message || "Terjadi kesalahan pada server. Silakan coba lagi."
    });
  });

  return app;
}
