import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { DIRECT_UPLOAD_LIMIT, DOCUMENT_TYPES, fileNameFromKey } from "@/lib/files";
import { getStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

const TOKEN_MINUTES = 15;

/**
 * Hands a signed-in staff member's browser a presigned URL for putting one
 * large lot document straight into Blob storage, so the file never passes
 * through a function (Vercel caps those requests at 4.5 MB). The URL only
 * allows that one key, a document type and DIRECT_UPLOAD_LIMIT bytes. The
 * document is recorded afterwards by a server action that checks the stored
 * file again (addUploadedDocument).
 */
export async function POST(request: Request) {
  if (!(await getStaff())) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = (await request.json()) as HandleUploadPresignedBody;
  if (body.type !== "blob.generate-presigned-url") {
    return Response.json({ error: "Unsupported request." }, { status: 400 });
  }

  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const lotId = (JSON.parse(clientPayload ?? "{}") as { lotId?: string }).lotId ?? "";
        if (!fileNameFromKey(pathname, lotId) || !(await db.lot.findUnique({ where: { id: lotId } }))) {
          throw new Error("That upload doesn't belong to a lot.");
        }
        const validUntil = Date.now() + TOKEN_MINUTES * 60 * 1000;
        const limits = { allowedContentTypes: Object.keys(DOCUMENT_TYPES), maximumSizeInBytes: DIRECT_UPLOAD_LIMIT };
        const token = await issueSignedToken({ pathname, operations: ["put"], validUntil, ...limits });
        return { token, urlOptions: { validUntil, ...limits, allowOverwrite: false, addRandomSuffix: false } };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("Upload URL refused:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Upload refused." }, { status: 400 });
  }
}
