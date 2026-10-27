/**
 * Automated Stock Ledger, Inventory Balances & Weighted-Average Costing Test Suite
 * Prompt 9 Validation Suite
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

async function runStockLedgerTests() {
  console.log('=== STARTING STOCK LEDGER & MOVING WAC COSTING TEST SUITE ===\n');
  try {
    const dataDir = path.join(process.cwd(), 'data');
    fs.writeFileSync(path.join(dataDir, 'inventory_balances.json'), '[]');
    fs.writeFileSync(path.join(dataDir, 'stock_ledger.json'), '[]');
    fs.writeFileSync(path.join(dataDir, 'grns.json'), '[]');
  } catch (e) {}

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      testsFailed++;
    }
  }

  async function apiRequest(
    method: string,
    reqPath: string,
    body?: any,
    token?: string
  ): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : undefined;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (payload) {
        headers['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 3000,
          path: reqPath,
          method,
          headers,
        },
        (res) => {
          let chunks = '';
          res.on('data', (d) => (chunks += d));
          res.on('end', () => {
            try {
              const parsed = chunks ? JSON.parse(chunks) : {};
              resolve({ status: res.statusCode || 500, data: parsed });
            } catch {
              resolve({ status: res.statusCode || 500, data: chunks });
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  function unwrap(res: { status: number; data: any }): any {
    if (res.data && typeof res.data === 'object' && 'data' in res.data && 'success' in res.data) {
      return res.data.data;
    }
    return res.data;
  }

  try {
    // -----------------------------------------------------------------------
    // Section 1: Authentication & Scope Verification
    // -----------------------------------------------------------------------
    console.log('--- Section 1: Authentication & Credentials ---');

    const adminLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'admin',
      password: 'Admin@2026!Stock',
    });
    const adminToken = unwrap(adminLogin)?.accessToken;
    assert(adminLogin.status === 200 && !!adminToken, '1. SuperAdmin authenticated successfully');

    const storeLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'store.north',
      password: 'Store@2026!Keeper',
    });
    const storeToken = unwrap(storeLogin)?.accessToken;
    assert(storeLogin.status === 200 && !!storeToken, '2. Storekeeper authenticated successfully');

    const acctLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'accounts',
      password: 'Accounts@2026!Valuation',
    });
    const acctToken = unwrap(acctLogin)?.accessToken;
    assert(acctLogin.status === 200 && !!acctToken, '3. Accounts Officer authenticated successfully');

    // -----------------------------------------------------------------------
    // Section 2: Inbound Receipt Posting & Inventory Balance Addition
    // -----------------------------------------------------------------------
    console.log('\n--- Section 2: Inbound GRN Receipt Posting & Stock Balance Addition ---');

    // Create a target PO for 100 units of Cement at $12.50
    const createPoRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        supplierId: 'SUP-HORIZON-02',
        projectId: 'PRJ-101',
        orderDate: '2026-03-01',
        expectedDeliveryDate: '2026-03-15',
        paymentTerms: 'Net 30 Days',
        deliveryLocation: 'Metro Central Yard',
        items: [
          {
            materialId: 'MAT-CEM-02',
            orderedQuantity: 100,
            unitRate: 12.50,
          },
        ],
        notes: 'Target PO for Stock Ledger & Moving WAC test suite',
      },
      adminToken
    );
    const po1 = unwrap(createPoRes);
    await apiRequest('POST', `/api/purchase-orders/${po1.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po1.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po1.id}/issue`, {}, adminToken);

    // Initial check: Stock balance for MAT-CEM-02 before GRN posting
    const balBeforeRes = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-101', undefined, adminToken);
    const balBeforeData = unwrap(balBeforeRes);
    const initialQty = balBeforeData.items?.length > 0 ? balBeforeData.items[0].quantityOnHand : 0;
    const initialVal = balBeforeData.items?.length > 0 ? balBeforeData.items[0].inventoryValue : 0;

    // Create GRN 1: Deliver 40 units (all accepted)
    const grn1Res = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: po1.id,
        deliveryChallanNumber: 'DC-CEM-001',
        vehicleNumber: 'TRK-CEM-11',
        items: [
          {
            purchaseOrderItemId: po1.items[0].id,
            deliveredQuantity: 40,
            acceptedQuantity: 40,
            rejectedQuantity: 0,
          },
        ],
      },
      storeToken
    );
    const grn1 = unwrap(grn1Res);

    // Unposted GRN checks: Draft/Inspected/Approved state MUST NOT alter inventory balance or ledger
    await apiRequest('POST', `/api/grns/${grn1.id}/submit`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn1.id}/inspect`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn1.id}/approve`, {}, adminToken);

    const balUnpostedRes = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-101', undefined, adminToken);
    const qtyUnposted = unwrap(balUnpostedRes).items?.[0]?.quantityOnHand || 0;
    assert(
      qtyUnposted === initialQty,
      '4. Unposted GRN (Draft/Inspected/Approved) strictly DOES NOT increase inventory balances'
    );

    // Post GRN 1
    const post1Res = await apiRequest('POST', `/api/grns/${grn1.id}/post`, {}, storeToken);
    assert(post1Res.status === 200, '5. Successfully posted GRN 1 to stock ledger (200 OK)');

    // Verify balance increases by exactly accepted quantity (40)
    const balAfter1Res = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-101', undefined, adminToken);
    const balAfter1 = unwrap(balAfter1Res).items[0];
    assert(
      balAfter1.quantityOnHand === initialQty + 40,
      `6. Posted GRN 1 accepted quantity (40) increased balance on hand (Initial: ${initialQty} -> ${balAfter1.quantityOnHand})`
    );
    assert(
      balAfter1.weightedAverageCost === 12.50,
      '7. Moving WAC calculated accurately ($12.50 / unit)'
    );

    // -----------------------------------------------------------------------
    // Section 3: Exclusion of Rejected / Damaged Quantities & Partial Receipt
    // -----------------------------------------------------------------------
    console.log('\n--- Section 3: Rejection Handling & Partial Accumulation ---');

    // Create GRN 2: Deliver 30 units, accepted 20, rejected 10 (damaged)
    const grn2Res = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: po1.id,
        deliveryChallanNumber: 'DC-CEM-002',
        vehicleNumber: 'TRK-CEM-22',
        items: [
          {
            purchaseOrderItemId: po1.items[0].id,
            deliveredQuantity: 30,
            acceptedQuantity: 20,
            rejectedQuantity: 10,
            damagedQuantity: 10,
            remarks: '10 bags torn during transit; rejected',
          },
        ],
      },
      storeToken
    );
    const grn2 = unwrap(grn2Res);
    await apiRequest('POST', `/api/grns/${grn2.id}/submit`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn2.id}/inspect`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn2.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grn2.id}/post`, {}, storeToken);

    const balAfter2Res = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-101', undefined, adminToken);
    const balAfter2 = unwrap(balAfter2Res).items[0];
    assert(
      balAfter2.quantityOnHand === initialQty + 40 + 20,
      `8. Rejected/damaged bags (10) strictly excluded; only accepted quantity (20) accumulated (Balance: ${balAfter2.quantityOnHand})`
    );

    // -----------------------------------------------------------------------
    // Section 4: Idempotency & Duplicate Replay Protection
    // -----------------------------------------------------------------------
    console.log('\n--- Section 4: Idempotency & Duplicate Replay Protection ---');

    // Attempting to re-post GRN 1 or GRN 2 must fail and not double-count
    const rePostRes = await apiRequest('POST', `/api/grns/${grn1.id}/post`, {}, storeToken);
    assert(rePostRes.status === 400, '9. Duplicate POST retry on already-posted GRN is rejected (400 Bad Request)');

    const balRePostRes = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-101', undefined, adminToken);
    const balRePost = unwrap(balRePostRes).items[0];
    assert(
      balRePost.quantityOnHand === initialQty + 60,
      '10. Duplicate post retry did NOT double-count quantity or corrupt balances'
    );

    // -----------------------------------------------------------------------
    // Section 5: Moving Weighted-Average Costing (WAC) Multi-Tier Recalculation
    // -----------------------------------------------------------------------
    console.log('\n--- Section 5: Moving Weighted-Average Costing (WAC) Multi-Tier ---');

    // Create PO 2 for Cement at a higher cost ($18.00 per unit)
    const po2Res = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        supplierId: 'SUP-HORIZON-02',
        projectId: 'PRJ-101',
        orderDate: '2026-03-10',
        expectedDeliveryDate: '2026-03-20',
        paymentTerms: 'Net 30 Days',
        items: [{ materialId: 'MAT-CEM-02', orderedQuantity: 40, unitRate: 18.00 }],
        notes: 'High cost market price batch for WAC testing',
      },
      adminToken
    );
    const po2 = unwrap(po2Res);
    await apiRequest('POST', `/api/purchase-orders/${po2.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po2.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po2.id}/issue`, {}, adminToken);

    // Deliver 40 units at $18.00
    // Current stock: 60 units @ $12.50 = $750.00
    // Incoming stock: 40 units @ $18.00 = $720.00
    // Total new qty: 100 units; Total new value: $1,470.00
    // New WAC: $1,470 / 100 = $14.7000
    const grn3Res = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: po2.id,
        deliveryChallanNumber: 'DC-CEM-003',
        vehicleNumber: 'TRK-CEM-33',
        items: [{ purchaseOrderItemId: po2.items[0].id, deliveredQuantity: 40, acceptedQuantity: 40, rejectedQuantity: 0 }],
      },
      storeToken
    );
    const grn3 = unwrap(grn3Res);
    await apiRequest('POST', `/api/grns/${grn3.id}/submit`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn3.id}/inspect`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn3.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grn3.id}/post`, {}, storeToken);

    const balAfter3Res = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-101', undefined, adminToken);
    const balAfter3 = unwrap(balAfter3Res).items[0];
    assert(
      balAfter3.quantityOnHand === initialQty + 100,
      `11. Total quantity on hand accumulated to ${balAfter3.quantityOnHand}`
    );
    assert(
      Math.abs(balAfter3.weightedAverageCost - 14.70) < 0.001,
      `12. Moving Weighted-Average Cost recalculated precisely to $14.70 (Actual: $${balAfter3.weightedAverageCost})`
    );
    assert(
      Math.abs(balAfter3.inventoryValue - 1470.00) < 0.01,
      `13. Total inventory valuation recalculated precisely to $1,470.00 (Actual: $${balAfter3.inventoryValue})`
    );

    // -----------------------------------------------------------------------
    // Section 6: Location Boundary Scoping & Isolation
    // -----------------------------------------------------------------------
    console.log('\n--- Section 6: Location Boundary Scoping & Isolation ---');

    // Create PO for same material (Cement) at a DIFFERENT project site (PRJ-102 Harbor Docklands)
    const poHarborRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        supplierId: 'SUP-HORIZON-02',
        projectId: 'PRJ-102',
        orderDate: '2026-03-12',
        expectedDeliveryDate: '2026-03-25',
        paymentTerms: 'Net 30 Days',
        items: [{ materialId: 'MAT-CEM-02', orderedQuantity: 50, unitRate: 15.00 }],
        notes: 'Cement order for Harbor Docklands site',
      },
      adminToken
    );
    const poHarbor = unwrap(poHarborRes);
    await apiRequest('POST', `/api/purchase-orders/${poHarbor.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${poHarbor.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${poHarbor.id}/issue`, {}, adminToken);

    const grnHarborRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: poHarbor.id,
        deliveryChallanNumber: 'DC-HARBOR-01',
        vehicleNumber: 'TRK-HARBOR-01',
        items: [{ purchaseOrderItemId: poHarbor.items[0].id, deliveredQuantity: 50, acceptedQuantity: 50, rejectedQuantity: 0 }],
      },
      adminToken
    );
    const grnHarbor = unwrap(grnHarborRes);
    await apiRequest('POST', `/api/grns/${grnHarbor.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grnHarbor.id}/inspect`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grnHarbor.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grnHarbor.id}/post`, {}, adminToken);

    // Verify balances for PRJ-101 and PRJ-102 remain strictly isolated
    const balMetroRes = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-101', undefined, adminToken);
    const balHarborRes = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-102', undefined, adminToken);

    const balMetro = unwrap(balMetroRes).items[0];
    const balHarbor = unwrap(balHarborRes).items[0];

    assert(
      balMetro.quantityOnHand === initialQty + 100 && balMetro.weightedAverageCost === 14.70,
      `14. Metro site PRJ-101 balance (${balMetro.quantityOnHand}) and WAC ($${balMetro.weightedAverageCost}) remain isolated`
    );
    assert(
      balHarbor.quantityOnHand === 50 && balHarbor.weightedAverageCost === 15.00,
      `15. Harbor site PRJ-102 maintains independent balance (${balHarbor.quantityOnHand}) and WAC ($${balHarbor.weightedAverageCost})`
    );

    // Restrictive role check: Storekeeper North (scoped to PRJ-101/WH-02) cannot access PRJ-102 balances
    const scopedUserBalHarborRes = await apiRequest('GET', '/api/inventory/balances?materialId=MAT-CEM-02&projectId=PRJ-102', undefined, storeToken);
    const scopedUserItems = unwrap(scopedUserBalHarborRes).items || [];
    assert(
      scopedUserItems.length === 0,
      '16. Storekeeper cannot query cross-scope project site PRJ-102 inventory balances (RBAC Enforced)'
    );

    // -----------------------------------------------------------------------
    // Section 7: Missing / Invalid Cost Guards
    // -----------------------------------------------------------------------
    console.log('\n--- Section 7: Invalid Cost Guards & Financial Valuation Protection ---');

    // Create PO item with zero rate
    const zeroCostPoRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        supplierId: 'SUP-APEX-01',
        projectId: 'PRJ-101',
        orderDate: '2026-03-01',
        expectedDeliveryDate: '2026-03-15',
        paymentTerms: 'Net 30 Days',
        items: [{ materialId: 'MAT-STEEL-01', orderedQuantity: 5, unitRate: 0 }],
        notes: 'Test PO with zero cost line item',
      },
      adminToken
    );
    const poZero = unwrap(zeroCostPoRes);
    await apiRequest('POST', `/api/purchase-orders/${poZero.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${poZero.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${poZero.id}/issue`, {}, adminToken);

    const grnZeroRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: poZero.id,
        deliveryChallanNumber: 'DC-ZERO-01',
        items: [{ purchaseOrderItemId: poZero.items[0].id, deliveredQuantity: 5, acceptedQuantity: 5, rejectedQuantity: 0 }],
      },
      adminToken
    );
    const grnZero = unwrap(grnZeroRes);
    await apiRequest('POST', `/api/grns/${grnZero.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grnZero.id}/inspect`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grnZero.id}/approve`, {}, adminToken);

    const postZeroRes = await apiRequest('POST', `/api/grns/${grnZero.id}/post`, {}, adminToken);
    assert(
      postZeroRes.status === 400,
      '17. Rejects inventory posting of receipt with invalid or non-positive unit cost (400 Bad Request)'
    );

    // -----------------------------------------------------------------------
    // Section 8: Ledger Immutability & 405 Method Not Allowed
    // -----------------------------------------------------------------------
    console.log('\n--- Section 8: Ledger Immutability Protections ---');

    const updateLedgerRes = await apiRequest('PUT', '/api/inventory/ledger/STK-2026-0001', { quantityIn: 999 }, adminToken);
    assert(
      updateLedgerRes.status === 405,
      '18. Direct PUT mutation of posted stock ledger entries blocked with 405 Method Not Allowed'
    );

    const deleteLedgerRes = await apiRequest('DELETE', '/api/inventory/ledger/STK-2026-0001', undefined, adminToken);
    assert(
      deleteLedgerRes.status === 405,
      '19. Direct DELETE of posted stock ledger entries blocked with 405 Method Not Allowed'
    );

    const updateBalanceRes = await apiRequest('PUT', '/api/inventory/balances/BAL-001', { quantityOnHand: 999 }, adminToken);
    assert(
      updateBalanceRes.status === 405,
      '20. Direct PUT mutation of stock location balances blocked with 405 Method Not Allowed'
    );

    // -----------------------------------------------------------------------
    // Section 9: Inventory Valuation & Audit Reconciliation
    // -----------------------------------------------------------------------
    console.log('\n--- Section 9: Valuation Summaries & Audit Reconciliation ---');

    const valuationRes = await apiRequest('GET', '/api/inventory/valuation', undefined, acctToken);
    assert(valuationRes.status === 200, '21. GET /api/inventory/valuation returns 200 OK');
    const valuationData = unwrap(valuationRes);
    assert(
      Array.isArray(valuationData.byMaterial) &&
      Array.isArray(valuationData.byWarehouse) &&
      Array.isArray(valuationData.byProject) &&
      valuationData.summary.totalInventoryValue > 0,
      '22. Valuation reports valid rollups by material, warehouse, project, and overall totals'
    );

    const reconRes = await apiRequest('GET', '/api/inventory/reconciliation', undefined, acctToken);
    assert(reconRes.status === 200, '23. GET /api/inventory/reconciliation returns 200 OK');
    const reconData = unwrap(reconRes);
    assert(
      reconData.isReconciled === true && reconData.totalDiscrepancies === 0,
      '24. Audit reconciliation confirms 100% agreement between posted GRNs, Stock Ledger, and Balances'
    );

    // -----------------------------------------------------------------------
    // Section 10: JSON Persistence Verification
    // -----------------------------------------------------------------------
    console.log('\n--- Section 10: JSON Storage Persistence Verification ---');

    const stockLedgerPath = path.resolve(process.cwd(), 'data', 'stock_ledger.json');
    const balancesPath = path.resolve(process.cwd(), 'data', 'inventory_balances.json');

    assert(fs.existsSync(stockLedgerPath), '25. /data/stock_ledger.json exists on disk');
    assert(fs.existsSync(balancesPath), '26. /data/inventory_balances.json exists on disk');

    const diskLedger = JSON.parse(fs.readFileSync(stockLedgerPath, 'utf-8'));
    const diskBalances = JSON.parse(fs.readFileSync(balancesPath, 'utf-8'));

    assert(
      Array.isArray(diskLedger) && diskLedger.some((e: any) => e.sourceDocumentId === grn1.id),
      '27. Stock ledger transactions atomically persisted in /data/stock_ledger.json'
    );

    assert(
      Array.isArray(diskBalances) && diskBalances.some((b: any) => b.materialId === 'MAT-CEM-02' && b.quantityOnHand >= 100),
      '28. Inventory location balances atomically persisted in /data/inventory_balances.json'
    );

  } catch (err: any) {
    console.error('[FATAL EXCEPTION IN TEST RUNNER]', err);
    testsFailed++;
  }

  console.log(`\n=== STOCK LEDGER TEST SUITE COMPLETED: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runStockLedgerTests();
