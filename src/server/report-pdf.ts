import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { config } from "@/lib/config";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DISPOSITION_LABELS } from "@/lib/labels";
import type { ReportWithUnit } from "@/server/reports";

// A one-page (or more, for long comments) PDF copy of a utilization report:
// attached to the receipt and the QA notice, and downloadable by staff.

const PAGE = { width: 612, height: 792, margin: 54 }; // US Letter, 0.75" margins
const LABEL_WIDTH = 150;
const INK = rgb(0.05, 0.05, 0.05);
const QUIET = rgb(0.42, 0.42, 0.42);
const GOLD = rgb(0.757, 0.612, 0.376); // #C19C60
const RED = rgb(0.7, 0.1, 0.1);

type Row = [label: string, value: string | null | undefined];

export function reportPdfFileName(report: ReportWithUnit): string {
  return `NeoRegen-Utilization-Report-${report.unit.unitId}.pdf`;
}

export async function reportPdf(report: ReportWithUnit): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tissue Utilization Record ${report.unit.unitId}`);
  pdf.setAuthor("NeoRegen Biosciences");
  pdf.setSubject(`Lot ${report.unit.lot.lotNumber}`);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const writer = new Writer(pdf, regular, bold);

  writer.header(report);
  writer.section("Product", [
    ["Unit ID", report.unit.unitId],
    ["Lot", report.unit.lot.lotNumber],
    ["Product", `${report.unit.lot.product.name} (${report.unit.lot.product.code})`],
    ["Expiration", formatDate(report.unit.lot.expirationDate)],
  ]);
  writer.section("Use", [
    ["Date of use", formatDate(report.dateOfUse)],
    ["Disposition", DISPOSITION_LABELS[report.disposition]],
    ["Physician", report.physicianName],
  ]);
  writer.section("Facility", [
    ["Name", report.facilityName],
    ["Location", `${report.facilityCity}, ${report.facilityState}`],
  ]);
  writer.section("Submitted by", [
    ["Name", report.submitterName],
    ["Title", report.submitterTitle],
    ["Email", report.submitterEmail],
    ["Phone", report.submitterPhone],
  ]);
  writer.section(
    "Adverse event",
    report.adverseEvent ? [["Reported", "Yes"], ["Details", report.adverseEventDetails]] : [["Reported", "No"]],
    report.adverseEvent,
  );
  if (report.comments) writer.section("Comments", [["Comments", report.comments]]);
  writer.footer(report);

  return pdf.save();
}

class Writer {
  private page: PDFPage;
  private y: number;
  // Standard PDF fonts only cover Latin-1-ish text; anything else prints as "?".
  private encodable = new Map<string, boolean>();

  constructor(
    private pdf: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = pdf.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - PAGE.margin;
  }

  header(report: ReportWithUnit) {
    this.text("NeoRegen Biosciences", PAGE.margin, this.y - 16, 16, this.bold, INK);
    this.text("Tissue Utilization Record", PAGE.margin, this.y - 34, 12, this.regular, QUIET);
    const right = PAGE.width - PAGE.margin;
    const ref = `Reference ${report.id}`;
    const when = `Submitted ${formatDateTime(report.submittedAt)}`;
    this.text(ref, right - this.width(ref, 9, this.regular), this.y - 16, 9, this.regular, QUIET);
    this.text(when, right - this.width(when, 9, this.regular), this.y - 30, 9, this.regular, QUIET);
    this.y -= 46;
    this.page.drawRectangle({ x: PAGE.margin, y: this.y, width: PAGE.width - 2 * PAGE.margin, height: 1.5, color: GOLD });
    this.y -= 22;
  }

  section(title: string, rows: Row[], alert = false) {
    this.ensure(40);
    this.text(title.toUpperCase(), PAGE.margin, this.y, 9, this.bold, alert ? RED : GOLD);
    this.y -= 16;
    for (const [label, value] of rows) this.row(label, value ?? "—");
    this.y -= 10;
  }

  footer(report: ReportWithUnit) {
    const host = new URL(config.publicBaseUrl).host;
    const lines = [
      `Submitted through ${host} on ${formatDateTime(report.submittedAt)}.`,
      report.reviewedAt ? `Reviewed by NeoRegen ${formatDateTime(report.reviewedAt)} (${report.reviewedBy}).` : null,
    ].filter((l): l is string => Boolean(l));
    this.ensure(14 * lines.length + 16);
    this.y -= 6;
    this.page.drawRectangle({ x: PAGE.margin, y: this.y, width: PAGE.width - 2 * PAGE.margin, height: 0.5, color: QUIET });
    this.y -= 14;
    for (const line of lines) {
      this.text(line, PAGE.margin, this.y, 8.5, this.regular, QUIET);
      this.y -= 12;
    }
  }

  private row(label: string, value: string) {
    const size = 10.5;
    const lineHeight = 14;
    const valueX = PAGE.margin + LABEL_WIDTH;
    const lines = this.wrap(value, PAGE.width - PAGE.margin - valueX, size);
    this.ensure(lineHeight);
    this.text(label, PAGE.margin, this.y, 9, this.regular, QUIET);
    lines.forEach((line, i) => {
      if (i > 0) {
        this.y -= lineHeight;
        this.ensure(lineHeight);
      }
      this.text(line, valueX, this.y, size, this.regular, INK);
    });
    this.y -= lineHeight + 4;
  }

  /** Starts a new page when fewer than `needed` points remain. */
  private ensure(needed: number) {
    if (this.y - needed >= PAGE.margin) return;
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - PAGE.margin;
  }

  private text(text: string, x: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
    this.page.drawText(this.clean(text, font), { x, y, size, font, color });
  }

  private width(text: string, size: number, font: PDFFont): number {
    return font.widthOfTextAtSize(this.clean(text, font), size);
  }

  private clean(text: string, font: PDFFont): string {
    let out = "";
    for (const ch of text.replace(/\t/g, " ")) {
      let ok = this.encodable.get(ch);
      if (ok === undefined) {
        try {
          font.widthOfTextAtSize(ch, 10);
          ok = true;
        } catch {
          ok = false;
        }
        this.encodable.set(ch, ok);
      }
      out += ok ? ch : "?";
    }
    return out;
  }

  /** Word-wraps each paragraph to `maxWidth`, breaking words longer than a line. */
  private wrap(text: string, maxWidth: number, size: number): string[] {
    const lines: string[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const paragraph = this.clean(raw, this.regular);
      let line = "";
      for (const word of paragraph.split(/ +/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.regular.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        let rest = word;
        while (this.regular.widthOfTextAtSize(rest, size) > maxWidth) {
          let cut = rest.length - 1;
          while (cut > 1 && this.regular.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }
}
