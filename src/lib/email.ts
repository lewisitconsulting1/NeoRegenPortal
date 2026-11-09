// Sends through Resend's HTTP API. Without RESEND_API_KEY and EMAIL_FROM the
// message is logged instead, so local development needs no mail account.

export type Mail = {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail(mail: Mail): Promise<void> {
  if (mail.to.length === 0) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email not sent: RESEND_API_KEY or EMAIL_FROM unset] to=${mail.to.join(", ")} subject="${mail.subject}"`);
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
