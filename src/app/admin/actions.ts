"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { requireAdmin, requireStaff } from "@/lib/staff";
import { unitIdsFromList, unitIdsFromRange } from "@/lib/units";
import { db } from "@/lib/db";
import {
  addDocument,
  addUploadedDocument,
  createLot,
  holdLot,
  publishLot,
  releaseHold,
  replaceDocument,
  replaceWithUploadedDocument,
  type UploadedFile,
} from "@/server/lots";
import { createProduct, updateProduct } from "@/server/products";
import { markReviewed } from "@/server/reports";
import type { Result } from "@/server/result";
import { grantAccess, revokeAccess } from "@/server/staff-admin";
import { addUnits, setShippedTo, voidUnit } from "@/server/units";

// Each action checks the signed-in staff member itself: a hidden button
// protects nothing. The business rules live in src/server.

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function done(result: Result, message: string, ...paths: string[]): ActionState {
  if (!result.ok) return { error: result.error };
  for (const path of paths) revalidatePath(path);
  return { ok: true, message };
}

async function uploadedFile(formData: FormData): Promise<UploadedFile | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
}

// ─── Products ─────────────────────────────────────────────────────────

export async function createProductAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const result = await createProduct(staff.email, {
    code: text(formData, "code"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    storage: text(formData, "storage"),
  });
  return done(result, "Product added.", "/admin/products");
}

export async function updateProductAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const result = await updateProduct(staff.email, id, {
    code: text(formData, "code"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    storage: text(formData, "storage"),
    active: formData.get("active") === "on",
  });
  return done(result, "Saved.", "/admin/products", `/admin/products/${id}`);
}

// ─── Lots and documents ───────────────────────────────────────────────

export async function createLotAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const result = await createLot(staff.email, {
    lotNumber: text(formData, "lotNumber"),
    productId: text(formData, "productId"),
    expirationDate: text(formData, "expirationDate"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/lots");
  redirect(`/admin/lots/${result.id}`);
}

export async function addDocumentAction(lotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const result = await addDocument(
    staff.email,
    lotId,
    { type: text(formData, "type"), title: text(formData, "title") },
    await uploadedFile(formData),
  );
  return done(result, "Document uploaded.", `/admin/lots/${lotId}`);
}

export async function replaceDocumentAction(
  documentId: string,
  lotId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const result = await replaceDocument(staff.email, documentId, text(formData, "reason"), await uploadedFile(formData));
  return done(result, "New version uploaded.", `/admin/lots/${lotId}`);
}

/** Records a large document the browser already sent straight to storage. */
export async function addUploadedDocumentAction(
  lotId: string,
  input: { type: string; title: string; storageKey: string },
): Promise<ActionState> {
  const staff = await requireStaff();
  const result = await addUploadedDocument(staff.email, lotId, input, input.storageKey);
  return done(result, "Document uploaded.", `/admin/lots/${lotId}`);
}

export async function replaceWithUploadedDocumentAction(
  documentId: string,
  lotId: string,
  input: { reason: string; storageKey: string },
): Promise<ActionState> {
  const staff = await requireStaff();
  const result = await replaceWithUploadedDocument(staff.email, documentId, input.reason, input.storageKey);
  return done(result, "New version uploaded.", `/admin/lots/${lotId}`);
}

export async function publishLotAction(lotId: string, _: ActionState): Promise<ActionState> {
  const staff = await requireStaff();
  return done(await publishLot(staff.email, lotId), "Lot published.", `/admin/lots/${lotId}`, "/admin/lots");
}

export async function holdLotAction(lotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  return done(await holdLot(staff.email, lotId, text(formData, "reason")), "Lot put on hold.", `/admin/lots/${lotId}`, "/admin/lots");
}

export async function releaseHoldAction(lotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  return done(await releaseHold(staff.email, lotId, text(formData, "reason")), "Hold released.", `/admin/lots/${lotId}`, "/admin/lots");
}

// ─── Units ────────────────────────────────────────────────────────────

async function lotNumberOf(lotId: string): Promise<string | null> {
  return (await db.lot.findUnique({ where: { id: lotId }, select: { lotNumber: true } }))?.lotNumber ?? null;
}

export async function addUnitRangeAction(lotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const lotNumber = await lotNumberOf(lotId);
  if (!lotNumber) return { error: "Lot not found." };
  const ids = unitIdsFromRange(lotNumber, Number(text(formData, "from")), Number(text(formData, "to")));
  if (!ids.ok) return { error: ids.error };
  const result = await addUnits(staff.email, lotId, ids.unitIds);
  return done(result, result.ok ? `Added ${result.count} units.` : "", `/admin/lots/${lotId}/units`, `/admin/lots/${lotId}`);
}

export async function addUnitListAction(lotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const lotNumber = await lotNumberOf(lotId);
  if (!lotNumber) return { error: "Lot not found." };
  const ids = unitIdsFromList(lotNumber, text(formData, "unitIds"));
  if (!ids.ok) return { error: ids.error };
  const result = await addUnits(staff.email, lotId, ids.unitIds);
  return done(result, result.ok ? `Added ${result.count} units.` : "", `/admin/lots/${lotId}/units`, `/admin/lots/${lotId}`);
}

export async function voidUnitAction(id: string, lotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  return done(await voidUnit(staff.email, id, text(formData, "reason")), "Unit voided.", `/admin/lots/${lotId}/units`);
}

export async function setShippedToAction(id: string, lotId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  return done(await setShippedTo(staff.email, id, text(formData, "shippedTo")), "Saved.", `/admin/lots/${lotId}/units`);
}

// ─── Reports ──────────────────────────────────────────────────────────

export async function markReviewedAction(reportId: string, _: ActionState): Promise<ActionState> {
  const staff = await requireStaff();
  return done(await markReviewed(staff.email, reportId), "Marked reviewed.", `/admin/reports/${reportId}`, "/admin/reports", "/admin");
}

// ─── Staff access (admins only) ───────────────────────────────────────

export async function grantAccessAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const result = await grantAccess(admin.email, { email: text(formData, "email"), role: text(formData, "role") });
  return done(result, "Access granted.", "/admin/users");
}

export async function revokeAccessAction(email: string, _: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return done(await revokeAccess(admin.email, email), "Access removed.", "/admin/users");
}
