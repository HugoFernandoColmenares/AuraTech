# Plan de refactorización — AuraTech MVP

Objetivo: un demo de portafolio genérico (Angular 19 + Supabase) que muestre **subir Excel → revisar tabla → KPIs/gráficas → persistir**. Sin marca, parsers ni datos del cliente original.

Este documento es el plan de recorte. `MVP.md` es el inventario detallado de rutas.

---

## Decisión de producto

| Incluido en el MVP | Fuera del MVP |
| :--- | :--- |
| Login + layout | Admin, data management, RBAC fino |
| Home (onboarding corto) | Inventario por almacén del cliente |
| Sales report genérico | Credit card / gastos corporativos |
| Analytics de ventas (KPI, chart, pivot, tabla) | Parsers Amazon, Walmart, Faire, Fashion Go, RMF, YMI |
| Export Excel de lo visible | Reference sheet y map sheet de canales |
| Rebrand AuraTech | Seeds y scripts de curación de producción |

**Products (catálogo)** queda en **opcional**: aporta CRUD, pero no es el gancho del demo.

---

## Esencial — no borrar

Sin esto el MVP no arranca o no se entiende.

### Arranque y shell
- `src/main.ts`, `src/app/app.ts`, `app.config.ts`, `app.routes.ts` (rutas recortadas)
- `src/index.html`, `src/styles.css`
- `pages/layout/`
- `shared/header/`, `shared/sidebar/` (menú reducido), `shared/footer/`
- `shared/components/loading-overlay/`
- `core/theme/` (renombrar preset `ymi-*` → `auratech-*`)
- `core/services/Utils/loading.service.ts`, `alert.service.ts`, `sidebar.service.ts`

### Auth mínimo
- `src/app/auth/` — al menos **login** + contenedor `auth`
- `core/guards/auth.guard.ts`
- `core/services/auth/auth.ts`
- `core/services/supabase/supabase.service.ts`
- `core/services/api/base-supabase-api.service.ts`
- `core/services/api/auth-api.service.ts`

### Ventas genéricas (el demo)
- `pages/sales-report/` — coordinador, `sales-table`, `sales-analytics`
- `store-selection-modal` — solo opciones **Generic** y **Custom mapping**
- `custom-mapping-modal/`
- Shared: `kpi-grid`, `chart`, `chart-panel`, `pivot-table`, `data-table`, `pagination`, `view-controls`, `table-header-actions`, `data-source-indicator`, `report-upload-placeholder`, `main-table-filter`
- Excel: `excel-handler.service.ts`, `generic-sales-report.service.ts`, `custom-excel-mapping.service.ts`, `sales-file-handler.service.ts` (solo esos dos caminos)
- Estado/analítica: `sales-state.service.ts`, `sales-processing.service.ts`, `sales-analytics.service.ts`, `sales-chart-builder.service.ts`
- API: `sale-records-api.service.ts`, `report-analytics-api.service.ts` (solo ventas)
- Utils: `bulk-sync.service.ts`, `data-export.service.ts`, `report-session-cache.service.ts`, `chart-generator.service.ts`
- Bootstrap: `health.service.ts`, `app-startup.service.ts`, `app-bootstrap-state.service.ts`
- Pipes: `app-currency.pipe.ts`, `trend-highlight.pipe.ts`
- Interfaces de ventas / pivot / chart / `IApiResponse` / `IBulkUpsertResult`
- `pages/home/` y `pages/about/` (reescribir copy, no borrar)

### Config de proyecto
- `package.json`, `angular.json`, `tsconfig*.json`, `vercel.json`
- `scripts/generate-env.mjs` (hoy `scripts/*` está en `.gitignore`; hay que **dejar de ignorar** este archivo o moverlo)
- `.env.template` (sin secretos; rebrand)

### Supabase mínimo (proyecto demo propio)
Esquema de auth + `sale_records` + RPC de analytics de ventas. Hoy `.gitignore` ignora todo `supabase/`; para el MVP público conviene versionar **solo migraciones limpias**, nunca seeds del cliente.

---

## Opcional — se puede quedar o recortar en una segunda pasada

No bloquean el demo. Si el tiempo aprieta, se eliminan.

| Elemento | Si se queda | Si se quita |
| :--- | :--- | :--- |
| `pages/products/` + `products-api` + `product.service` + APIs de catálogo (brands, colors, collections, …) | Segundo módulo CRUD | Menú y rutas más cortos |
| `register/` y `forgot-password/` | Flujo auth completo | Solo login demo |
| `pages/profile/` + `avatar-storage.service.ts` | Perfil pulido | Usuario fijo |
| `excel-mappings-api.service.ts` | Mapping custom persistido | Mapping solo en sesión |
| `record-form/` | Formularios reutilizables | Formularios inline en sales |
| `insights/` + `sales-insights.service.ts` | Extra de analítica | KPI + chart bastan |
| `report-table-shell/` | Wrapper extra | Usar table shell de sales |
| `role.guard.ts`, `permission.guard.ts`, `has-permission.directive.ts`, `role-permission.service.ts` | Roles en demo | Un solo usuario |
| `fallback-data.loader.ts`, `app-data-bootstrap.service.ts`, `mock-auth.store.ts`, `mock-users.data.ts` | Demo sin DB | Obligar Supabase |
| `channel-display.pipe.ts` | Etiquetas de canal genéricas | Texto plano |
| Home steps de “Export to DB” | Enseña el flujo sesión → DB | Home más marketing |

---

## Borrar de forma definitiva

Ligados al cliente, a canales de marketplace o a operación interna. No deben ir al repo público.

### Páginas (carpetas completas)
- `src/app/pages/credit-card-report/`
- `src/app/pages/inventory/`
- `src/app/pages/reference-sheet/`
- `src/app/pages/data-management/`
- `src/app/pages/admin-panel/`

Actualizar `app.routes.ts` y `sidebar.component.ts` en el mismo cambio.

### Servicios Excel / parsers de canal
- `ymi-wholesale-report.service.ts`
- `ymi-retail-report.service.ts`
- `ymi-internal-report.service.ts`
- `amazon-retail-report.service.ts`
- `amazon-dropshipping-report.service.ts`
- `walmart-wfs-report.service.ts`
- `fashion-go-report.service.ts`
- `faire-report.service.ts`
- `rmf-website-report.service.ts`
- `credit-card-report.service.ts`
- `credit-card-map-lookup.service.ts`
- `inventory.service.ts`
- `sales-record-curation.service.ts`
- Funciones `parseYmi*`, Amazon, Walmart, Faire, Fashion Go, RMF en `channel-parsers.ts`
- Valores de `StoreType` distintos de `generic-sales-report` y `custom-excel`

### APIs, DTOs y pipes muertos tras el recorte
- `credit-card-transactions-api.service.ts`
- `inventory-records-api.service.ts`
- `reference-sheet-api.service.ts`
- `map-sheet-api.service.ts`, `map-sheet-budget-api.service.ts`
- `channels-cards-api.service.ts`
- `sale-records-curation-api.service.ts`
- `admin-users-api.service.ts`
- DTOs: credit card, inventory, map sheet, reference sheet, sale-record-cure
- `credit-card-channel-display.pipe.ts`

### Datos del cliente
- `core/data/reference-sheet-data.ts`
- `core/data/map-sheet.data.ts`
- `core/data/map-sheet-budget.data.ts`
- `core/data/control-channel-mapsheet.ts`
- `core/data/channel-card-report.data.ts`
- `core/data/catalog-id-map.ts`

Sustituir, si hace falta, por **fixtures sintéticos** (marca genérica, pocas filas).

### Scripts y SQL de producción
- `scripts/split-curated-sales-sql.mjs`
- `scripts/build-seed-sql.mjs`, `apply-seed.mjs`
- `scripts/generate-products-seed.mjs`, `generate-catalog-migration.mjs`, `export-catalog-map.mjs`
- `scripts/lib/seed-sql.util.mjs`, `catalog-*.mjs`
- `supabase/seed.sql`, `supabase_clean_curated_data.sql`
- Migraciones de cure, credit_card, inventory analytics, seeds desde reference/SKU reales
- Scripts npm: `db:cure-sales`, `db:sales:reset`, `db:seed*`, `db:curated*`, `db:catalog*`, `db:products:generate`

### Dependencias y marca residual
- Paquete `sql.js` y el WASM en `angular.json` (no hay imports en `src/`)
- Prefijos `ymi_*` en exports, sessionStorage (`ymi_supabase_health`, `ymi_mock_avatar`)
- Copy que nombre YMI, Amazon, Fashion Go, Walmart, etc.

---

## Orden de ejecución

1. **Aislar el remoto** — repo nuevo `HugoFernandoColmenares/AuraTech` (este paso). Nunca pushear el historial del cliente.
2. **Rebrand residual** — strings, preset, títulos, `.env.template`.
3. **Borrar páginas** de la lista definitiva + rutas + sidebar.
4. **Dejar un solo upload** (generic + custom) y borrar parsers de canal.
5. **Limpiar APIs, interfaces y `core/data` huérfanos**; `ng build` debe pasar.
6. **Decidir opcionales** (Products, register, RBAC). Por defecto: Products fuera en v1 si el plazo es corto.
7. **Supabase demo** — migraciones mínimas + seed sintético; ajustar `.gitignore` para versionar migraciones limpias y `generate-env.mjs`.
8. **Quitar `sql.js` y scripts npm muertos**.
9. **Home / About / README** de portafolio.

Cada fase termina con `ng build` (y smoke de login + sales).

---

## Nota de gitignore (antes de recortar código)

`.gitignore` actual ignora `supabase/` y `scripts/*`. Eso evita filtrar SQL/scripts del cliente en el primer push, pero también oculta `generate-env.mjs`. En la fase 7: dejar de ignorar migraciones nuevas y el script de env; seguir ignorando `.env` y seeds históricos.
