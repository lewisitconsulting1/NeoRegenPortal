import { execFileSync } from "node:child_process";

// Brings the test database up to the current migrations before any test runs.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://portal:portal@localhost:5432/portal_test";
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
