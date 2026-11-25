/**
 * Uploads the photos in photo-portfolio/photos/ to Onttle with OCR and AI description on.
 *
 *   pnpm upload          uploads ONE photo and prints what Onttle filled in, then stops
 *   pnpm upload --all    uploads the rest (files already in scripts/uploaded.json are skipped)
 *
 * POST /files (multipart) with `is_ocr` and `is_generate`, the names in the project's OpenAPI spec.
 * Each upload costs credits, so the first run is a single photo: check that description_generated, keywords
 * and thumbnails came back before uploading the rest. Set the thumbnail presets in the dashboard FIRST:
 * they only apply to files uploaded after they exist.
 *
 * Remove GPS from the EXIF before uploading. photos/ and scripts/uploaded.json are git-ignored: the
 * result file holds file ids, which are not committed. Prints no URLs and no key.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const photosDir = join(root, "photos");
const resultFile = join(root, "scripts", "uploaded.json");
const IMAGE = /\.(jpe?g|png|webp|heic)$/i;
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic" };

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set (in .env.local)`);
  return value;
}

interface Uploaded {
  file: string;
  id: string;
  description_generated: string | null;
  keywords: string[];
  text_vision: string | null;
  thumbnails: { size?: string; width?: number }[];
}

async function upload(file: string): Promise<Uploaded> {
  const apiUrl = (process.env.ONTTLE_API_URL ?? "https://api.onttle.com").replace(/\/+$/, "").replace(/\/v1$/, "");
  const form = new FormData();
  const bytes = await readFile(join(photosDir, file));
  form.append("file", new Blob([bytes], { type: MIME[extname(file).toLowerCase()] ?? "application/octet-stream" }), file);
  form.append("name", file);
  form.append("is_ocr", "true");
  form.append("is_generate", "true");

  const res = await fetch(`${apiUrl}/v1/${env("ONTTLE_PROJECT_ID")}/files`, {
    method: "POST",
    headers: { "X-Onttle-Key": env("ONTTLE_API_KEY") },
    body: form,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { type?: string; message?: unknown } | null;
    throw new Error(`POST /files ${file} → ${res.status} ${err?.type ?? ""} ${JSON.stringify(err?.message ?? "")}`);
  }
  const f = (await res.json()) as {
    id: string;
    description_generated?: string | null;
    keywords?: string[] | null;
    text_vision?: string | null;
    thumbnails?: { size?: string; width?: number }[] | null;
  };
  return {
    file,
    id: f.id,
    description_generated: f.description_generated ?? null,
    keywords: f.keywords ?? [],
    text_vision: f.text_vision ?? null,
    thumbnails: (f.thumbnails ?? []).map((t) => ({ size: t.size, width: t.width })),
  };
}

function report(u: Uploaded) {
  console.log(`\n${u.file}`);
  console.log(`  description_generated: ${u.description_generated ?? "(empty)"}`);
  console.log(`  keywords (${u.keywords.length}): ${u.keywords.join(", ") || "(empty)"}`);
  console.log(`  text_vision: ${u.text_vision ? u.text_vision.replace(/\s+/g, " ").slice(0, 120) : "(empty)"}`);
  console.log(`  thumbnails: ${u.thumbnails.map((t) => `${t.size}:${t.width}`).join(", ") || "(none)"}`);
}

const all = process.argv.includes("--all");
const done: Uploaded[] = JSON.parse(await readFile(resultFile, "utf8").catch(() => "[]"));
const files = (await readdir(photosDir)).filter((f) => IMAGE.test(f)).sort();
const todo = files.filter((f) => !done.some((d) => d.file === f));

if (files.length === 0) throw new Error(`No images in ${photosDir}`);
if (todo.length === 0) {
  console.log("Every photo is already uploaded (scripts/uploaded.json).");
  process.exit(0);
}
if (!all && done.length > 0) {
  console.log(`${done.length} uploaded already. Check them, then run with --all for the remaining ${todo.length}.`);
  process.exit(0);
}

for (const file of all ? todo : todo.slice(0, 1)) {
  const u = await upload(file); // stops at the first failure: no retries, no guessing other parameter names
  done.push(u);
  await writeFile(resultFile, JSON.stringify(done, null, 2) + "\n");
  report(u);
  if (!all && (!u.description_generated || u.thumbnails.length === 0)) {
    console.log("\nSomething was not filled in. Stop here and check the presets / parameters before uploading more.");
  }
}
console.log(all ? "\nDone. Connect the files to the rows in the dashboard, then sync Vector." : "\nOne photo uploaded. If it looks right: pnpm upload --all");
