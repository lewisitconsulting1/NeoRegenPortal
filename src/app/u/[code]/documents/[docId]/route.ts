import { openFile } from "@/lib/storage";
import { lookupBlocked } from "@/lib/rate-limit";
import { clientInfo } from "@/lib/request";
import { findDownloadableDocument, logAccess } from "@/server/customer";

export const dynamic = "force-dynamic";

/** Streams a lot document to someone holding the unit's code. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string; docId: string }> }) {
  const { code, docId } = await params;
  const client = await clientInfo();
  if (await lookupBlocked(client.ip)) return new Response("Too many attempts. Try again in 15 minutes.", { status: 429 });

  const found = await findDownloadableDocument(decodeURIComponent(code), docId);
  if (!found) {
    await logAccess("LOOKUP_FAILED", client);
    return new Response("Not found.", { status: 404 });
  }

  const stream = await openFile(found.document.storageKey);
  if (!stream) {
    console.error(`Stored file missing for document ${found.document.id} (${found.document.storageKey})`);
    return new Response("This document is temporarily unavailable.", { status: 503 });
  }

  await logAccess("DOWNLOAD", client, { unitId: found.unit.id, documentId: found.document.id });
  return new Response(stream, {
    headers: {
      "Content-Type": found.document.contentType,
      "Content-Disposition": `inline; filename="${found.document.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
