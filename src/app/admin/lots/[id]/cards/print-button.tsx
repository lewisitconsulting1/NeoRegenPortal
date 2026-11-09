"use client";

import { button } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" className={button.primary} onClick={() => window.print()}>
      Print
    </button>
  );
}
