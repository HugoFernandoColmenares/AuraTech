# AuraTech

AuraTech is a portfolio MVP of a sales intelligence workspace. It is a single-page application built with **Angular 19** (Signals, standalone components, OnPush). The default runtime is **demo mode**: authentication and report data live in `localStorage`, and live Supabase I/O is skipped. The same API layer can be pointed at a real Supabase project when demo mode is disabled.

The product scope is sales reporting and a simple SKU catalog. It does not include inventory, credit-card spend, marketplace channel parsers, or fashion-specific catalog taxonomies.

## What the application does

- **Custom Excel upload (sales only).** Any `.xlsx` / `.xls` layout is valid. After a file is chosen, a mapping wizard binds columns to sales fields (order id, SKU, quantity, total, date, and related attributes). Optional mapping templates can be saved for reuse.
- **Session then persist.** Parsed rows stay in the browser (`isLocal`) until **Export to DB**. In demo mode that write goes to `localStorage`; with live Supabase it bulk-upserts `sale_records`.
- **Analytics.** Sales Report exposes KPI cards, charts, and year-over-year comparisons. Date filters use the **audit period** (audit month/year), not necessarily the order date on the row.
- **Product catalog.** Products are flat text fields (`sku`, `parent`, `styleName`, `brand`, `type`, `collection`, `isActive`). There is no Excel import on Products; create, edit, deactivate, and Excel export remain available.
- **Roles.** User (read), Manager (create, edit, bulk upload), Admin (delete and administrative permissions). Demo login is seeded as an administrator.

## Demo credentials and URLs

Routing uses **hash location** (`HashLocationStrategy`). After `npm start`, open:

| Route | Hash URL |
| :--- | :--- |
| Login | `/#/auth/login` |
| Dashboard | `/#/layout/home` |
| Sales Report | `/#/layout/sales-report` |
| Products | `/#/layout/products` |
| About (in-app guide) | `/#/layout/about` |
| Profile | `/#/layout/profile` |

Default demo account:

- Email: `admin@auratech.dev`
- Password: `demo123`

Demo persistence keys (browser):

| Key | Purpose |
| :--- | :--- |
| `auratech.ls.*` | Entity store (sales, products, mappings) |
| `auratech.ls.seeded.v3` | Seed flag for demo catalog and sample sales |
| `auratech_users_v2` / `auratech_current_user_v2` | Mock auth users and current session |
| `auratech_access_token` | Client access token |

Clearing site data for `localhost` resets the demo.

## Data flow

| Stage | Behavior |
| :--- | :--- |
| Upload | User selects a workbook on Sales Report. Custom Excel maps columns and produces in-memory rows with `isLocal: true`. |
| Review | The Data table and Analytics views operate on the current dataset. The toolbar data-source indicator distinguishes session rows from persisted rows. |
| Persist | **Export to DB** writes pending session rows. Demo mode saves to `localStorage`; live mode upserts through `SaleRecordsApiService`. Sales rows are curated before persist (cancelled/refunded and duplicate summaries removed). |
| Read | Tables and analytics read from the same API facade. In demo mode that facade is backed by `LocalStorageEntityStore`. In live mode it uses PostgREST and optional analytics RPC. |

## Architecture

Feature screens follow a coordinator pattern:

- **Coordinator** (`sales-report`, `products`): owns filters, pagination, and orchestration of Excel and API services.
- **Analytics child**: KPIs, Chart.js panels, and pivot-style views.
- **Table child**: exploration, toolbar actions, and CRUD events.

Shared pieces include `EnvConfig`, `HealthService`, `ReportSessionCacheService`, `DataExportService`, `LoadingService`, role/permission guards, and the `hasPermission` directive.

Constants (tables, roles, permissions, pivot months, chart keys) live in `src/app/core/constants.ts`. Sales filtering, YoY helpers, and curation utilities live in `src/app/core/auxiliar/sales.util.ts`; chart grouping helpers live in `src/app/core/auxiliar/charts.util.ts`.

### Persistence modes

| Mode | When | Auth | Data |
| :--- | :--- | :--- | :--- |
| Demo (default) | `demoMode: true` in `environment.ts` | Mock users in `localStorage` | `LocalStorageEntityStore` |
| Live Supabase | `demoMode: false` and valid URL + anon key | Supabase Auth, `profiles` / `user_roles` | Tables listed below |

Relevant tables when live:

`sale_records`, `products`, `excel_mappings`, `roles`, `profiles`, `user_roles`.

Analytics may call `get_sales_analytics` when that RPC is deployed; otherwise the client falls back to a bounded fetch.

## Technical stack

| Area | Choice |
| :--- | :--- |
| Framework | Angular 19.2, Signals, standalone, zone.js |
| UI | PrimeNG 19 with `AuraTechPrimeNgPreset` (dark default, teal tokens, Figtree) |
| Charts | Chart.js |
| Excel | SheetJS (`xlsx`) via `CustomExcelMappingService` and related Excel services |
| Backend (optional) | `@supabase/supabase-js` |
| Tests | Karma / Jasmine (selected utilities and auth specs) |

Date filters use PrimeNG `p-datepicker` (US `mm-dd-yyyy`). Currency display uses the `appCurrency` pipe.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Environment (optional). `prestart` / `prebuild` run `scripts/generate-env.mjs`. If `src/environments/environment.ts` already exists, generation is skipped unless `FORCE_ENV_GENERATE=true`. Otherwise the file is copied from `src/environments/environment_template.ts` (demo mode on, empty Supabase keys).

   To point at Supabase, set variables in a gitignored `.env` (or export them in CI) and regenerate:

   ```bash
   FORCE_ENV_GENERATE=true npm run env:generate
   ```

   | Variable | Purpose |
   | :--- | :--- |
   | `NG_APP_SUPABASE_URL` | Project URL |
   | `NG_APP_SUPABASE_ANON_KEY` | Public anon key (never a service role key) |
   | `NG_APP_DEMO_MODE` | `true` (default) skips live I/O |
   | `NG_APP_DEBUG_MODE` | Client debug flag |
   | `NG_APP_PRODUCTION` | Production build flag written into `environment.ts` |

3. Start the development server:

   ```bash
   npm start
   ```

   Default origin is `http://localhost:4200`. Open `/#/auth/login`.

4. Production build:

   ```bash
   npm run build
   ```

   Output: `dist/auratech/browser`. Deploy as a static SPA. Hash routing does not require server-side fallback rewrites for deep links.

## Project structure

```
src/app/
  auth/           Login, register, password recovery
  core/           API services, Excel pipeline, guards, constants, demo seed data
  pages/          Home, sales-report, products, about, profile, layout shell
  shared/         Tables, filters, sidebar, permission directive
scripts/          environment.ts generation
```

## Related in-app documentation

The **About** page (`/#/layout/about`) is the user-facing walkthrough of upload, mapping, export, and catalog behavior. Keep it aligned with this README when the product contract changes.
