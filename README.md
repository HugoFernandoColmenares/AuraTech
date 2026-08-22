# AuraTech — Business Intelligence and Reporting Platform

AuraTech is a portfolio/demo derivative of a production-oriented web application for sales reporting, corporate expense analysis, inventory monitoring, and product catalog management. The client is built with **Angular 19** using **Signals**, **standalone components**, and **OnPush** change detection. Live data and authentication are provided by **Supabase**; the application requires a reachable database for report modules to load and persist data.

## Key Features

- **Multi-source Excel ingestion**: Parse channel-specific sales, inventory, credit card, and catalog spreadsheets with dedicated parsers and normalization rules.
- **Session-to-database workflow**: Uploads are parsed in the browser, flagged as session data, reviewed in tables, then bulk-upserted to Supabase via **Export to DB**.
- **Data source indicator**: Table toolbars show counts for session/cache rows versus database rows; **Export to DB** is enabled only when session rows are pending.
- **Dashboard onboarding**: The home route provides a step-by-step upload and persistence guide; the About page contains extended English documentation.
- **Hierarchical analytics (YoY/MoM)**: Standardized pivot tables and KPI cards for sales and credit card modules; inventory server-side chart aggregates when Supabase RPC is available.
- **Sales YoY KPIs**: Date filters scope the current period; prior-year comparison uses Supabase analytics RPC or a bounded client fetch when RPC is unavailable.
- **Excel export**: Report tables expose **Export Excel** (full dataset or session) through `DataExportService`.
- **Role-based access**: Permissions gate create, edit, delete, bulk upload, and data-management tools.
- **Art Deco minimalist UI**: Shared shell components and a PrimeNG preset aligned with internal design guidelines.

## Data Flow Overview

| Stage | Behavior |
| :--- | :--- |
| Upload | User selects Excel/CSV; parsers produce in-memory rows with `isLocal: true`. |
| Review | Coordinators display filtered tables; the data-source icon summarizes session vs database counts. |
| Persist | **Export to DB** uploads only session rows (`isLocal`) via bulk upsert APIs. |
| Read | Paginated tables and analytics RPC read from Supabase; GET/RPC responses may be cached for the browser session. |
| Offline / unreachable DB | A connection alert is shown; report modules do not fall back to bundled demo datasets. |

## Architectural Patterns

The application follows a feature-based **Coordinator pattern**:

- **Coordinator parent** (`*-report`, `inventory`, `products`): Owns signals for filters, pagination, analytics readiness, and mutation refresh; orchestrates API and Excel services.
- **Analytics child** (`*-analytics`): KPIs, charts, and pivot tables; consumes server RPC bundles or session aggregates.
- **Table child** (`*-table`): Data exploration, toolbar actions, and CRUD event emission.
- **Shared infrastructure**: `HealthService`, `ReportSessionCacheService`, `BulkSyncService`, `DataExportService`, `LoadingService`, and report shell components.

### Shared report shell components

| Component | Used in |
| :--- | :--- |
| `app-view-controls` | Sales, credit card, inventory coordinators |
| `app-kpi-grid` | Sales analytics, credit card report |
| `app-chart-panel` | Sales analytics, credit card analytics |
| `app-table-header-actions` | Sales, credit card, and inventory table children |
| `app-data-source-indicator` | Embedded in table header actions |
| `app-report-table-shell` | Credit card table wrapper |

### Supabase connectivity

| Layer | Implementation |
| :--- | :--- |
| API transport | `BaseSupabaseApiService` + `@supabase/supabase-js` |
| Configuration | `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_ANON_KEY` |
| Auth | Supabase Auth + `profiles` / `user_roles`; mock auth only when Supabase is unreachable during bootstrap |
| Analytics | RPC: `get_sales_analytics`, `get_credit_card_analytics`, `get_inventory_analytics` |
| Response contract | `IApiResponse<T>` for tables and export flows |

Deploy the static SPA on **Vercel**. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Session cache policy

`ReportSessionCacheService` caches read-only responses in memory for the browser session:

- Paginated table pages and full analytics fetches are cached per entity and filter key.
- Any create, update, delete, or bulk upsert invalidates the affected report cache.
- Data Management can clear session caches after connectivity or curation operations.

See `architecture_guidelines.md` for the full contract.

### Catalog and SKU data model

The Products module is a **style catalog** (one row per `parent`). Reads use the Supabase view `products_parent_catalog`; writes target `public.products` with FK resolution in `prepareProductForUpload`.

| Layer | Read | Write |
| :--- | :--- | :--- |
| List | `products_parent_catalog` via `ProductsApiService` | — |
| CRUD | — | `public.products` with catalog FK columns |
| Labels | Enriched DTO + reference sheet hydration | Excel import and bulk export resolve labels to FK ids |

Database seeds and migration helpers under `scripts/` may reference historical JSON fixtures in `src/app/core/data/` for local Supabase seeding only; those files are not loaded at runtime by the SPA.

### Data Management module

Administrative tools (permission: `dataManagement`):

- Test database connection and warm reference caches after reconnect.
- Preview and apply sales record curation in Supabase (same rules as Excel import).
- Refresh sales analytics materialized views when the RPC is deployed.
- Clear browser session data.

Excel export was moved to individual report table toolbars.

## Technical Stack

| Area | Choice |
| :--- | :--- |
| Framework | Angular 19.2 (Signals, standalone, zone.js) |
| UI | PrimeNG 19 with `YmiPrimeNgPreset`; global CSS design tokens |
| State | Signal-first coordinators; minimal RxJS for HTTP transport |
| Excel | SheetJS (`xlsx`) via domain services under `core/services/Excel/` |
| Tests | Karma/Jasmine (utilities and auth specs) |

### PrimeNG integration

Configured in `app.config.ts` via `providePrimeNG()`. Date filters use `p-datepicker` in `app-main-table-filter` (US format `mm-dd-yyyy`).

### Display pipes

| Pipe | Purpose |
| :--- | :--- |
| `channelDisplay` | Normalizes account/channel labels in pivot tables |
| `appCurrency` | USD formatting for monetary values |

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Supabase**

   Set `NG_APP_SUPABASE_URL` and `NG_APP_SUPABASE_ANON_KEY` in `.env` or gitignored `src/environments/environment.ts`, then run:

   ```bash
   npm run env:generate
   ```

3. **Apply migrations and optional seeds** (local or remote Supabase)

   ```bash
   npm run db:push
   npm run db:seed:generate   # optional — requires seed JSON in core/data
   npm run db:seed:apply      # optional
   ```

4. **Start the dev server**

   ```bash
   npm start
   ```

   Open `/layout/home` after login for the upload workflow tutorial.

5. **Production build**

   ```bash
   npm run build
   ```

   Output: `dist/ymi-project/browser`

## Documentation

| Document | Purpose |
| :--- | :--- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel build, environment variables, Supabase secrets |
| [docs/PORTFOLIO_DEMO.md](docs/PORTFOLIO_DEMO.md) | Guide to producing a white-label portfolio preview |
| [SUPABASE_MIGRATION_PLAN.md](SUPABASE_MIGRATION_PLAN.md) | Migration phases and validation |
| `supabase/README.md` | Migrations and CLI sync |
| `architecture_guidelines.md` | Coordinator pattern and architecture overview (gitignored) |
| `DESIGN_GUIDELINES.md` | Art Deco UI standards (gitignored) |

## Project Structure (high level)

```
src/app/
  core/           Services, API layer, utilities, interfaces, static reference data
  pages/          Feature coordinators (sales-report, inventory, home, about, …)
  shared/         Reusable UI (tables, filters, sidebar, data-source indicator)
  auth/           Login, register, password recovery
supabase/         SQL migrations and Edge Functions
scripts/          Env generation, seed SQL builders (not shipped to browser)
docs/             Deployment and portfolio guides
```

---

Developed with a focus on SOLID, DRY, and KISS principles.
