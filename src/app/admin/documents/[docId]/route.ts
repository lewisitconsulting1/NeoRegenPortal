import { db } from "@/lib/db";
import { getStaff } from "@/lib/staff";
import { openFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Any version of any lot document, for signed-in staff. */
export async function GET(_request: Request, { params }: { params: Promise<{ docId: string }> }) {
  if (!(await getStaff())) return new Response("Sign in required.", { status: 401 });
  const { docId } = await params;
  const document = await db.lotDocument.findUnique({ where: { id: docId } });
  if (!document) return new Response("Not found.", { status: 404 });
  const stream = await openFile(document.storageKey);
  if (!stream) return new Response("Stored file is missing.", { status: 503 });
  return new Response(stream, {
    headers: {
      "Content-Type": document.contentType,
      "Content-Disposition": `inline; filename="${document.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
