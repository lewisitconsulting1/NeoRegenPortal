import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { parseReport } from "@/lib/report-form";
import { staffRoleFor } from "@/lib/staff-access";
import { unitIdsFromRange } from "@/lib/units";
import { findDownloadableDocument, findUnitByCode, submitReport } from "@/server/customer";
import { SERVER_UPLOAD_LIMIT } from "@/lib/files";
import { saveFile } from "@/lib/storage";
import {
  addDocument,
  addUploadedDocument,
  createLot,
  holdLot,
  publishLot,
  releaseHold,
  replaceDocument,
  replaceWithUploadedDocument,
} from "@/server/lots";
import { createProduct } from "@/server/products";
import { listReports, markReviewed, reportsCsv } from "@/server/reports";
import { grantAccess, revokeAccess } from "@/server/staff-admin";
import { addUnits, voidUnit } from "@/server/units";
import { pdf, resetDatabase } from "@/test/db";

const actor = "qa@neoregenlab.com";
const client = { ip: "203.0.113.7", userAgent: "vitest" };

function reportInput(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = {
    facilityName: "St. Mary's", facilityCity: "Tampa", facilityState: "FL", submitterName: "Jane Doe",
    submitterTitle: "", submitterEmail: "jane@example.org", submitterPhone: "", physicianName: "Dr. Smith",
    dateOfUse: "2026-11-02", disposition: "IMPLANTED", adverseEvent: "no", adverseEventDetails: "",
    comments: "", attest: "on", ...overrides,
  };
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  const parsed = parseReport(data);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.data;
}

async function lotWithUnits(count = 3) {
  const product = await createProduct(actor, { code: "NEO-AM-2X3", name: "Amnion patch 2x3 cm", description: "", storage: "" });
  if (!product.ok) throw new Error(product.error);
  const lot = await createLot(actor, { lotNumber: "nb260001", productId: product.id, expirationDate: "2028-11-01" });
  if (!lot.ok) throw new Error(lot.error);
  const ids = unitIdsFromRange("NB260001", 1, count);
  if (!ids.ok) throw new Error(ids.error);
  const added = await addUnits(actor, lot.id, ids.unitIds);
  if (!added.ok) throw new Error(added.error);
  const units = await db.unit.findMany({ where: { lotId: lot.id }, orderBy: { unitId: "asc" } });
  return { productId: product.id, lotId: lot.id, units };
}

beforeEach(resetDatabase);

describe("lots", () => {
  it("normalize the lot number and refuse duplicates", async () => {
    const { productId } = await lotWithUnits(1);
    const lot = await db.lot.findFirstOrThrow();
    expect(lot.lotNumber).toBe("NB260001");
    const again = await createLot(actor, { lotNumber: "NB260001", productId, expirationDate: "2028-11-01" });
    expect(again).toEqual({ ok: false, error: "Lot NB260001 already exists." });
  });

  it("can't be published without a document, then publish, hold and release", async () => {
    const { lotId } = await lotWithUnits(1);
    expect(await publishLot(actor, lotId)).toEqual({ ok: false, error: expect.stringContaining("document") });

    expect((await addDocument(actor, lotId, { type: "COA", title: "Certificate of Analysis" }, pdf())).ok).toBe(true);
    expect(await publishLot(actor, lotId)).toEqual({ ok: true });
    expect(await publishLot(actor, lotId)).toEqual({ ok: false, error: expect.any(String) });

    expect((await holdLot(actor, lotId, "  ")).ok).toBe(false);
    expect(await holdLot(actor, lotId, "Customer complaint under review")).toEqual({ ok: true });
    expect(await releaseHold(actor, lotId, "Investigation closed")).toEqual({ ok: true });
    expect((await db.lot.findUniqueOrThrow({ where: { id: lotId } })).status).toBe("PUBLISHED");

    const actions = (await db.auditLog.findMany({ where: { entityId: lotId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["lot.create", "unit.add", "lot.publish", "lot.hold", "lot.release_hold"]);
  });

  it("refuse files that aren't PDF or images", async () => {
    const { lotId } = await lotWithUnits(1);
    const exe = { name: "x.exe", type: "application/x-msdownload", bytes: Buffer.from("MZ") };
    expect(await addDocument(actor, lotId, { type: "COA", title: "CoA" }, exe)).toEqual({ ok: false, error: expect.stringContaining("PDF") });
    const big = { name: "big.pdf", type: "application/pdf", bytes: Buffer.alloc(SERVER_UPLOAD_LIMIT + 1) };
    expect(await addDocument(actor, lotId, { type: "COA", title: "CoA" }, big)).toEqual({ ok: false, error: expect.stringContaining("4 MB") });
  });
});

describe("documents", () => {
  it("are replaced by a new version and the old one is kept but hidden", async () => {
    const { lotId, units } = await lotWithUnits(1);
    const first = await addDocument(actor, lotId, { type: "STERILITY", title: "Sterility" }, pdf("v1.pdf"));
    if (!first.ok) throw new Error(first.error);
    await publishLot(actor, lotId);

    expect((await replaceDocument(actor, first.id, "", pdf("v2.pdf"))).ok).toBe(false);
    const second = await replaceDocument(actor, first.id, "Corrected lab report", pdf("v2.pdf"));
    if (!second.ok) throw new Error(second.error);
    expect(await replaceDocument(actor, first.id, "again", pdf("v3.pdf"))).toEqual({ ok: false, error: expect.stringContaining("already replaced") });

    const all = await db.lotDocument.findMany({ orderBy: { version: "asc" } });
    expect(all.map((d) => [d.version, d.supersededAt !== null])).toEqual([[1, true], [2, false]]);

    const code = units[0].accessCode;
    expect(await findDownloadableDocument(code, first.id)).toBeNull();
    expect((await findDownloadableDocument(code, second.id))?.document.fileName).toBe("v2.pdf");
  });
});

describe("documents the browser sent straight to storage", () => {
  const uuid = "123e4567-e89b-42d3-a456-426614174000";
  const coa = { type: "COA", title: "Certificate of Analysis" };

  it("are recorded only once storage confirms them, and only for their own lot", async () => {
    const { lotId } = await lotWithUnits(1);
    const key = `lots/${lotId}/${uuid}-big-report.pdf`;
    expect(await addUploadedDocument(actor, lotId, coa, key)).toEqual({ ok: false, error: expect.stringContaining("didn't arrive") });

    const size = SERVER_UPLOAD_LIMIT + 1024;
    await saveFile(key, Buffer.alloc(size), "application/pdf");
    expect((await addUploadedDocument(actor, lotId, coa, key)).ok).toBe(true);
    const doc = await db.lotDocument.findFirstOrThrow();
    expect([doc.fileName, doc.size, doc.contentType, doc.storageKey]).toEqual(["big-report.pdf", size, "application/pdf", key]);

    expect(await addUploadedDocument(actor, lotId, coa, key)).toEqual({ ok: false, error: "That file is already recorded." });
    for (const other of [`lots/clotherlot/${uuid}-big-report.pdf`, `lots/${lotId}/../${uuid}-big-report.pdf`, `lots/${lotId}/big-report.pdf`]) {
      expect(await addUploadedDocument(actor, lotId, coa, other)).toEqual({ ok: false, error: expect.stringContaining("doesn't belong") });
    }
  });

  it("replace a document as its next version", async () => {
    const { lotId } = await lotWithUnits(1);
    const first = await addDocument(actor, lotId, coa, pdf("v1.pdf"));
    if (!first.ok) throw new Error(first.error);
    const key = `lots/${lotId}/${uuid}-v2-large.pdf`;
    await saveFile(key, Buffer.alloc(SERVER_UPLOAD_LIMIT + 1), "application/pdf");

    const second = await replaceWithUploadedDocument(actor, first.id, "Full lab report", key);
    expect(second.ok).toBe(true);
    const versions = await db.lotDocument.findMany({ orderBy: { version: "asc" } });
    expect(versions.map((d) => [d.version, d.fileName, d.supersededAt !== null])).toEqual([
      [1, "v1.pdf", true],
      [2, "v2-large.pdf", false],
    ]);
  });
});

describe("units and codes", () => {
  it("get distinct random codes and can't be added twice", async () => {
    const { lotId, units } = await lotWithUnits(5);
    expect(new Set(units.map((u) => u.accessCode)).size).toBe(5);
    expect(units.every((u) => u.accessCode.length === 12)).toBe(true);
    const again = await addUnits(actor, lotId, ["NB260001-0005", "NB260001-0006"]);
    expect(again).toEqual({ ok: false, error: "Already added: NB260001-0005" });
    expect(await db.unit.count()).toBe(5);
  });

  it("refuse unit IDs from another lot", async () => {
    const { lotId } = await lotWithUnits(1);
    expect((await addUnits(actor, lotId, ["NB999999-0001"])).ok).toBe(false);
  });

  it("show no documents while the lot is a draft", async () => {
    const { lotId, units } = await lotWithUnits(1);
    const doc = await addDocument(actor, lotId, { type: "COA", title: "CoA" }, pdf());
    if (!doc.ok) throw new Error(doc.error);
    const code = units[0].accessCode.toLowerCase().replace(/(.{4})/g, "$1-").slice(0, -1);

    expect((await findUnitByCode(code))?.documents).toEqual([]);
    expect(await findDownloadableDocument(code, doc.id)).toBeNull();
    await publishLot(actor, lotId);
    expect((await findUnitByCode(code))?.documents.map((d) => d.id)).toEqual([doc.id]);
  });

  it("lookups by an unknown or malformed code find nothing", async () => {
    await lotWithUnits(1);
    expect(await findUnitByCode("AAAAAAAAAAAA")).toBeNull();
    expect(await findUnitByCode("NB260001-0001")).toBeNull();
  });
});

describe("utilization reports", () => {
  it("are accepted once per unit", async () => {
    const { units } = await lotWithUnits(1);
    const code = units[0].accessCode;
    const first = await submitReport(code, reportInput(), client);
    expect(first.ok).toBe(true);
    expect(await submitReport(code, reportInput(), client)).toEqual({ ok: false, reason: "ALREADY_SUBMITTED" });
    expect(await db.utilizationReport.count()).toBe(1);
    expect(await db.accessEvent.count({ where: { kind: "REPORT_SUBMITTED" } })).toBe(1);
  });

  it("are accepted once even when two arrive together", async () => {
    const { units } = await lotWithUnits(1);
    const code = units[0].accessCode;
    const results = await Promise.all(Array.from({ length: 5 }, () => submitReport(code, reportInput(), client)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.utilizationReport.count()).toBe(1);
  });

  it("are refused for a void unit, and a reported unit can't be voided", async () => {
    const { units } = await lotWithUnits(2);
    expect((await voidUnit(actor, units[0].id, "")).ok).toBe(false);
    expect(await voidUnit(actor, units[0].id, "Label misprinted")).toEqual({ ok: true });
    expect(await submitReport(units[0].accessCode, reportInput(), client)).toEqual({ ok: false, reason: "VOID" });

    await submitReport(units[1].accessCode, reportInput(), client);
    expect(await voidUnit(actor, units[1].id, "Too late")).toEqual({ ok: false, error: expect.stringContaining("report") });
  });

  it("are reviewed once and export safely to CSV", async () => {
    const { units } = await lotWithUnits(1);
    const submitted = await submitReport(units[0].accessCode, reportInput({ comments: "=HYPERLINK(\"x\")", adverseEvent: "yes", adverseEventDetails: "Redness, \"mild\"" }), client);
    if (!submitted.ok) throw new Error(submitted.reason);

    expect(await markReviewed(actor, submitted.reportId)).toEqual({ ok: true });
    expect((await markReviewed(actor, submitted.reportId)).ok).toBe(false);

    const csv = reportsCsv(await listReports({}));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"Redness, ""mild"""`);
    expect(await listReports({ show: "unreviewed" })).toHaveLength(0);
    expect(await listReports({ show: "adverse" })).toHaveLength(1);
    expect(await listReports({ q: "st. mary" })).toHaveLength(1);
  });
});

describe("staff access", () => {
  it("is limited to the staff domain and an active row, with bootstrap admins", async () => {
    expect(await staffRoleFor("boss@neoregenlab.com")).toBe("ADMIN");
    expect(await staffRoleFor("tech@neoregenlab.com")).toBeNull();
    expect((await grantAccess("boss@neoregenlab.com", { email: "tech@gmail.com", role: "STAFF" })).ok).toBe(false);

    expect(await grantAccess("boss@neoregenlab.com", { email: "Tech@NeoRegenLab.com", role: "STAFF" })).toEqual({ ok: true });
    expect(await staffRoleFor("tech@neoregenlab.com")).toBe("STAFF");

    expect(await revokeAccess("boss@neoregenlab.com", "tech@neoregenlab.com")).toEqual({ ok: true });
    expect(await staffRoleFor("tech@neoregenlab.com")).toBeNull();
    expect((await revokeAccess("tech@neoregenlab.com", "tech@neoregenlab.com")).ok).toBe(false);
  });
});
