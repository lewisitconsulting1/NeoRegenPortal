import type { LotStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui";
import { LOT_STATUS_LABELS } from "@/lib/labels";

const TONES = { DRAFT: "gray", PUBLISHED: "green", ON_HOLD: "red" } as const;

export function LotStatusBadge({ status }: { status: LotStatus }) {
  return <Badge tone={TONES[status]}>{LOT_STATUS_LABELS[status]}</Badge>;
}
