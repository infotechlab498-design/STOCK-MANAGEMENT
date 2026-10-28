# StructStock screen map

Every route below is a React screen. The .NET API serves the same paths under `/api/v1` (and `/api`). Live events come from the SignalR hub `/hubs/inventory`. A screen refetches when it receives `document.changed` for its document type, `stock.changed` for balances and the ledger, or `notification.created` for the bell and the notifications centre.

Roles: SuperAdmin (SA), InventoryManager (IM), ProjectManager (PM), ProcurementOfficer (PO), Storekeeper (SK), AccountsOfficer (AC), Auditor (AU), Viewer (VW).

Global scope (all projects and warehouses): SA, IM, AC. Everyone else is limited to assigned projects and warehouses.

## Navigation

| Screen | Route | Roles | Primary API | Live refresh |
| --- | --- | --- | --- | --- |
| Login | `/login` | Public | `POST /auth/login` | None |
| Dashboard | `/dashboard` | Any signed-in user | `GET /dashboard/summary` | stock, document, notification |
| Material master | `/materials` | Any | `GET/POST/PUT /materials`, `PATCH /materials/:id/status` | document Material |
| Categories | `/material-categories` | Any view; SA, IM edit | `GET/POST/PUT /material-categories`, `PATCH .../status` | document Category |
| Units of measure | `/units` | Any view; SA, IM edit | `GET/POST/PUT /units`, `/unit-conversions` | document Unit |
| Suppliers | `/suppliers` | Any | `GET/POST /suppliers` | document Supplier |
| Supplier detail | `/suppliers/:id` | Any | `GET /suppliers/:id`, `GET /suppliers/:id/purchase-orders` | document Supplier, PurchaseOrder |
| Projects | `/projects` | Any view; SA, IM edit | `GET/POST/PUT /projects`, `PATCH .../status` | document Project |
| Warehouses | `/warehouses` | Any view; SA, IM edit | `GET/POST/PUT /warehouses`, `PATCH .../status` | document Warehouse, stock |
| Site requisitions | `/requisitions` | SA, IM, PM, SK | `GET /requisitions` | document Requisition |
| New requisition | `/requisitions/new` | SA, IM, PM, SK | `POST /requisitions`, `GET /projects`, `GET /materials` | None until saved |
| Requisition detail | `/requisitions/:id` | SA, IM, PM, SK | `GET /requisitions/:id`, submit, approve, reject, return | document Requisition |
| Edit requisition | `/requisitions/:id/edit` | SA, IM, PM, SK | `PUT /requisitions/:id` | document Requisition |
| Fulfillment | `/requisitions/:id/fulfillment` | SA, IM, PM, SK | `GET /requisitions/:id/fulfillment` | document MaterialIssue |
| Approval inbox | `/approvals` | SA, IM, PM | `GET /approvals/inbox` | document Requisition |
| Purchase orders | `/purchase-orders` | SA, IM, PO, PM | `GET /purchase-orders` | document PurchaseOrder |
| New purchase order | `/purchase-orders/new` | SA, IM, PO | `POST /purchase-orders`, `GET /requisitions/approved-for-po` | None until saved |
| Purchase order detail | `/purchase-orders/:id` | SA, IM, PO, PM | submit, approve, reject, issue, cancel, `GET .../receipts` | document PurchaseOrder, GRN |
| Edit purchase order | `/purchase-orders/:id/edit` | SA, IM, PO | `PUT /purchase-orders/:id` | document PurchaseOrder |
| Rate comparison | `/purchase-orders/rate-comparison` and `/quotations` | SA, IM, PO, PM | `GET /quotations`, `POST /quotations`, `GET /quotations/compare` | document Quotation |
| Pending deliveries | `/pending-deliveries` | SA, IM, PO, SK, PM | `GET /pending-deliveries` | document PurchaseOrder, GRN |
| Goods received notes | `/grns` | SA, IM, SK, PO, PM | `GET /grns` | document GRN |
| New goods receipt | `/grns/new` and `/grns/:id/edit` | SA, IM, SK, PO | `POST /grns`, `PUT /grns/:id` | document GRN |
| GRN detail | `/grns/:id` | SA, IM, SK, PO, PM | submit, inspect, approve, reject, return, `POST /grns/:id/post` | document GRN, stock |
| Stock balances | `/stock` and `/inventory/balances` | Any | `GET /inventory/balances` | stock |
| Stock ledger | `/stock-ledger` and `/inventory/ledger` | Any | `GET /inventory/ledger` | stock |
| Reconciliation | `/inventory/reconciliation` | SA, IM, AC, PM | `GET /inventory/reconciliation`, `POST .../recover` | stock |
| Transfers | `/stock-transfers` | SA, IM, SK, PM, AC, AU, VW | `GET /stock-transfers` | document StockTransfer |
| New or edit transfer | `/stock-transfers/new`, `/stock-transfers/:id/edit` | SA, IM, SK, PM | `POST/PUT /stock-transfers` | document StockTransfer |
| Transfer detail | `/stock-transfers/:id` | Same as list | submit, approve, dispatch, receive, inspect, complete, cancel | document StockTransfer, stock |
| In transit | `/stock-transfers/in-transit` and `/inventory/in-transit` | Same as list | `GET /inventory/in-transit` | document StockTransfer, stock |
| Discrepancies | `/stock-transfers/discrepancies` | Same as list | `GET /stock-transfers/discrepancies`, resolve line | document StockTransfer |
| Material issues | `/material-issues` | SA, IM, SK, PM | `GET /material-issues` | document MaterialIssue |
| New issue | `/material-issues/new` | SA, IM, SK, PM | `POST /material-issues` | document MaterialIssue |
| Issue detail | `/material-issues/:id` | SA, IM, SK, PM | submit, approve, reject, return, post | document MaterialIssue, stock |
| Issue approval inbox | `/material-issues/approval-inbox` | SA, IM, PM | `GET /material-issues?status=Submitted` | document MaterialIssue |
| Material returns | `/material-returns` | SA, IM, SK, PM | `GET /material-returns` | document MaterialReturn |
| New return | `/material-returns/new` | SA, IM, SK, PM | `POST /material-returns` | document MaterialReturn |
| Return detail | `/material-returns/:id` | SA, IM, SK, PM | inspect, approve, post | document MaterialReturn, stock |
| Reports | `/reports` and `/reports/consumption` | Any | `GET /reports/:reportType`, CSV export | stock, document |
| Valuation | `/reports/valuation` | SA, IM, AC | `GET /inventory/valuation` | stock |
| Notifications | `/notifications` | Any | `GET /notifications`, mark read | notification |
| Users | `/users` | SA, IM (SA writes) | `GET/POST/PUT /users`, `PATCH /users/:id/status`, `GET /roles` | document User |
| Settings | `/settings` | SA | `GET/PUT /settings` | document Settings |
| Architecture | `/architecture` | Any | None (static explanation) | None |

## How screens link

1. Dashboard KPIs open the list that owns the count: low stock opens `/stock`, pending requisitions open `/approvals`, pending purchase orders open `/purchase-orders`, goods receipts open `/grns`, in-transit opens `/stock-transfers/in-transit`, notifications open `/notifications`.
2. A requisition detail links to edit (while Draft or ReturnedForCorrection), to the approval inbox, and after approval to fulfillment.
3. Fulfillment links to `/material-issues/new?requisitionId=`.
4. An approved requisition with open lines is listed on the new purchase order screen.
5. An issued or partially received purchase order appears on Pending deliveries and links to `/grns/new?purchaseOrderId=`.
6. A posted GRN links to `/stock` and `/stock-ledger`.
7. A posted material issue links to `/material-returns/new?issueId=`.
8. A dispatched transfer links to in-transit, and a short or damaged line links to the discrepancy queue, which opens the transfer detail.
9. Supplier detail lists that supplier's purchase orders and opens `/purchase-orders/:id`.
10. The notification bell and the notifications centre open `targetRoute` on the source document.
11. Master data pages link to each other from the sidebar group: materials, categories, units, suppliers, projects, warehouses.

## Document status the screens depend on

- Requisition: Draft, Submitted, Approved, Rejected, ReturnedForCorrection, PartiallyFulfilled, FullyFulfilled.
- Purchase order: Draft, PendingApproval, Approved, Issued, PartiallyReceived, FullyReceived, Cancelled, Rejected.
- GRN: Draft, SubmittedForInspection, Inspected, Approved, Posted, Rejected, ReturnedForCorrection, Cancelled.
- Material issue: Draft, Submitted, Approved, Posted, Rejected, ReturnedForCorrection, Cancelled.
- Material return: Draft, Submitted, Inspected, Approved, Posted, Rejected, Cancelled.
- Transfer: Draft, Submitted, Approved, Dispatched, PartiallyReceived, Received, Completed, Rejected, ReturnedForCorrection, Cancelled.

Posted stock documents are not edited. The ledger at `/stock-ledger` is append-only. Corrections are a later stock adjustment or a reversal row, not an update of a posted line.
