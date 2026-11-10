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
