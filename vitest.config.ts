import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://portal:portal@localhost:5432/portal_test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      LOCAL_STORAGE_DIR: path.join(os.tmpdir(), "neoregen-portal-test-uploads"),
      STAFF_EMAIL_DOMAIN: "neoregenlab.com",
      BOOTSTRAP_ADMIN_EMAILS: "boss@neoregenlab.com",
      PUBLIC_BASE_URL: "https://verify.example.test",
      QA_EMAIL: "",
      RESEND_API_KEY: "",
      SMTP_HOST: "",
      BLOB_READ_WRITE_TOKEN: "",
      BLOB_STORE_ID: "",
    },
    // The database tests share one Postgres database and reset it per test.
    fileParallelism: false,
  },
});
