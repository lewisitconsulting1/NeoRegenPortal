import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DocumentType } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { parseDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { normalizeLotNumber } from "@/lib/units";
import { fail, isUniqueViolation, type Result } from "@/server/result";

// ─── Lots ─────────────────────────────────────────────────────────────

export async function createLot(
  actor: string,
  input: { lotNumber: string; productId: string; expirationDate: string },
): Promise<Result<{ id: string }>> {
  const lotNumber = normalizeLotNumber(input.lotNumber);
  if (!lotNumber) return fail("Enter the lot number using letters, digits and dashes, e.g. NB260001.");
  const expirationDate = parseDateOnly(input.expirationDate);
  if (!expirationDate) return fail("Enter the expiration date.");
  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product?.active) return fail("Choose an active product.");

  try {
    const lot = await db.$transaction(async (tx) => {
      const created = await tx.lot.create({
        data: { lotNumber, productId: product.id, expirationDate, createdBy: actor },
      });
      await audit(tx, { actor, action: "lot.create", entityType: "Lot", entityId: created.id, after: created });
      return created;
    });
    return { ok: true, id: lot.id };
  } catch (error) {
    if (isUniqueViolation(error)) return fail(`Lot ${lotNumber} already exists.`);
    throw error;
  }
}

/** Customers see a lot's documents only once it is published. */
export async function publishLot(actor: string, lotId: string): Promise<Result> {
  return db.$transaction(async (tx) => {
    const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
    if (lot.status !== "DRAFT") return fail("Only a draft lot can be published.");
    const documents = await tx.lotDocument.count({ where: { lotId, supersededAt: null } });
    if (documents === 0) return fail("Upload at least one document before publishing.");
    const after = await tx.lot.update({
      where: { id: lotId },
      data: { status: "PUBLISHED", publishedAt: new Date(), publishedBy: actor },
    });
    await audit(tx, { actor, action: "lot.publish", entityType: "Lot", entityId: lotId, before: lot, after });
    return { ok: true };
  });
}

export async function holdLot(actor: string, lotId: string, reason: string): Promise<Result> {
  const trimmed = reason.trim();
  if (!trimmed) return fail("Give a reason for the hold.");
  return db.$transaction(async (tx) => {
    const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
    if (lot.status !== "PUBLISHED") return fail("Only a published lot can be put on hold.");
    const after = await tx.lot.update({ where: { id: lotId }, data: { status: "ON_HOLD", holdReason: trimmed } });
    await audit(tx, { actor, action: "lot.hold", entityType: "Lot", entityId: lotId, before: lot, after, reason: trimmed });
    return { ok: true };
  });
}

export async function releaseHold(actor: string, lotId: string, reason: string): Promise<Result> {
  const trimmed = reason.trim();
  if (!trimmed) return fail("Give a reason for releasing the hold.");
  return db.$transaction(async (tx) => {
    const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
    if (lot.status !== "ON_HOLD") return fail("This lot is not on hold.");
    const after = await tx.lot.update({ where: { id: lotId }, data: { status: "PUBLISHED", holdReason: null } });
    await audit(tx, { actor, action: "lot.release_hold", entityType: "Lot", entityId: lotId, before: lot, after, reason: trimmed });
    return { ok: true };
  });
}

// ─── Documents ────────────────────────────────────────────────────────

// Vercel functions accept request bodies up to 4.5 MB, upload included.
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export type UploadedFile = { name: string; type: string; bytes: Buffer };

function checkFile(file: UploadedFile | null): string | null {
  if (!file || file.bytes.length === 0) return "Choose a file to upload.";
  if (!ALLOWED_TYPES[file.type]) return "Upload a PDF, PNG or JPEG file.";
  if (file.bytes.length > MAX_DOCUMENT_BYTES) return "Files can be at most 4 MB.";
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
  return `${base || "document"}.${ALLOWED_TYPES[type]}`;
}

const documentSchema = z.object({
  type: z.enum(DocumentType, { error: "Choose a document type." }),
  title: z.string().trim().min(1, "Give the document a title.").max(200),
});

export async function addDocument(
  actor: string,
  lotId: string,
  input: { type: string; title: string },
  file: UploadedFile | null,
): Promise<Result<{ id: string }>> {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const fileError = checkFile(file);
  if (fileError || !file) return fail(fileError ?? "Choose a file to upload.");
  const lot = await db.lot.findUnique({ where: { id: lotId } });
  if (!lot) return fail("Lot not found.");

  const fileName = safeFileName(file.name, file.type);
  const storageKey = `lots/${lot.id}/${randomUUID()}-${fileName}`;
  // Stored before the row exists: a failed write leaves an unreferenced file,
  // never a row pointing at a file that isn't there.
  await saveFile(storageKey, file.bytes, file.type);

  const document = await db.$transaction(async (tx) => {
    const created = await tx.lotDocument.create({
      data: {
        lotId,
        type: parsed.data.type,
        title: parsed.data.title,
        fileName,
        contentType: file.type,
        size: file.bytes.length,
        storageKey,
        uploadedBy: actor,
      },
    });
    await audit(tx, { actor, action: "document.add", entityType: "LotDocument", entityId: created.id, after: created });
    return created;
  });
  return { ok: true, id: document.id };
}

/** Adds a new version and marks the old one superseded; nothing is deleted. */
export async function replaceDocument(
  actor: string,
  documentId: string,
  reason: string,
  file: UploadedFile | null,
): Promise<Result<{ id: string }>> {
  const trimmed = reason.trim();
  if (!trimmed) return fail("Give a reason for replacing the document.");
  const fileError = checkFile(file);
  if (fileError || !file) return fail(fileError ?? "Choose a file to upload.");
  const old = await db.lotDocument.findUnique({ where: { id: documentId } });
  if (!old) return fail("Document not found.");
  if (old.supersededAt) return fail("This version was already replaced. Replace the current version instead.");

  const fileName = safeFileName(file.name, file.type);
  const storageKey = `lots/${old.lotId}/${randomUUID()}-${fileName}`;
  await saveFile(storageKey, file.bytes, file.type);

  try {
    const created = await db.$transaction(async (tx) => {
      // The unique replacesId makes a second, simultaneous replace fail here.
      const next = await tx.lotDocument.create({
        data: {
          lotId: old.lotId,
          type: old.type,
          title: old.title,
          fileName,
          contentType: file.type,
          size: file.bytes.length,
          storageKey,
          version: old.version + 1,
          replacesId: old.id,
          uploadedBy: actor,
        },
      });
      const superseded = await tx.lotDocument.updateMany({
        where: { id: old.id, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      if (superseded.count !== 1) throw new Error("Document was replaced concurrently.");
      await audit(tx, {
        actor,
        action: "document.replace",
        entityType: "LotDocument",
        entityId: next.id,
        before: old,
        after: next,
        reason: trimmed,
      });
      return next;
    });
    return { ok: true, id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) return fail("This version was already replaced. Replace the current version instead.");
    throw error;
  }
}
