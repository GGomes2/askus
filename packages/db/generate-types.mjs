import { spawnSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";

const projectRef = process.env.SUPABASE_DEV_PROJECT_REF?.trim()
  || hostedProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!/^[a-z0-9]{20}$/.test(projectRef ?? "")) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL to the hosted Supabase dev URL or set SUPABASE_DEV_PROJECT_REF.",
  );
}

function hostedProjectRef(value) {
  const url = URL.parse(value ?? "");
  if (!url || url.protocol !== "https:" || url.port || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    return undefined;
  }
  return /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)?.[1];
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
