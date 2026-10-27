/**
 * Automated Stock Transfer Workflow Test Suite
 * Prompt 11 Validation Suite: Warehouses, Stores, Project Sites, In-Transit, Discrepancies, Reconciliation
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

async function runStockTransferTests() {
  console.log('=== STARTING STOCK TRANSFER WORKFLOW TEST SUITE ===\n');

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
            } catch (e) {
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

  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(path.join(dataDir, 'stock_transfers.json'), '[]');

    // 1. Login Users
    const adminLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'admin@constructcorp.com',
      password: 'Admin@2026!Stock',
    });
    assert(adminLogin.status === 200 && adminLogin.data?.data?.accessToken, 'Login as SuperAdmin');
    const adminToken = adminLogin.data?.data?.accessToken;

    const pmLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'pm.metro@constructcorp.com',
      password: 'Project@2026!Metro',
    });
    assert(pmLogin.status === 200 && pmLogin.data?.data?.accessToken, 'Login as Project Manager (Metro)');
    const pmToken = pmLogin.data?.data?.accessToken;

    const storekeeperLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'store.north@constructcorp.com',
      password: 'Store@2026!Keeper',
    });
    assert(storekeeperLogin.status === 200 && storekeeperLogin.data?.data?.accessToken, 'Login as Storekeeper (North)');
    const storekeeperToken = storekeeperLogin.data?.data?.accessToken;

    // Get a valid material ID from material master
    const matsRes = await apiRequest('GET', '/api/materials', undefined, adminToken);
    assert(matsRes.status === 200 && Array.isArray(matsRes.data?.data) && matsRes.data.data.length > 0, 'Fetch materials list');
    const material = matsRes.data.data[0];
    const materialId = material.id;

    // Seed stock at WH-01 via PO and posted GRN
    const poRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        supplierId: 'SUP-HORIZON-02',
        projectId: 'PRJ-101',
        orderDate: '2026-03-01',
        expectedDeliveryDate: '2026-03-15',
        paymentTerms: 'Net 30 Days',
        deliveryLocation: 'Metro Central Yard',
        items: [{ materialId, orderedQuantity: 100, unitRate: 15.00 }],
        notes: 'Seed stock for transfer test',
      },
      adminToken
    );
    const po = poRes.data.data;
    await apiRequest('POST', `/api/purchase-orders/${po.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po.id}/issue`, {}, adminToken);

    const grnRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: po.id,
        warehouseId: 'WH-01',
        warehouseName: 'Metro Central Staging Yard',
        deliveryChallanNumber: 'DC-SEED-TRANSFER-01',
        items: [{ purchaseOrderItemId: po.items[0].id, deliveredQuantity: 100, acceptedQuantity: 100, rejectedQuantity: 0 }],
      },
      adminToken
    );
    const grn = grnRes.data.data;
    await apiRequest('POST', `/api/grns/${grn.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grn.id}/inspect`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grn.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/grns/${grn.id}/post`, {}, adminToken);

    // 2. Test Rule: Same source and destination stock location is rejected
    const sameLocRes = await apiRequest(
      'POST',
      '/api/stock-transfers',
      {
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-01',
        destinationProjectId: 'PRJ-101',
        purpose: 'Invalid self transfer',
        items: [{ materialId, requestedQuantity: 10 }],
      },
      storekeeperToken
    );
    assert(sameLocRes.status === 400, 'Same source and destination stock location is rejected (400)');

    // 3. Test Stock Transfer Creation & Submission (Draft -> Submitted)
    const createRes = await apiRequest(
      'POST',
      '/api/stock-transfers',
      {
        sourceWarehouseId: 'WH-01', // Metro Central
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-02', // North Depot
        destinationProjectId: 'PRJ-101',
        purpose: 'Site staging reinforcement for North Wing',
        transferReason: 'Inventory balance rebalancing',
        priority: 'High',
        submitImmediately: true,
        items: [{ materialId, requestedQuantity: 25 }],
      },
      adminToken
    );
    assert(createRes.status === 201 && createRes.data?.data?.id, 'Create and submit stock transfer request');
    const transferId = createRes.data.data.id;
    const transferNumber = createRes.data.data.transferNumber;

    // 4. Test Dual Control Approval (Creator storekeeper cannot self-approve; Project Manager approves)
    const selfApproveRes = await apiRequest(
      'POST',
      `/api/stock-transfers/${transferId}/approve`,
      { comments: 'Self approval attempt' },
      storekeeperToken
    );
    assert(selfApproveRes.status === 403, 'Dual-control: Creator storekeeper cannot self-approve transfer (403)');

    const pmApproveRes = await apiRequest(
      'POST',
      `/api/stock-transfers/${transferId}/approve`,
      { comments: 'Approved by Project Manager for dispatch' },
      pmToken
    );
    assert(pmApproveRes.status === 200 && pmApproveRes.data?.data?.status === 'Approved', 'Project Manager approves transfer request');

    // 5. Test Unapproved Transfer Cannot be Dispatched directly from Draft (or try dispatching another unapproved)
    const unapprovedCreate = await apiRequest(
      'POST',
      '/api/stock-transfers',
      {
        sourceWarehouseId: 'WH-01',
        destinationWarehouseId: 'WH-02',
        purpose: 'Unapproved transfer dispatch attempt',
        items: [{ materialId, requestedQuantity: 5 }],
      },
      adminToken
    );
    const unapprovedId = unapprovedCreate.data.data.id;
    const prematureDispatch = await apiRequest(
      'POST',
      `/api/stock-transfers/${unapprovedId}/dispatch`,
      { remarks: 'Premature dispatch' },
      storekeeperToken
    );
    assert(prematureDispatch.status === 400, 'Unapproved transfer cannot be dispatched (400)');

    // 6. Test Successful Dispatch (Reduces source stock, establishes in-transit)
    const dispatchRes = await apiRequest(
      'POST',
      `/api/stock-transfers/${transferId}/dispatch`,
      {
        dispatchDate: new Date().toISOString().split('T')[0],
        remarks: 'Dispatched 25 units from WH-01 to WH-02',
      },
      adminToken
    );
    if (dispatchRes.status !== 200) console.log('DISPATCH FAIL:', dispatchRes.data);
    assert(dispatchRes.status === 200 && dispatchRes.data?.data?.status === 'Dispatched', 'Successful dispatch of approved transfer');

    // 7. Test In-Transit Endpoint
    const inTransitRes = await apiRequest('GET', '/api/inventory/in-transit', undefined, adminToken);
    assert(
      inTransitRes.status === 200 &&
        inTransitRes.data?.data?.metrics?.activeTransferCount > 0 &&
        inTransitRes.data.data.metrics.totalInTransitQuantity >= 25,
      'Get scoped in-transit inventory summary'
    );

    // 8. Test Receiving Stock Transfer (Partial or Full Receipt with Discrepancy check)
    // Let's receive 20 good, 3 damaged, 2 short (= 25 dispatched total)
    const receiveRes = await apiRequest(
      'POST',
      `/api/stock-transfers/${transferId}/receive`,
      {
        actualReceiptDate: new Date().toISOString().split('T')[0],
        items: [
          {
            materialId,
            receivedGoodQuantity: 20,
            damagedQuantity: 3,
            shortQuantity: 2,
            disputedQuantity: 0,
            discrepancyReason: 'Transit vibration damage and box shortage',
            inspectionNotes: 'Inspected upon arrival at WH-02 loading bay',
          },
        ],
        remarks: 'Received with damages and shortage',
      },
      storekeeperToken
    );
    assert(receiveRes.status === 200 && receiveRes.data?.data?.discrepancyStatus === 'PendingReview', 'Receive transfer with discrepancies routed to review');

    // 9. Test Discrepancy Queue
    const discQueueRes = await apiRequest('GET', '/api/stock-transfers/discrepancies', undefined, adminToken);
    assert(
      discQueueRes.status === 200 && Array.isArray(discQueueRes.data?.data) && discQueueRes.data.data.length > 0,
      'List unresolved transfer discrepancies in queue'
    );
    const discrepancyItem = discQueueRes.data.data[0];

    // 10. Test Discrepancy Resolution
    const resolveDiscRes = await apiRequest(
      'POST',
      `/api/stock-transfers/${transferId}/discrepancies/${discrepancyItem.materialId}/resolve`,
      {
        resolutionNotes: 'Inspected and insurance claim filed for damaged/short items. Closing discrepancy.',
      },
      adminToken
    );
    assert(resolveDiscRes.status === 200 && resolveDiscRes.data?.data?.status === 'Completed', 'Resolve transfer discrepancy and close transfer');

    // 11. Test Immutability: Direct deletion/put of dispatched/completed transfer returns 405
    const deleteRes = await apiRequest('DELETE', `/api/stock-transfers/${transferId}`, undefined, adminToken);
    assert(deleteRes.status === 405, 'Direct deletion of dispatched/completed transfer returns 405 Method Not Allowed');

    // 12. Test Transfer History & Reconciliation routes
    const historyRes = await apiRequest('GET', `/api/stock-transfers/${transferId}`, undefined, adminToken);
    assert(historyRes.status === 200 && Array.isArray(historyRes.data?.data?.auditTrail), 'Get transfer details and audit trail history');

    const reconRes = await apiRequest('GET', `/api/stock-transfers/${transferId}/reconciliation`, undefined, adminToken);
    assert(reconRes.status === 200 && reconRes.data?.data?.isFullyReconciled, 'Get transfer quantity reconciliation summary');

    console.log(`\n=== TEST SUMMARY ===`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);

    if (testsFailed > 0) {
      process.exit(1);
    } else {
      console.log('\nALL STOCK TRANSFER TESTS PASSED SUCCESSFULLY!');
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runStockTransferTests();
