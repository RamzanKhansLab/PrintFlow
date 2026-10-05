import mongoose from "mongoose";
import { readConfig } from "../config/env.js";
import { User, AuditLog } from "../models/index.js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin -- registered-email@example.com");
  process.exitCode = 1;
} else {
  try {
    const config = readConfig();
    await mongoose.connect(config.mongoUri);
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: "admin" } },
      { new: true },
    );
    if (!user)
      throw new Error("Register this email in PrintFlow before promoting it");
    await AuditLog.create({
      actor: user._id,
      action: "user.promoted-by-cli",
      entity: String(user._id),
      detail: "Administrator bootstrap",
    });
    console.log("Administrator role assigned. Sign out and sign in again.");
  } catch (error) {
    console.error(
      error.name === "Error"
        ? error.message
        : "Could not connect or update this account",
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
