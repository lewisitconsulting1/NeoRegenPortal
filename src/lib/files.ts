// Rules for lot document files, shared by the browser (to check before
// uploading) and the server (which checks again). No server-only imports.

export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/** Largest file that goes through a server action: Vercel caps a request at 4.5 MB. */
export const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024;
/** Largest file the browser may send straight to Blob storage. */
export const DIRECT_UPLOAD_LIMIT = 50 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/** Why this file can't be a lot document, or null if it can. */
export function documentFileProblem(file: { size: number; type: string } | null, limit: number): string | null {
  if (!file || file.size === 0) return "Choose a file to upload.";
  if (!DOCUMENT_TYPES[file.type]) return "Upload a PDF, PNG or JPEG file.";
  if (file.size > limit) return `Files can be at most ${formatBytes(limit)}.`;
  return null;
}

/** Keeps a name safe for headers and storage paths without losing its gist. */
export function safeFileName(name: string, type: string): string {
  const base = name
    .replace(/\.[^.]*$/, "")
    .replace(/[^A-Za-z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "document"}.${DOCUMENT_TYPES[type] ?? "bin"}`;
}

/** Every lot document lives at lots/<lotId>/<uuid>-<file name>. */
export function documentStorageKey(lotId: string, fileName: string, uuid: string): string {
  return `lots/${lotId}/${uuid}-${fileName}`;
}

const KEY_PATTERN = /^lots\/([a-z0-9]+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-([A-Za-z0-9._-]+\.(?:pdf|png|jpg))$/;

/** The file name inside a storage key for this lot, or null if the key isn't one. */
export function fileNameFromKey(key: string, lotId: string): string | null {
  const match = KEY_PATTERN.exec(key);
  return match && match[1] === lotId ? match[2] : null;
}
