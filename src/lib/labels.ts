import type { Disposition, DocumentType, LotStatus } from "@/generated/prisma/enums";

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  IMPLANTED: "Implanted or applied",
  OPENED_NOT_USED: "Opened but not used",
  DISCARDED: "Discarded (damaged or expired)",
  RETURNED: "Returned to NeoRegen",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  COA: "Certificate of Analysis",
  STERILITY: "Sterility results",
  SEROLOGY: "Serology summary",
  IFU: "Instructions for use",
  OTHER: "Other",
};

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ON_HOLD: "On hold",
};
