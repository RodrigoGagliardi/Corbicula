import "dotenv/config";
import { buildApp } from "./app";
import { env } from "./shared/env";

buildApp()
  .then((app) => app.listen({ port: env.PORT, host: "0.0.0.0" }))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
