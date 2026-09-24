import "dotenv/config";
import path from "node:path";

export const env = {
  DATABASE_URL: process.env["DATABASE_URL"] ?? "",
  JWT_SECRET: process.env["JWT_SECRET"] ?? "dev-secret-troque-em-producao",
  NODE_ENV: process.env["NODE_ENV"] ?? "development",
  PORT: Number(process.env["PORT"] ?? 3000),
  // No container: /app/uploads (volume Docker `backend_uploads`)
  UPLOADS_DIR: process.env["UPLOADS_DIR"] ?? path.resolve(process.cwd(), "uploads"),
};
