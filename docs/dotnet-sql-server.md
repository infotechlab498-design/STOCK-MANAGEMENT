# StructStock on SQL Server and ASP.NET Core

The React app stays in `STOCK-MANAGEMENT/src`. Data is no longer stored in JSON files. ASP.NET Core writes to SQL Server, and SignalR pushes stock, document, and notification changes to open browsers.

## What you run

| Piece | Where | Port |
| --- | --- | --- |
| SQL Server database `StructStock` | Local SQL Server Express | instance `DESKTOP-0Q9OHVL\SQLEXPRESS01` |
| ASP.NET Core API | `backend/StructStock.Api` | `http://127.0.0.1:5080` (IPv4) |
| React (Vite) | repository root | `http://localhost:5173` |
| SignalR hub | `/hubs/inventory` on the API | proxied by Vite to `127.0.0.1:5080` |

Development targets `DESKTOP-0Q9OHVL\SQLEXPRESS01` (Windows Authentication). The Vite proxy and `dotnet run` URLs use **`127.0.0.1`** (not `localhost`) to avoid Windows `ECONNREFUSED ::1:5080`. Override SQL via user secrets or `ConnectionStrings:SqlServer` in `backend/StructStock.Api/appsettings.Development.json` if your instance name differs.

Authentication uses ASP.NET Core Identity **bridged** to existing `AppUser` / `Role` / `UserRole` tables (no `AspNet*` schema). Passwords stay in the StructStock PBKDF2 `salt:hash` format via `CompatPasswordHasher`.

```
Server=DESKTOP-0Q9OHVL\SQLEXPRESS01;Database=StructStock;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True
```

Health checks (no credentials returned): `GET /health`, `GET /health/db`.

## Create the database in SSMS

1. Open SQL Server Management Studio and connect to `DESKTOP-0Q9OHVL\SQLEXPRESS01` with Windows authentication.
2. Open and execute these scripts in order:
   - `backend/database/001_schema.sql`
   - `backend/database/002_seed.sql`
   - `backend/database/003_indexes.sql`
3. Refresh Databases. `StructStock` should contain the tables listed below, plus the demo users and master data.

`Database:ApplyScriptsOnStartup` is **false** by default so the API does not re-run schema/seed scripts. Prefer applying scripts yourself in SSMS.

## Tables

- Identity: `Role`, `AppUser`, `UserRole`, `UserProjectScope`, `UserWarehouseScope`, `LoginAttempt`
- Masters: `MaterialCategory`, `UnitOfMeasure`, `UnitConversion`, `Material`, `Project`, `Warehouse`, `Supplier`, `SystemSetting`, `NumberSeries`
- Requisitions: `Requisition`, `RequisitionLine`, `RequisitionAudit`
- Procurement: `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderAudit`, `Quotation`, `QuotationLine`
- Receiving: `GoodsReceipt`, `GoodsReceiptLine`, `GoodsReceiptAudit`, `ReceiptLedger`
- Stock: `StockLedger` (append-only), `InventoryBalance` (one row per material, warehouse, and project)
- Issues and returns: `MaterialIssue`, `MaterialIssueLine`, `MaterialIssueAudit`, `MaterialReturn`, `MaterialReturnLine`, `MaterialReturnAudit`
- Transfers: `StockTransfer`, `StockTransferLine`, `StockTransferAudit`
- Alerts: `Notification`, `NotificationRecipientUser`, `NotificationRecipientRole`, `NotificationRead`

Money and quantities use `decimal(18,4)`. `StockLedger` rejects `UPDATE` and `DELETE` with a trigger. Each ledger row has a unique `IdempotencyKey`. Posting a GRN, issue, return, dispatch, or receipt runs in one SQL transaction.

Weighted average cost when quantity comes in:

`newWac = (oldQty * oldWac + inQty * inCost) / (oldQty + inQty)`

If the old quantity is zero or less, the new cost is the incoming cost. Issues and transfer-outs do not change the average. Usable returns and transfer-ins do.

## Projects

`backend/StructStock.sln`

- `StructStock.Domain` — entities and the application error type
- `StructStock.Application` — workflow services
- `StructStock.Infrastructure` — EF Core SQL Server and password hashing
- `StructStock.Api` — controllers, JWT, SignalR
- `StructStock.Tests` — workflow tests against SQL Server

Passwords stay PBKDF2-SHA256, 100,000 iterations, stored as `salt:hash` in base64, matching the previous server. JWTs are HMAC-SHA256 for one hour, issuer `https://constructcorp.internal`, audience `https://constructstock.app`, with claims `sub`, `email`, `username`, `fullName`, `roles`, `projectScopes`, and `warehouseScopes`.

## Run the app

From `STOCK-MANAGEMENT`:

```
npm install
npm run dev
```

That starts the API on port 5080 and Vite on port 5173. Vite proxies `/api` and `/hubs` to the API, so the React client still calls `/api/v1`.

API only:

```
dotnet run --project backend/StructStock.Api --urls http://localhost:5080
```

Import JSON files that already exist under `data/` (skips rows whose ids are already in SQL Server):

```
dotnet run --project backend/StructStock.Api -- seed-json
```

Tests:

```
dotnet test backend/StructStock.sln
```

## Demo sign-in

| User | Password | Roles |
| --- | --- | --- |
| admin | Admin@2026!Stock | SuperAdmin, InventoryManager |
| inv.manager | Manager@2026!Inv | InventoryManager |
| pm.metro | Project@2026!Metro | ProjectManager, project PRJ-101 |
| store.north | Store@2026!Keeper | Storekeeper, warehouse WH-02 |
| procurement | Procure@2026!Officer | ProcurementOfficer |
| accounts | Accounts@2026!Valuation | AccountsOfficer |
| auditor | Viewer@2026!Audit | Viewer |
| site.auditor | Auditor@2026!Review | Auditor |
| disabled.user | Disabled@2026!Test | Inactive Viewer |

## Live updates

After a committed change the API sends:

- `notification.created`
- `stock.changed` with material, warehouse, and project ids
- `document.changed` with document type, id, status, and `targetRoute`

Only users who may see that project or warehouse receive the event. The notification bell still polls every 45 seconds if the socket drops.

## Rules carried over

- No negative stock, unless a SuperAdmin turns that flag on in Settings.
- The person who created or submitted a document cannot approve it, unless self-approval is turned on.
- A goods receipt must be inspected before it can be posted.
- Document numbers: `MR-YYYY-####`, `PO-YYYY-####`, `GRN-YYYY-####`, `MIV-YYYY-####`, `MRN-YYYY-####`, `STN-YYYY-####`, `STK-YYYY-####`, `QT-YYYY-####`.
