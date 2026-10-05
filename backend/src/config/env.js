import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

export function readConfig() {
  const {
    MONGODB_URI,
    JWT_SECRET,
    NODE_ENV = "development",
    PORT = "5000",
  } = process.env;
  if (!MONGODB_URI)
    throw new Error(
      "Set MONGODB_URI in backend/.env or the server environment",
    );
  if (
    !JWT_SECRET ||
    JWT_SECRET.length < 32 ||
    JWT_SECRET.startsWith("replace-with")
  ) {
    throw new Error("JWT_SECRET must contain at least 32 random characters");
  }
  const port = Number(PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be between 1 and 65535");
  return {
    mongoUri: MONGODB_URI,
    jwtSecret: JWT_SECRET,
    production: NODE_ENV === "production",
    port,
  };
}
