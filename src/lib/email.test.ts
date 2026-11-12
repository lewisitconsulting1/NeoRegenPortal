import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn().mockResolvedValue({});
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const mail = { to: ["jane@example.org"], subject: "Receipt", text: "Thanks", replyTo: "qa@neoregenlab.com" };

describe("sendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMail.mockClear();
    createTransport.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends through SMTP with STARTTLS on 587 and From defaulting to the account", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("SMTP_USER", "alerts@neoregenlab.com");
    vi.stubEnv("SMTP_PASS", "app-password");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { sendEmail } = await import("@/lib/email");

    await sendEmail(mail);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "alerts@neoregenlab.com", pass: "app-password" },
    });
    expect(sendMail).toHaveBeenCalledWith({ from: "alerts@neoregenlab.com", ...mail });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("uses EMAIL_FROM when set, and TLS from the start when SMTP_SECURE is true", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_SECURE", "true");
    vi.stubEnv("SMTP_USER", "alerts@neoregenlab.com");
    vi.stubEnv("EMAIL_FROM", "NeoRegen <alerts@neoregenlab.com>");
    const { sendEmail } = await import("@/lib/email");

    await sendEmail(mail);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true, requireTLS: false }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "NeoRegen <alerts@neoregenlab.com>" }));
  });

  it("passes attachments to SMTP as buffers and to Resend as base64", async () => {
    const pdf = { filename: "report.pdf", content: new Uint8Array([37, 80, 68, 70]), contentType: "application/pdf" };

    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("SMTP_USER", "alerts@neoregenlab.com");
    let { sendEmail } = await import("@/lib/email");
    await sendEmail({ ...mail, attachments: [pdf] });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: "report.pdf", content: Buffer.from("%PDF"), contentType: "application/pdf" }],
      }),
    );

    vi.resetModules();
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "NeoRegen <portal@neoregenlab.com>");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    ({ sendEmail } = await import("@/lib/email"));
    await sendEmail({ ...mail, attachments: [pdf] });
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.attachments).toEqual([{ filename: "report.pdf", content: "JVBERg==" }]);
    fetchSpy.mockRestore();
  });

  it("logs instead of sending when nothing is configured", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { sendEmail } = await import("@/lib/email");

    await sendEmail(mail);

    expect(createTransport).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("email not sent"));
    info.mockRestore();
  });
});
