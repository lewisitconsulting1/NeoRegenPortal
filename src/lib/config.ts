// Settings read from the environment. See .env.example for what each one does.

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const config = {
  /** Origin printed into QR codes, e.g. https://verify.neoregenlab.com */
  get publicBaseUrl() {
    return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  },
  /** Only Google accounts on this domain can sign in to the admin area. */
  get staffEmailDomain() {
    return (process.env.STAFF_EMAIL_DOMAIN ?? "neoregenlab.com").toLowerCase();
  },
  /** Admins who need no StaffAccess row, so the first admin can add the rest. */
  get bootstrapAdminEmails() {
    return list(process.env.BOOTSTRAP_ADMIN_EMAILS);
  },
  /** Where new-report and adverse-event emails go. */
  get qaEmails() {
    return list(process.env.QA_EMAIL);
  },
  /** Email + password sign-in for local development. Never on in production. */
  get devLoginEnabled() {
    return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "1";
  },
};
