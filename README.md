# Invoicing App

Inventory + invoicing app. Next.js (App Router) + Prisma + Postgres (Neon).

## Setup

1. `npm install`
2. Create a project at https://neon.tech, copy the Prisma-formatted connection
   string, and put it in `.env` (copy `.env.example` first).
3. `npx prisma migrate dev --name init` — creates all tables in your Neon database.
4. `npx prisma db seed` — seeds the 13 provincial tax rates.
5. `npm run dev` — app runs at http://localhost:3000

## What's built so far

- Full schema (`prisma/schema.prisma`) — Products, Stock_Transactions,
  Provinces_Tax_Rates, Customers, Invoices, Invoice_Line_Items. Updated to
  match CNC Grease & Lubricants' real invoice format: separate Activity +
  Description fields per line, structured customer address, an optional
  other-charges line (e.g. freight — mechanics still TBD with the client),
  plain sequential invoice numbering, and a per-invoice footer note.
- Calculation helpers (`lib/calculations.ts`) — current stock, line totals,
  invoice subtotal/tax/total (now including other charges in the tax base,
  matching the client's real math), tax type label, invoice numbering.
- All core API routes: `products`, `customers`, `stock-transactions`,
  `invoices` (creating an invoice also auto-deducts stock per line item,
  same behavior as the AppSheet action).
- PWA manifest (`public/manifest.json`) so this can be installed to a phone's
  home screen. Still needs real `icon-192.png` / `icon-512.png` files —
  placeholder references are already wired into the manifest.

## Deployment

Using **AWS Amplify Hosting** instead of Vercel — at this app's traffic level
(occasional use by one client), Amplify's pay-per-use Lambda-based billing
comes out to roughly $0–2/month, versus Vercel's flat $20/month Pro tier
(required once this is used commercially, per their ToS). Neon stays exactly
the same either way — it's already pay-per-use regardless of where the app
runs.

1. Push this repo to GitHub.
2. AWS Amplify Console → **New app → Host web app** → connect the repo.
   Amplify auto-detects it as a Next.js SSR app.
3. App settings → **Environment variables** → add `DATABASE_URL` (your Neon
   connection string).
4. Amplify runs `npm run build` by default. Add a `postinstall` step (or a
   custom line in the Amplify build settings) to also run
   `npx prisma generate && npx prisma migrate deploy` so schema changes apply
   automatically on every deploy.
5. Deploy — you get a live HTTPS URL (`https://<branch>.<app-id>.amplifyapp.com`)
   immediately. Add a custom domain (e.g. `invoicing.cnclubricants.com`) for
   free under **Domain management** if the client wants their own link.

**Known trade-offs at this traffic level:**
- Cold starts are the norm, not the exception — expect roughly 1–4s on most
  requests, since there's rarely enough traffic to keep the function warm.
  Only dynamic pages/API calls are affected; the PWA manifest and service
  worker are static files served straight from the CDN, so "Add to Home
  Screen" and app-shell loading stay fast regardless.
- A few Next.js features aren't supported on Amplify's SSR runtime (on-demand
  ISR, streaming, full edge middleware) — none of which this app uses, so
  it's a non-issue here.

## Product catalog

Products now match CNC's real structure: `sku` (Product ID), `name`, `variant`,
`packageType` (Drum/Keg/Bucket/Pack/Jug/Tank), `packageSize` (quantity of
`unit` per package), `unit` (KG/L), and optional `unitsPerBox`/`boxesPerSkid`
for products sold up to a box or skid level. Price is intentionally **not**
set when adding a product — it's decided per invoice, never at the catalog
level. Stock is entered at any of four levels (base unit, package, box, skid)
and converted down to base units automatically — see `lib/calculations.ts`.

The real 30-product catalog is in `prisma/products-seed-data.ts` and gets
loaded by `npx prisma db seed` alongside the province tax rates.

## Not built yet

- Actual UI pages (Inventory, Stock entry, Invoice builder — reusing the
  live-preview + PDF-export pattern from the Pinewrap invoice tool, styled
  to match CNC's real invoice layout/branding)
- Real branding (currently placeholder navy/yellow in `tailwind.config.ts` —
  waiting on the actual logo file and brand colors)
- Auth (currently none — add before this touches real client data over the
  open internet)
- Decide: starting invoice number, and how the other-charges/freight line
  actually works (manual entry vs. a fixed rule) — both deferred by the client
