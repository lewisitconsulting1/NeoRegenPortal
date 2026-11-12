import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { reportPdf, reportPdfFileName } from "@/server/report-pdf";
import type { ReportWithUnit } from "@/server/reports";

function report(overrides: Partial<ReportWithUnit> = {}): ReportWithUnit {
  const lot = {
    id: "lot1",
    lotNumber: "NB260001",
    productId: "p1",
    expirationDate: new Date("2028-10-31T00:00:00Z"),
    status: "PUBLISHED",
    holdReason: null,
    publishedAt: null,
    publishedBy: null,
    createdBy: "qa@neoregenlab.com",
    createdAt: new Date(),
    updatedAt: new Date(),
    product: {
      id: "p1",
      code: "NEO-AM-2X3",
      name: "Amniotic membrane allograft, 2 x 3 cm",
      description: null,
      storage: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  const unit = {
    id: "u1",
    unitId: "NB260001-0001",
    lotId: "lot1",
    accessCode: "K7QF3MZP9TXA",
    shippedTo: null,
    voidedAt: null,
    voidReason: null,
    voidedBy: null,
    createdBy: "qa@neoregenlab.com",
    createdAt: new Date(),
    updatedAt: new Date(),
    lot,
  };
  return {
    id: "rep_123",
    unitId: "u1",
    facilityName: "St. Mary's Medical Center",
    facilityCity: "Tampa",
    facilityState: "FL",
    submitterName: "Jordan Lee",
    submitterTitle: "OR charge nurse",
    submitterEmail: "jordan@example.org",
    submitterPhone: null,
    physicianName: "Dr. A. Rivera",
    dateOfUse: new Date("2026-11-06T00:00:00Z"),
    disposition: "IMPLANTED",
    adverseEvent: false,
    adverseEventDetails: null,
    comments: null,
    submittedAt: new Date("2026-11-07T15:30:00Z"),
    submitterIp: null,
    submitterUserAgent: null,
    reviewedAt: null,
    reviewedBy: null,
    unit,
    ...overrides,
  } as ReportWithUnit;
}

describe("report PDF", () => {
  it("is a one-page PDF titled with the unit ID", async () => {
    const doc = await PDFDocument.load(await reportPdf(report()));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Tissue Utilization Record NB260001-0001");
    expect(reportPdfFileName(report())).toBe("NeoRegen-Utilization-Report-NB260001-0001.pdf");
  });

  it("prints characters the PDF font can't draw as ? instead of failing", async () => {
    const bytes = await reportPdf(
      report({ facilityName: "Hôpital Saint-Éloi 🏥 東京", comments: "Line one\nLine two → done ✓" }),
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("flows long text onto more pages and breaks words longer than a line", async () => {
    const long = Array.from({ length: 400 }, (_, i) => `sentence ${i} about the procedure.`).join(" ");
    const bytes = await reportPdf(
      report({
        adverseEvent: true,
        adverseEventDetails: "x".repeat(600),
        comments: long,
        reviewedAt: new Date("2026-11-08T12:00:00Z"),
        reviewedBy: "qa@neoregenlab.com",
      }),
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});
