import { spawnSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";

const projectRef = process.env.SUPABASE_DEV_PROJECT_REF;
if (!/^[a-z0-9]{20}$/.test(projectRef ?? "")) {
  throw new Error("Set SUPABASE_DEV_PROJECT_REF to the Askwell dev project reference.");
}

const result = spawnSync(
  "supabase",
  ["gen", "types", "typescript", `--remote=${projectRef}`, "--schema", "public"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
if (result.error) throw result.error;
if (result.status !== 0 || !result.stdout.startsWith("export type Json")) {
  throw new Error("Supabase type generation failed.");
}

const destination = new URL("./types.ts", import.meta.url);
const temporary = new URL(`./types.${process.pid}.tmp`, import.meta.url);
try {
  writeFileSync(temporary, result.stdout, { flag: "wx" });
  renameSync(temporary, destination);
} finally {
  rmSync(temporary, { force: true });
}
