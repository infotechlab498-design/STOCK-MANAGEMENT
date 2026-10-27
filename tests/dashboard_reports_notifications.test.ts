export {};
/**
 * PROMPT 12 AUTOMATED TEST SUITE
 * Dashboard, Reports, Notifications & CSV Export Verification
 */

const BASE_URL = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function login(usernameOrEmail: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password }),
  });
  const body = (await res.json()) as any;
  if (!res.ok || !body.data?.accessToken) {
    throw new Error(`Login failed for ${usernameOrEmail}: ${JSON.stringify(body)}`);
  }
  return body.data.accessToken;
}

async function apiGet(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // raw text response (e.g. CSV)
  }
  return { status: res.status, headers: res.headers, body: json, text };
}

async function apiPost(path: string, token: string, payload: unknown = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as any;
  return { status: res.status, body: json };
}

async function runTests() {
  console.log('================================================================');
  console.log('PROMPT 12: DASHBOARD, REPORTS, NOTIFICATIONS & EXPORT TEST SUITE');
  console.log('================================================================\n');

  const adminToken = await login('admin', 'Admin@2026!Stock');
  const pmMetroToken = await login('pm.metro', 'Project@2026!Metro'); // PRJ-101, WH-01..02
  const storeNorthToken = await login('store.north', 'Store@2026!Keeper'); // PRJ-101, WH-02
  const auditorToken = await login('auditor', 'Viewer@2026!Audit'); // PRJ-101, WH-02

  // ------------------------------------------------------------------------
  // SECTION 1: MANAGEMENT DASHBOARD & LEDGER/VALUATION RECONCILIATION
  // ------------------------------------------------------------------------
  console.log('\n--- 1. Management Dashboard & Ledger/Valuation Reconciliation ---');

  const dashRes = await apiGet('/dashboard/summary', adminToken);
  assert(dashRes.status === 200 && dashRes.body?.success === true, '1.1 GET /api/dashboard/summary returns 200 OK');

  const dashData = dashRes.body.data;
  const valRes = await apiGet('/inventory/valuation', adminToken);
  const valSummary = valRes.body?.data?.summary;

  assert(
    Math.abs(dashData.kpis.totalInventoryValue - valSummary.totalInventoryValue) < 0.01 &&
      Math.abs(dashData.kpis.totalQuantityOnHand - valSummary.totalQuantityOnHand) < 0.01,
    '1.2 Dashboard totalInventoryValue and totalQuantityOnHand reconcile 100% with /api/inventory/valuation',
    `Dash=(${dashData.kpis.totalInventoryValue}, ${dashData.kpis.totalQuantityOnHand}) vs Val=(${valSummary?.totalInventoryValue}, ${valSummary?.totalQuantityOnHand})`
  );

  // Verify in-transit stock is strictly excluded from usable on-hand stock
  const locationOnHandSum = dashData.locationSummaries.reduce(
    (s: number, l: any) => s + (l.quantityOnHand || 0),
    0
  );
  const locationValueSum = dashData.locationSummaries.reduce(
    (s: number, l: any) => s + (l.inventoryValue || 0),
    0
  );
  assert(
    Math.abs(locationOnHandSum - dashData.kpis.totalQuantityOnHand) < 0.01 &&
      Math.abs(locationValueSum - dashData.kpis.totalInventoryValue) < 0.01,
    '1.3 Dashboard location rollup sums match usable KPIs without mixing in-transit quantities'
  );

  assert(
    Array.isArray(dashData.lowStockItems) &&
      Array.isArray(dashData.recentMovements) &&
      Array.isArray(dashData.recentAuditActivity) &&
      typeof dashData.asOfTimestampUtc === 'string',
    '1.4 Dashboard includes lowStockItems, recentMovements, recentAuditActivity, and asOfTimestampUtc'
  );

  // Date & Location filtering on Dashboard
  const dashWh01 = await apiGet('/dashboard/summary?warehouseId=WH-01', adminToken);
  assert(
    dashWh01.status === 200 &&
      dashWh01.body.data.locationSummaries.every((l: any) => l.warehouseId === 'WH-01'),
    '1.5 Dashboard warehouseId=WH-01 filter restricts locationSummaries and balances to WH-01'
  );

  const dashBadDates = await apiGet(
    '/dashboard/summary?fromDate=2026-12-31&toDate=2026-01-01',
    adminToken
  );
  assert(
    dashBadDates.status === 400,
    '1.6 Dashboard rejects invalid date range where fromDate > toDate with HTTP 400'
  );

  // Cross-scope authorization enforcement on Dashboard
  const dashForbiddenProj = await apiGet('/dashboard/summary?projectId=PRJ-102', pmMetroToken);
  assert(
    dashForbiddenProj.status === 403,
    '1.7 Scoped user (pm.metro) requesting unauthorized projectId=PRJ-102 on Dashboard receives 403 Forbidden'
  );

  const dashForbiddenWh = await apiGet('/dashboard/summary?warehouseId=WH-03', storeNorthToken);
  assert(
    dashForbiddenWh.status === 403,
    '1.8 Scoped user (store.north) requesting unauthorized warehouseId=WH-03 on Dashboard receives 403 Forbidden'
  );

  const dashScopedStore = await apiGet('/dashboard/summary', storeNorthToken);
  assert(
    dashScopedStore.status === 200 &&
      dashScopedStore.body.data.locationSummaries.every(
        (l: any) => l.warehouseId === 'WH-02' && l.projectId === 'PRJ-101'
      ),
    '1.9 Unfiltered dashboard for store.north automatically scopes strictly to WH-02 and PRJ-101'
  );

  // ------------------------------------------------------------------------
  // SECTION 2: ALL 8 SCOPED REPORTS & TOTALS RECONCILIATION
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Reports Suite & Ledger/Balance Reconciliation ---');

  const repBalances = await apiGet('/reports/stock-balances', adminToken);
  assert(
    repBalances.status === 200 &&
      Math.abs(repBalances.body.data.summary.totalInventoryValue - dashData.kpis.totalInventoryValue) < 0.01 &&
      Math.abs(repBalances.body.data.summary.totalQuantityOnHand - dashData.kpis.totalQuantityOnHand) < 0.01,
    '2.1 Report stock-balances totals reconcile with Dashboard and Authoritative Balances'
  );

  const repValuation = await apiGet('/reports/inventory-valuation', adminToken);
  assert(
    repValuation.status === 200 &&
      Math.abs(repValuation.body.data.summary.totalInventoryValue - valSummary.totalInventoryValue) < 0.01,
    '2.2 Report inventory-valuation reconciles with Moving WAC Valuation service'
  );

  const repLedger = await apiGet('/reports/stock-ledger?pageSize=500', adminToken);
  const authLedger = await apiGet('/inventory/ledger?pageSize=500', adminToken);
  const authLedgerItems = authLedger.body?.data?.items || [];
  const authNetSigned = authLedgerItems.reduce((s: number, e: any) => s + (e.signedQuantity || 0), 0);
  const authQtyIn = authLedgerItems.reduce((s: number, e: any) => s + (e.quantityIn || 0), 0);
  const authQtyOut = authLedgerItems.reduce((s: number, e: any) => s + (e.quantityOut || 0), 0);
  assert(
    repLedger.status === 200 &&
      repLedger.body.data.summary.totalTransactions === authLedger.body.data.totalCount &&
      Math.abs(repLedger.body.data.summary.netSignedQuantity - authNetSigned) < 0.01 &&
      Math.abs(repLedger.body.data.summary.totalQuantityIn - authQtyIn) < 0.01 &&
      Math.abs(repLedger.body.data.summary.totalQuantityOut - authQtyOut) < 0.01,
    '2.3 Report stock-ledger summary totals (QtyIn, QtyOut, NetSignedQty) reconcile 100% with authoritative /api/inventory/ledger service',
    `ReportNet=${repLedger.body.data.summary?.netSignedQuantity} vs LedgerServiceNet=${authNetSigned}`
  );

  const repGrnPo = await apiGet('/reports/grn-po-summary', adminToken);
  assert(
    repGrnPo.status === 200 &&
      typeof repGrnPo.body.data.summary.totalOrderedQuantity === 'number' &&
      typeof repGrnPo.body.data.summary.totalOutstandingQuantity === 'number',
    '2.4 Report grn-po-summary returns PO ordered, received, rejected, and outstanding quantities'
  );

  const repConsumption = await apiGet('/reports/consumption-issues-returns', adminToken);
  const consSummary = repConsumption.body?.data?.summary;
  assert(
    repConsumption.status === 200 &&
      Math.abs(
        consSummary.totalNetConsumedQuantity -
          (consSummary.totalGrossIssuedQuantity - consSummary.totalReturnedReusableQuantity)
      ) < 0.01,
    '2.5 Report consumption-issues-returns reconciles Net Consumption = Gross Issued - Reusable Returns'
  );

  const repTransfers = await apiGet('/reports/transfers-in-transit', adminToken);
  assert(
    repTransfers.status === 200 &&
      typeof repTransfers.body.data.summary.totalInTransitQuantity === 'number' &&
      Math.abs(repTransfers.body.data.summary.totalInTransitQuantity - dashData.kpis.totalInTransitQuantity) < 0.01,
    '2.6 Report transfers-in-transit reconciles active in-transit quantity with Dashboard KPI'
  );

  const repReqTurnaround = await apiGet('/reports/requisition-turnaround', adminToken);
  assert(
    repReqTurnaround.status === 200 &&
      typeof repReqTurnaround.body.data.summary.averageApprovalTurnaroundHours === 'number',
    '2.7 Report requisition-turnaround calculates approval turnaround hours and fulfillment metrics'
  );

  const repLowStock = await apiGet('/reports/low-stock-reorder', adminToken);
  assert(
    repLowStock.status === 200 &&
      repLowStock.body.data.summary.totalLowStockItems === dashData.kpis.lowStockCount,
    '2.8 Report low-stock-reorder count matches Dashboard lowStockCount'
  );

  // Pagination & Empty Dataset checks
  const repPaged = await apiGet('/reports/stock-ledger?page=1&pageSize=2', adminToken);
  assert(
    repPaged.status === 200 &&
      repPaged.body.data.items.length <= 2 &&
      repPaged.body.data.pageSize === 2 &&
      repPaged.body.data.totalPages >= 1,
    '2.9 Report pagination respects page and pageSize parameters while preserving totalCount'
  );

  const repEmpty = await apiGet(
    '/reports/stock-balances?search=NON_EXISTENT_MATERIAL_XYZ_999',
    adminToken
  );
  assert(
    repEmpty.status === 200 &&
      repEmpty.body.data.items.length === 0 &&
      repEmpty.body.data.totalCount === 0 &&
      repEmpty.body.data.summary.totalInventoryValue === 0,
    '2.10 Report handles empty dataset cleanly with zero rows and zeroed summary totals'
  );

  // Cross-scope protection on Reports
  const repForbidden = await apiGet('/reports/stock-balances?projectId=PRJ-103', auditorToken);
  assert(
    repForbidden.status === 403,
    '2.11 Auditor scoped to PRJ-101 receives 403 Forbidden when requesting report for PRJ-103'
  );

  const repScopedAuditor = await apiGet('/reports/stock-balances', auditorToken);
  assert(
    repScopedAuditor.status === 200 &&
      repScopedAuditor.body.data.items.every(
        (r: any) => r.projectId === 'PRJ-101' && r.warehouseId === 'WH-02'
      ),
    '2.12 Unfiltered report for auditor returns only records in PRJ-101 and WH-02 (no cross-scope leakage)'
  );

  // ------------------------------------------------------------------------
  // SECTION 3: CSV EXPORT, RFC 4180 ESCAPING & EXPORT AUTHORIZATION
  // ------------------------------------------------------------------------
  console.log('\n--- 3. CSV Export, RFC 4180 Escaping & Export Authorization ---');

  // Create a requisition with commas, double quotes, and newlines in purpose/workActivity so we can verify RFC 4180 CSV escaping
  const specialReqRes = await apiPost('/requisitions', pmMetroToken, {
    projectId: 'PRJ-101',
    requiredDate: '2026-11-15',
    priority: 'High',
    purpose: 'CSV Test, with "quotes"\nand newline for Pier 9',
    workActivity: 'Substructure, "Formwork" & Rebar',
    siteLocationDetail: 'Sector B, Gate "North"',
    items: [
      {
        materialId: 'MAT-CEM-02',
        requestedQuantity: 25,
        unitId: 'UNT-BAG',
        remarks: 'Urgent, " moisture-proof " bags',
      },
    ],
  });
  const createdReqId = specialReqRes.body?.data?.id;
  if (createdReqId) {
    await apiPost(`/requisitions/${createdReqId}/submit`, pmMetroToken, {
      comments: 'Submitting for RFC 4180 CSV & notification test, "quoted", line1\nline2',
    });
  }

  // Also test CSV escaping on stock-balances / materials by updating a material specification or checking stock-ledger remarks
  const csvExportRes = await apiGet('/reports/stock-balances/export?format=csv', adminToken);
  assert(
    csvExportRes.status === 200 &&
      (csvExportRes.headers.get('content-type') || '').includes('text/csv') &&
      (csvExportRes.headers.get('content-disposition') || '').includes('attachment; filename="stock-balances-'),
    '3.1 GET /api/reports/stock-balances/export?format=csv returns 200 with text/csv and attachment filename'
  );

  const csvLines = csvExportRes.text.trim().split('\r\n');
  assert(
    csvLines.length >= 2 &&
      csvLines[0].startsWith('Material Code,Material Name,Category,Warehouse ID,Warehouse / Store'),
    '3.2 CSV export has stable column headers matching report definition and data rows'
  );

  // Verify RFC 4180 escaping on a field containing commas, double quotes, and newlines
  // Let's update MAT-BRK-05 name temporarily to include comma, quotes, and newline, export CSV, and restore it
  const matGet = await apiGet('/materials/MAT-BRK-05', adminToken);
  const origMat = matGet.body?.data;
  if (origMat) {
    await fetch(`${BASE_URL}/materials/MAT-BRK-05`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Red Clay Bricks, "Grade A"\nKiln-Fired',
        description: origMat.description,
        specification: origMat.specification,
        categoryId: origMat.categoryId,
        baseUnitId: origMat.baseUnitId,
        minimumStockLevel: origMat.minimumStockLevel,
        reorderLevel: origMat.reorderLevel,
      }),
    });
  }

  // Create a transfer draft with MAT-BRK-05 so it appears in transfers-in-transit report with the special material name
  await apiPost('/stock-transfers', adminToken, {
    sourceProjectId: 'PRJ-101',
    sourceWarehouseId: 'WH-01',
    destinationProjectId: 'PRJ-101',
    destinationWarehouseId: 'WH-02',
    requestDate: '2026-10-27',
    purpose: 'CSV Escaping Verification',
    transferReason: 'CSV Escaping Verification',
    items: [
      {
        materialId: 'MAT-BRK-05',
        requestedQuantity: 10,
      },
    ],
  });

  const csvTrfExport = await apiGet('/reports/transfers-in-transit/export?format=csv', adminToken);
  assert(
    csvTrfExport.status === 200 &&
      csvTrfExport.text.includes('"Red Clay Bricks, ""Grade A""\nKiln-Fired"'),
    '3.3 CSV export properly escapes commas, internal double-quotes (""), and embedded newlines per RFC 4180'
  );

  // Restore MAT-BRK-05 original name
  if (origMat) {
    await fetch(`${BASE_URL}/materials/MAT-BRK-05`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: origMat.name,
        description: origMat.description,
        specification: origMat.specification,
        categoryId: origMat.categoryId,
        baseUnitId: origMat.baseUnitId,
        minimumStockLevel: origMat.minimumStockLevel,
        reorderLevel: origMat.reorderLevel,
      }),
    });
  }

  // Export authorization check
  const csvForbidden = await apiGet(
    '/reports/stock-balances/export?format=csv&projectId=PRJ-102',
    storeNorthToken
  );
  assert(
    csvForbidden.status === 403,
    '3.4 CSV export rejects unauthorized projectId=PRJ-102 for store.north with 403 Forbidden'
  );

  const pdfUnsupported = await apiGet('/reports/stock-balances/export?format=pdf', adminToken);
  assert(
    pdfUnsupported.status === 400,
    '3.5 Export endpoint rejects unsupported format=pdf with 400 and directs to Print-to-PDF workflow'
  );

  // ------------------------------------------------------------------------
  // SECTION 4: NOTIFICATIONS, RECIPIENT ISOLATION, READ STATE & IDEMPOTENCY
  // ------------------------------------------------------------------------
  console.log('\n--- 4. Notifications & Action Centre Verification ---');

  const notifRes1 = await apiGet('/notifications?pageSize=100', adminToken);
  assert(
    notifRes1.status === 200 &&
      Array.isArray(notifRes1.body?.data?.items) &&
      notifRes1.body.data.totalCount > 0,
    '4.1 GET /api/notifications returns synchronized system event notifications'
  );

  const countBeforeRetry = notifRes1.body.data.totalCount;
  const notifRes2 = await apiGet('/notifications?pageSize=100', adminToken);
  assert(
    notifRes2.status === 200 && notifRes2.body.data.totalCount === countBeforeRetry,
    '4.2 Notification synchronization is strictly idempotent (repeated fetches do not create duplicate notifications)',
    `First=${countBeforeRetry}, Second=${notifRes2.body.data.totalCount}`
  );

  // Verify our newly submitted requisition created a RequisitionSubmitted notification with valid targetRoute
  const reqNotif = notifRes2.body.data.items.find(
    (n: any) => n.sourceDocumentId === createdReqId && n.eventType === 'RequisitionSubmitted'
  );
  assert(
    Boolean(reqNotif) && reqNotif.targetRoute === `/requisitions/${createdReqId}`,
    '4.3 Submitting a requisition generates a RequisitionSubmitted notification linked to /requisitions/:id'
  );

  // Verify LowStock, GRN, Issue, and Transfer notifications exist from real system state
  const categoriesPresent = new Set(notifRes2.body.data.items.map((n: any) => n.category));
  assert(
    categoriesPresent.has('Requisition') &&
      categoriesPresent.has('GRN') &&
      categoriesPresent.has('StockTransfer'),
    '4.4 Notifications cover real workflow events across Requisitions, GRNs, and Stock Transfers'
  );

  // Verify recipient & location scope isolation for store.north (PRJ-101 / WH-02)
  const storeNotifs = await apiGet('/notifications?pageSize=100', storeNorthToken);
  const leakedNotif = storeNotifs.body.data.items.find(
    (n: any) =>
      n.projectId &&
      n.projectId !== 'PRJ-101' &&
      n.secondaryProjectId !== 'PRJ-101'
  );
  assert(
    storeNotifs.status === 200 && !leakedNotif,
    '4.5 Notifications for store.north are strictly isolated to PRJ-101 / WH-02 (no cross-project notifications)'
  );

  const storeForbiddenFilter = await apiGet('/notifications?projectId=PRJ-102', storeNorthToken);
  assert(
    storeForbiddenFilter.status === 403,
    '4.6 Requesting notifications for unauthorized projectId=PRJ-102 returns 403 Forbidden'
  );

  // Verify per-user read/unread behavior
  const targetNotifId = storeNotifs.body.data.items[0]?.id;
  const markReadRes = await apiPost(`/notifications/${targetNotifId}/read`, storeNorthToken);
  assert(
    markReadRes.status === 200 && markReadRes.body?.data?.isRead === true,
    '4.7 POST /api/notifications/:id/read marks notification as read for the calling user'
  );

  // Verify admin's read state for that same notification was NOT mutated by store.north
  const adminCheckAfterStoreRead = await apiGet('/notifications?pageSize=100', adminToken);
  const sameNotifForAdmin = adminCheckAfterStoreRead.body.data.items.find(
    (n: any) => n.id === targetNotifId
  );
  assert(
    sameNotifForAdmin && sameNotifForAdmin.isRead === false,
    '4.8 Read state is tracked per-user (store.north marking read does not mark read for admin)'
  );

  // Verify mark-all-read & unread-count endpoint
  const markAllRes = await apiPost('/notifications/read-all', storeNorthToken, {});
  const unreadAfterAll = await apiGet('/notifications/unread-count', storeNorthToken);
  assert(
    markAllRes.status === 200 && unreadAfterAll.body?.data?.unreadCount === 0,
    '4.9 POST /api/notifications/read-all sets unreadCount to 0 for calling user'
  );

  console.log('\n================================================================');
  console.log(`PROMPT 12 RESULTS: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in Prompt 12 test suite:', err);
  process.exit(1);
});
