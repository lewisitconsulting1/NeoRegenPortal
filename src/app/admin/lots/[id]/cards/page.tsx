import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, link, PageHeader } from "@/components/ui";
import { config } from "@/lib/config";
import { formatAccessCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { qrSvg, unitUrl } from "@/lib/qr";
import { requireStaff } from "@/lib/staff";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "QR cards" };

// Avery 5160 / 8160 address labels: 30 per US letter sheet, 3 across and
// 10 down, each 2-5/8" x 1". The sheet is laid out in inches so it prints
// at true size with the browser's scale at 100% and margins set to none.
const PER_SHEET = 30;

export default async function CardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ only?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { only } = await searchParams;
  const lot = await db.lot.findUnique({ where: { id }, include: { product: true } });
  if (!lot) notFound();

  const units = await db.unit.findMany({
    where: { lotId: id, voidedAt: null, ...(only === "unreported" ? { report: null } : {}) },
    orderBy: { unitId: "asc" },
  });
  const cards = await Promise.all(units.map(async (u) => ({ ...u, svg: await qrSvg(unitUrl(u.accessCode)) })));
  const sheets: (typeof cards)[] = [];
  for (let i = 0; i < cards.length; i += PER_SHEET) sheets.push(cards.slice(i, i + PER_SHEET));
  const host = new URL(config.publicBaseUrl).host;

  return (
    <>
      <div className="print:hidden">
        <Link href={`/admin/lots/${lot.id}/units`} className={`${link} text-sm`}>
          ← Units in lot {lot.lotNumber}
        </Link>
        <div className="mt-3">
          <PageHeader
            title={`QR cards for lot ${lot.lotNumber}`}
            subtitle={`${cards.length} cards on ${sheets.length} sheet${sheets.length === 1 ? "" : "s"} of Avery 5160 labels. In the print dialog, set margins to None and scale to 100%.`}
            actions={cards.length > 0 ? <PrintButton /> : null}
          />
        </div>
      </div>

      {cards.length === 0 ? (
        <Empty>No units to print.</Empty>
      ) : (
        <div className="space-y-6 overflow-x-auto print:space-y-0 print:overflow-visible">
          {sheets.map((sheet, s) => (
            <div
              key={s}
              className="mx-auto bg-white shadow-md ring-1 ring-slate-200 print:shadow-none print:ring-0"
              style={{
                width: "8.5in",
                height: "11in",
                padding: "0.5in 0.1875in",
                display: "grid",
                gridTemplateColumns: "repeat(3, 2.625in)",
                gridAutoRows: "1in",
                columnGap: "0.125in",
                breakAfter: s < sheets.length - 1 ? "page" : "auto",
              }}
            >
              {sheet.map((card) => (
                <div key={card.id} className="flex items-center gap-[0.08in] overflow-hidden px-[0.1in] text-ink">
                  <div
                    className="size-[0.78in] shrink-0 [&>svg]:size-full"
                    dangerouslySetInnerHTML={{ __html: card.svg }}
                  />
                  <div className="min-w-0 leading-tight">
                    <p className="text-[7pt] font-bold tracking-wide uppercase">Scan to report use</p>
                    <p className="mt-[2pt] font-mono text-[9pt] font-bold">{card.unitId}</p>
                    <p className="font-mono text-[7pt]">Code {formatAccessCode(card.accessCode)}</p>
                    <p className="mt-[2pt] truncate text-[6pt] text-slate-600">
                      {lot.product.code} · {host}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
