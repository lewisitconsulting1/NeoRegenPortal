import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

// Lot documents live in Vercel Blob as private files when a Blob store is
// connected, and under .data/uploads otherwise (local development). Either way they are only ever served through the portal's
// own download route, which checks the unit's access code first.

// Local storage is for development only; the ignore comments keep the bundler
// from tracing the whole project into the server build because of it.
const LOCAL_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".data", "uploads"),
);

// A connected store sets BLOB_STORE_ID (the SDK then signs in with Vercel's
// short-lived OIDC token) or, on older setups, BLOB_READ_WRITE_TOKEN.
function blobConfigured(): boolean {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.VERCEL) throw new Error("No Blob store is connected; connect one to the project under Storage.");
  return false;
}

function localPath(key: string): string {
  const resolved = path.resolve(/*turbopackIgnore: true*/ LOCAL_DIR, key);
  if (!resolved.startsWith(LOCAL_DIR + path.sep)) throw new Error(`Invalid storage key: ${key}`);
  return resolved;
}

export async function saveFile(key: string, body: Buffer, contentType: string): Promise<void> {
  if (blobConfigured()) {
    await put(key, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, { flag: "wx" });
}

export async function openFile(key: string): Promise<ReadableStream<Uint8Array> | null> {
  if (blobConfigured()) {
    const result = await get(key, { access: "private" });
    return result?.statusCode === 200 ? result.stream : null;
  }
  try {
    return new Blob([new Uint8Array(await readFile(localPath(key)))]).stream();
  } catch {
    return null;
  }
}
