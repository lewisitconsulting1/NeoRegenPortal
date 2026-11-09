import QRCode from "qrcode";
import { config } from "@/lib/config";

export function unitUrl(accessCode: string): string {
  return `${config.publicBaseUrl}/u/${accessCode}`;
}

/** An SVG string with no quiet zone; the card layout adds the margin. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}
