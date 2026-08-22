# AuraTech — inventario para MVP de portafolio

El plan de ejecución (esencial / opcional / borrar) está en [PLAN-MVP.md](PLAN-MVP.md).

Este archivo **no elimina nada**. Lista qué conviene **quitar**, **conservar** o **simplificar** para un demo genérico, sin lógica ni datos ligados al cliente original (YMI / canales de marketplace).

**Criterio del MVP:** autenticación simple, un flujo de ventas genérico (subir Excel → tabla → KPIs/gráficas), catálogo mínimo y shell visual. Nada de operación interna, curación masiva ni parsers de un tercero.

---

## Qué conservar (núcleo genérico)

### App shell y navegación
| Ruta / archivo | Por qué |
| :--- | :--- |
| `src/app/pages/layout/` | Contenedor autenticado |
| `src/app/shared/header/` | Cabecera |
| `src/app/shared/sidebar/` | Menú (hay que recortar ítems) |
| `src/app/shared/footer/` | Pie |
| `src/app/shared/components/loading-overlay/` | UX de carga |
| `src/app/app.routes.ts`, `app.config.ts`, `app.ts` | Arranque y rutas (hay que recortar rutas) |

### Auth mínimo
| Ruta / archivo | Por qué |
| :--- | :--- |
| `src/app/auth/` (sobre todo **login**) | Entrada al demo |
| `src/app/core/guards/auth.guard.ts` | Protege el layout |
| `src/app/core/services/auth/auth.ts` | Sesión |
| `src/app/core/services/supabase/supabase.service.ts` | Cliente DB (o mock si el demo es 100% local) |

**Opcional en el MVP:** `register`, `forgot-password`, `profile`, avatares (`avatar-storage.service.ts`). Sirven, pero no son el gancho del portafolio.

### Un módulo de negocio: ventas genéricas
| Ruta / archivo | Por qué |
| :--- | :--- |
| `src/app/pages/sales-report/` (coordinador + `sales-table` + `sales-analytics`) | El flujo que se ve en demo |
| `src/app/shared/components/kpi-grid/` | KPIs reutilizables |
| `src/app/shared/components/chart/` y `chart-panel/` | Gráficas |
| `src/app/shared/components/pivot-table/` | Pivot genérico |
| `src/app/shared/components/data-table/` | Tabla genérica |
| `src/app/shared/components/pagination/` | Paginación |
| `src/app/shared/components/view-controls/` | Filtros de vista |
| `src/app/shared/components/table-header-actions/` | Acciones de toolbar |
| `src/app/shared/components/data-source-indicator/` | Sesión vs DB |
| `src/app/shared/components/report-upload-placeholder/` | Empty state de upload |
| `src/app/shared/main-table-filter/` | Filtros de tabla |
| `generic-sales-report.service.ts` | Parser **genérico** (conservar) |
| `custom-excel-mapping.service.ts` + `custom-mapping-modal/` | Mapping de columnas sin atar a un canal |
| `excel-handler.service.ts` | Lectura Excel/CSV |
| `sales-file-handler.service.ts` | Orquestación (dejar solo generic + custom) |
| `sales-state.service.ts`, `sales-processing.service.ts`, `sales-analytics.service.ts`, `sales-chart-builder.service.ts` | Estado y analítica de ventas |
| `sale-records-api.service.ts` | Persistencia de ventas |
| `report-analytics-api.service.ts` | RPC de analítica (si se mantiene Supabase) |
| `base-supabase-api.service.ts` | Transporte API |

### Catálogo mínimo (opcional pero vendible)
| Ruta / archivo | Por qué |
| :--- | :--- |
| `src/app/pages/products/` | CRUD de catálogo genérico |
| `products-api.service.ts`, `product.service.ts` | API/Excel de productos |
| APIs de catálogo **si** Products las usa: `brands`, `colors`, `collections`, `divisions`, `fits`, `sizes`, `product-types` | Referencias FK; se pueden colapsar a un solo lookup más adelante |

### Infra compartida
| Archivo | Por qué |
| :--- | :--- |
| `health.service.ts`, bootstrap (`app-startup`, `app-bootstrap-state`) | Arranque y alerta de DB |
| `bulk-sync.service.ts` | Export to DB |
| `data-export.service.ts` | Export Excel/JSON |
| `loading.service.ts`, `alert.service.ts` | UX |
| `report-session-cache.service.ts` | Cache de sesión |
| `chart-generator.service.ts` | Charts |
| Pipes: `app-currency`, `trend-highlight` | Presentación |
| `record-form/` | Formularios CRUD genéricos |
| `src/app/pages/home/` | Onboarding del demo (reescribir copy) |
| `src/app/pages/about/` | Pitch de portafolio (reescribir copy) |
| `src/app/core/theme/` | Preset PrimeNG (renombrar `ymi-primeng.preset.ts` cuando se recorte) |

### Backend mínimo (si hay demo con Supabase propio)
Conservar el **esquema** de auth + `sale_records` + (opcional) `products`, no los seeds del cliente:

- `supabase/migrations/20250603180000_auth_profiles_roles.sql`
- `supabase/migrations/20250603180100_core_business_tables.sql`
- `supabase/migrations/20250603180200_catalog_tables.sql` (si se deja Products)
- RPC de sales analytics (las migraciones `*_sales_analytics*` / `*_report_analytics_rpc*`), **sin** datos curados

`scripts/generate-env.mjs` sí conviene dejarlo.

---

## Qué eliminar (específico del cliente / no hace falta para demo)

### Páginas enteras
| Carpeta | Motivo |
| :--- | :--- |
| `src/app/pages/credit-card-report/` | Gastos corporativos y map de canales del cliente |
| `src/app/pages/inventory/` | Cuentas de almacén propias (`Hyperstretch RP`, `WBB Luxe`, `WH70`, `WH10`, etc.) |
| `src/app/pages/reference-sheet/` | Hoja de referencia de marca/SKU del cliente |
| `src/app/pages/data-management/` | Herramientas de operación/curación, no de demo |
| `src/app/pages/admin-panel/` | RBAC de producción; el MVP puede usar un usuario demo fijo |

Tras borrarlas: quitar rutas en `app.routes.ts` e ítems en `sidebar.component.ts`.

### Parsers y servicios Excel de canales
Son el núcleo **no portable**. Dejar solo `generic-sales-report` y `custom-excel`.

| Archivo | Canal |
| :--- | :--- |
| `ymi-wholesale-report.service.ts` | YMI Wholesale |
| `ymi-retail-report.service.ts` | YMI Retail / Shopify Collective |
| `ymi-internal-report.service.ts` | Export interno YMI |
| `amazon-retail-report.service.ts` | Amazon Retail |
| `amazon-dropshipping-report.service.ts` | Amazon Dropshipping |
| `walmart-wfs-report.service.ts` | Walmart WFS |
| `fashion-go-report.service.ts` | Fashion Go |
| `faire-report.service.ts` | Faire |
| `rmf-website-report.service.ts` | RMF Website |
| `credit-card-report.service.ts` | Tarjeta corporativa |
| `credit-card-map-lookup.service.ts` | Lookup de map sheet |
| `inventory.service.ts` | Inventario por cuenta de cliente |
| `sales-record-curation.service.ts` | Curación de ventas de producción |
| `sales-insights.service.ts` | Insights acoplados al reporte completo (revisar; si solo los usa sales, se puede simplificar) |

En `channel-parsers.ts` y `sales-file-handler.service.ts`: eliminar `parseYmi*`, Amazon, Walmart, Faire, Fashion Go, RMF. En `store-selection-modal`: dejar **Generic** y **Custom mapping**.

Tipo `StoreType` en `ISaleRecordDto.interface.ts`: recortar a `generic-sales-report` \| `custom-excel`.

### APIs y DTOs que solo sirven a módulos recortados
| Archivo | Ligado a |
| :--- | :--- |
| `credit-card-transactions-api.service.ts` | Credit card |
| `inventory-records-api.service.ts` | Inventory |
| `reference-sheet-api.service.ts` | Reference sheet |
| `map-sheet-api.service.ts`, `map-sheet-budget-api.service.ts` | Map / presupuesto |
| `channels-cards-api.service.ts` | Canales de tarjeta |
| `sale-records-curation-api.service.ts` | Curación |
| `excel-mappings-api.service.ts` | Solo si se elimina custom mapping persistido; **conservar** si el mapping custom es parte del MVP |
| `admin-users-api.service.ts` | Admin panel |
| `ICreditCardTransactionDto`, `IInventoryRecordDto`, `IMapSheetDto`, `IReferenceSheetDto`, `sale-record-cure.interface.ts` | Dominio recortado |
| `credit-card-channel-display.pipe.ts` | Credit card |
| `channel-display.pipe.ts` | Revisar: si solo formatea canales YMI, quitar o generalizar |

### Fixtures / datos del cliente
| Archivo | Motivo |
| :--- | :--- |
| `src/app/core/data/reference-sheet-data.ts` | Catálogo con marca YMI |
| `src/app/core/data/map-sheet.data.ts` | Map de canales reales |
| `src/app/core/data/map-sheet-budget.data.ts` | Presupuesto interno |
| `src/app/core/data/control-channel-mapsheet.ts` | Control de canales |
| `src/app/core/data/channel-card-report.data.ts` | Tarjeta |
| `src/app/core/data/catalog-id-map.ts` | IDs históricos del catálogo cliente |

Sustituir por **pocos registros ficticios** (marcas genéricas, 20–50 ventas demo).

### Scripts de operación (no MVP)
| Archivo / script npm | Motivo |
| :--- | :--- |
| `scripts/split-curated-sales-sql.mjs` | Batches de ventas curadas |
| `scripts/build-seed-sql.mjs`, `apply-seed.mjs` | Seeds de producción |
| `scripts/generate-products-seed.mjs`, `generate-catalog-migration.mjs`, `export-catalog-map.mjs` | Catálogo cliente |
| `scripts/lib/seed-sql.util.mjs`, `catalog-*.mjs` | Solo si se tiran los seeds |
| `supabase/seed.sql`, `supabase_clean_curated_data.sql` | Datos reales / curados |
| Migraciones `cure_sale_records`, `excel_mappings` (si no hay custom mapping), `credit_card_*`, `inventory_analytics_rpc`, seeds `seed_*_from_reference`, `seed_colors_from_skus` | Dominio recortado o datos de SKU reales |

Scripts npm a borrar o no documentar en el demo: `db:cure-sales`, `db:sales:reset`, `db:seed*`, `db:curated*`, `db:catalog*`, `db:products:generate`.

### Dependencias y assets sobrantes
| Ítem | Motivo |
| :--- | :--- |
| `sql.js` en `package.json` + WASM en `angular.json` | No hay imports en `src/`; leftover |
| Prefijos `ymi_*` en exports (`data-export.service.ts`, coordinadores) | Rebrand a `auratech_*` |
| Copy en `about` / `home` que nombra Amazon, Fashion Go, Walmart, YMI | Reescribir para el demo |

### Auth / RBAC de más (fase 2 de recorte)
Si el demo es un solo usuario:

- `role.guard.ts`, `permission.guard.ts`, `has-permission.directive.ts`
- `role-permission.service.ts`
- `admin-users-api.service.ts` (ya listado)

---

## Orden sugerido de recorte (cuando se implemente)

1. **Rebranding residual:** strings `YMI` / `ymi` en UI, exports, keys de sessionStorage (`ymi_supabase_health`, `ymi_mock_avatar`), preset PrimeNG.
2. **Quitar páginas** credit-card, inventory, reference-sheet, data-management, admin; actualizar rutas y sidebar.
3. **Dejar un solo camino de upload** (generic + custom mapping) y borrar parsers de canal.
4. **Limpiar APIs, interfaces, pipes y `core/data`** huérfanos.
5. **Nuevo seed demo** (datos sintéticos) y recorte de migraciones/scripts de curación.
6. **Quitar `sql.js`** y scripts npm muertos.
7. **Copy de portafolio** en Home y About.

No hace falta tocar el historial git del cliente en este paso; cuando exista repo propio de AuraTech, conviene un remoto nuevo (no el de YmiProject) para no mezclar deploys.

---

## Superficie aproximada

| Capa | Conservar | Candidato a borrar |
| :--- | :--- | :--- |
| Páginas | layout, home, sales-report, products (opcional), about, auth/login | credit-card, inventory, reference-sheet, data-management, admin |
| Shared UI | shell + KPIs/charts/table/pivot | poco; casi todo es genérico |
| Excel | generic + custom mapping + handler | ~10 servicios de canal + parsers YMI/Amazon/Walmart/Faire/FashionGo/RMF |
| API | sales + products + auth + analytics sales | credit-card, inventory, map, reference, curation, admin users |
| Supabase | auth + sales (+ products) | seeds curados, RPCs de inventory/credit-card, migraciones de cure |
)
