import nodemailer, { type Transporter } from "nodemailer";

// Sends through SMTP when SMTP_HOST is set (Google Workspace: smtp.gmail.com
// with an App Password, the same setup as the tissue tracker), otherwise
// through Resend's HTTP API when RESEND_API_KEY is set. With neither, the
// message is logged instead, so local development needs no mail account.

export type Mail = {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
};

let transport: Transporter | undefined;

function smtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transport ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    // Port 587 starts plain and upgrades with STARTTLS; 465 is TLS from the start.
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export async function sendEmail(mail: Mail): Promise<void> {
  if (mail.to.length === 0) return;

  const smtp = smtpTransport();
  if (smtp) {
    // Gmail sends as the signed-in account (or one of its "Send mail as"
    // aliases) whatever From says, so From defaults to that account.
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    await smtp.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, replyTo: mail.replyTo });
    return;
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email not sent: no SMTP_HOST or RESEND_API_KEY] to=${mail.to.join(", ")} subject="${mail.subject}"`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      reply_to: mail.replyTo,
    }),
  });
  if (!response.ok) {
    throw new Error(`Email to ${mail.to.join(", ")} failed: ${response.status} ${await response.text()}`);
  }
}
