@AGENTS.md

# NeoRegen product portal

See README.md for what the app does and how to run it.

- Business rules live in `src/server/*.ts` and are tested against Postgres in `src/server/flows.test.ts`. Server actions (`src/app/admin/actions.ts`, `src/app/u/[code]/report/actions.ts`) stay thin: check the caller, call the rule, revalidate.
- Every admin page, route handler and server action checks the signed-in staff member itself (`requireStaff`, `requireAdmin`, `getStaff`). Hiding a button protects nothing.
- Nothing is deleted. Documents get new versions, units are voided, reports are kept. Every staff change writes an `AuditLog` row in the same transaction (`src/lib/audit.ts`).
- A unit's access code (`src/lib/codes.ts`) is the customer's only credential. It is random; never derive it from the unit ID, and never log it.
- Customers see a lot's documents only when the lot is not a draft, and only current versions (`findUnitByCode`).
- Date-only values (expiration, date of use) are UTC midnight; format them with `src/lib/dates.ts`.
- `npm install` relies on `legacy-peer-deps` in `.npmrc` (npm bug with better-auth's optional peers).
- Commands: `npm run dev`, `npm test` (needs Postgres), `npm run lint`, `npm run typecheck`, `npm run build`.
