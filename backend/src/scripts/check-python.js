import "../config/env.js";
import { PythonDsa } from "../services/python-dsa.js";

const worker = new PythonDsa();
try {
  const info = await worker.start();
  console.log(`Python ${info.python} available for PrintFlow DSA`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await worker.close();
}
