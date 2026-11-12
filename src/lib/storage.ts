import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, head, put } from "@vercel/blob";
import { DOCUMENT_TYPES } from "@/lib/files";

// Lot documents live in Vercel Blob as private files when a Blob store is
// connected, and under .data/uploads otherwise (local development). Either
// way they are only ever served through the portal's own download routes,
// which check the unit's access code or the staff member first.

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

/**
 * Large files go from the browser straight to Blob through a presigned URL
 * (see /api/admin/uploads), which also needs the store's webhook key.
 */
export function directUploadsEnabled(): boolean {
  return Boolean(
    (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) && process.env.BLOB_WEBHOOK_PUBLIC_KEY,
  );
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

/** Size and type of a stored file, or null if nothing is stored under the key. */
export async function statFile(key: string): Promise<{ size: number; contentType: string } | null> {
  if (blobConfigured()) {
    try {
      const blob = await head(key);
      return { size: blob.size, contentType: blob.contentType };
    } catch {
      return null;
    }
  }
  try {
    const info = await stat(localPath(key));
    const extension = key.split(".").pop() ?? "";
    const contentType = Object.keys(DOCUMENT_TYPES).find((t) => DOCUMENT_TYPES[t] === extension) ?? "application/octet-stream";
    return { size: info.size, contentType };
  } catch {
    return null;
  }
}
