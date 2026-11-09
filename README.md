# NeoRegen product portal

Customers scan the QR code on a card packed with each NeoRegen unit. The page it opens shows the unit's lot documents and takes the tissue utilization report. NeoRegen staff run it from a signed-in admin area: they create lots, upload documents, add units, print the QR cards and review reports.

It is standalone: nothing connects to the tissue tracker on the lab Mac mini. Staff enter lots, units and documents by hand.

## How it works

**Customers** (no account):

- `/u/<code>`: the unit page. Product, unit ID, lot, expiration, the lot's published documents, and a button to report. The 12-character random code in the QR is the only key.
- `/u/<code>/report`: the utilization report. One per unit; the database refuses a second.
- `/lookup`: unit ID plus code, for when a QR won't scan.

**Staff** (`/admin`, Google sign-in on the staff domain, listed under Users):

- **Lots:** create (draft), upload documents, publish, put on hold. Replacing a document adds a new version; the old one is kept.
- **Units:** add by range or pasted list, each with its own random code. Print QR cards on Avery 5160 labels. Void a unit printed in error.
- **Reports:** list, search, mark reviewed, export CSV. Adverse events are flagged and emailed to QA.
- **Users** (admins): who can sign in, and as Admin or Staff. **Audit log:** every staff change.

Nothing is deleted. Every staff change writes an audit entry in the same transaction. Customer page views, downloads and failed lookups are logged by IP, and failed lookups are rate-limited (20 per 15 minutes per IP).

## Local development

Needs Node 22.12+ and Postgres.

```sh
npm install                      # .npmrc sets legacy-peer-deps (npm bug with optional peers)
cp .env.example .env             # then set BOOTSTRAP_ADMIN_EMAILS
createdb portal_dev
npx prisma migrate dev
npm run dev                      # http://localhost:3000
```

With `ALLOW_DEV_LOGIN=1`, `/login` also offers email and password sign-in, so you don't need Google locally. The email must still be on the staff domain and be a bootstrap admin or on the Users list. Uploaded files go to `.data/uploads`, and emails are printed to the console.

```sh
npm test            # unit tests + database tests (needs a portal_test database, or TEST_DATABASE_URL)
npm run lint
npm run typecheck
npm run build
```

## Deploying on Vercel

1. **Import** this repo into a Vercel team on the **Pro** plan (the free plan is non-commercial only).
2. **Storage → Create → Neon (Postgres).** Connect it to the project; it sets `DATABASE_URL`.
3. **Storage → Create → Blob.** Choose private access and connect it; it sets `BLOB_READ_WRITE_TOKEN`.
4. **Google sign-in.** In Google Cloud Console → APIs & Services:
   - OAuth consent screen: User type **Internal**, so only NeoRegen Workspace accounts can use it.
   - Credentials → Create OAuth client ID → Web application. Authorized redirect URI: `https://verify.neoregenlab.com/api/auth/callback/google`.
5. **Environment variables** (Settings → Environment Variables), from `.env.example`:
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `PUBLIC_BASE_URL` (both `https://verify.neoregenlab.com`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STAFF_EMAIL_DOMAIN`, `BOOTSTRAP_ADMIN_EMAILS`, `QA_EMAIL`, `SUPPORT_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM`. Leave `ALLOW_DEV_LOGIN` unset.
6. **Domain.** Vercel → Settings → Domains → add `verify.neoregenlab.com`. In Hostinger's DNS for neoregenlab.com, add the CNAME record Vercel shows.
7. **Email.** In Resend, add and verify neoregenlab.com (it gives DNS records to add at Hostinger), then create an API key.
8. **Deploy.** The `vercel-build` script applies database migrations, then builds.

Set `PUBLIC_BASE_URL` to the final domain before printing any cards: it is printed into every QR code.

## Code map

- `src/app/u/[code]/`: customer pages. All customer data access goes through `src/server/customer.ts`.
- `src/app/admin/`: staff pages; `actions.ts` holds the server actions, each checking the signed-in staff member first.
- `src/server/`: business rules (lots, documents, units, reports, staff access), tested against Postgres in `flows.test.ts`.
- `src/lib/`: access codes, unit IDs, the report form's validation, storage, email, auth.
- `prisma/schema.prisma`: the data model.

## Not built yet

- Uploads larger than 4 MB (Vercel's request limit). Direct uploads to Blob from the browser would lift it.
- PDF copy of the report in the receipt email (the receipt is plain text for now).
- Staff corrections to a submitted report, with a reason and the original kept.
- Matching the report fields to the paper tissue utilization form.
