import "dotenv/config";

export const env = {
  DATABASE_URL: process.env["DATABASE_URL"] ?? "",
  JWT_SECRET: process.env["JWT_SECRET"] ?? "dev-secret-troque-em-producao",
  NODE_ENV: process.env["NODE_ENV"] ?? "development",
  PORT: Number(process.env["PORT"] ?? 3000),
};
