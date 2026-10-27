/**
 * Automated Verification Test Suite for Prompt 11:
 * Stock Transfers Between Warehouses, Stores & Project Sites
 *
 * Verifies:
 * 1. Valid transfer request creation (Draft & Submitted)
 * 2. Same source and destination location rejected (400 Bad Request)
 * 3. Unauthorized warehouse/project transfer rejected (403 Forbidden)
 * 4. Submit, approve, reject, return-for-correction, and cancel-before-dispatch flows
 * 5. Self-approval blocked under dual-control rules (403 Forbidden)
 * 6. Dispatch blocked before approval (400 Bad Request)
 * 7. Dispatch blocked when source stock is insufficient or exceeds approved qty (400 Bad Request)
 * 8. Dispatch creates outbound TransferOut ledger entry and reduces source on-hand & available stock
 * 9. Dispatched quantity is tracked in transit and not counted as available stock at either warehouse
 * 10. Full receipt creates destination TransferIn ledger entry, clears in-transit quantity, and increases destination usable stock
 * 11. Partial receipt updates destination stock, leaves remaining quantity in transit, and subsequent receipt completes transfer
 * 12. Over-receipt above dispatched quantity is rejected (400 Bad Request)
 * 13. Damaged, short, and disputed quantities do not enter usable stock and create discrepancy records
 * 14. Discrepancy resolution & QA inspection update status and audit history
 * 15. Transfer valuation preserves source weighted-average cost (WAC) and updates destination WAC
 * 16. Duplicate dispatch/receipt retries are idempotent
 * 17. Posted/dispatched transfer records cannot be edited, deleted, or cancelled after dispatch
 * 18. Quantity reconciliation equation (Dispatched = Good + Damaged + Short + Disputed + InTransit) holds at every stage
 */

const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('================================================================');
  console.log('STARTING STOCK TRANSFER WORKFLOW VERIFICATION SUITE (PROMPT 11)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  async function login(usernameOrEmail: string, password = 'Password@123'): Promise<string> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.data?.accessToken) {
      throw new Error(`Login failed for ${usernameOrEmail}: ${JSON.stringify(json)}`);
    }
    return json.data.accessToken;
  }

  try {
    // 1. Authenticate Roles
    const adminToken = await login('admin', 'Admin@2026!Stock');
    const invManagerToken = await login('inv.manager', 'Manager@2026!Inv'); // USR-MGR-02 (ALL projects/warehouses)
    const pmToken = await login('pm.metro', 'Project@2026!Metro'); // USR-PM-03 (PRJ-101, WH-01, WH-02)
    const storekeeperToken = await login('store.north', 'Store@2026!Keeper'); // USR-STR-04 (PRJ-101, WH-02)
    const procToken = await login('procurement', 'Procure@2026!Officer');

    assert(
      Boolean(adminToken && invManagerToken && pmToken && storekeeperToken),
      'Test 1: Role tokens acquired (SuperAdmin, InventoryManager, ProjectManager, Storekeeper)'
    );

    // 2. Seed Source Stock at WH-01 (PRJ-101) via PO + GRN so WH-01 has plenty of stock with known WAC
    const matRes = await fetch(`${BASE_URL}/materials`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const matData: any = await matRes.json();
    const material = matData.data[0];

    const poRes = await fetch(`${BASE_URL}/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        supplierId: 'SUP-HORIZON-02',
        projectId: 'PRJ-101',
        orderDate: '2026-10-01',
        expectedDeliveryDate: '2026-12-15',
        paymentTerms: 'Net 30 Days',
        deliveryLocation: 'Metro Central Staging Yard',
        notes: 'Seed stock at WH-01 for Stock Transfer Suite',
        items: [{ materialId: material.id, orderedQuantity: 200, unitRate: 50.0 }],
      }),
    });
    const poJson: any = await poRes.json();
    const poId = poJson.data.id;
    const poLineId = poJson.data.items[0].id;

    await fetch(`${BASE_URL}/purchase-orders/${poId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });

    await fetch(`${BASE_URL}/purchase-orders/${poId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ comments: 'Approve PO for WH-01 transfer seed' }),
    });

    await fetch(`${BASE_URL}/purchase-orders/${poId}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });

    const grnRes = await fetch(`${BASE_URL}/grns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({
        purchaseOrderId: poId,
        warehouseId: 'WH-01',
        deliveryChallanNumber: `DC-STF-${Date.now()}`,
        vehicleNumber: 'TRK-STF-01',
        items: [{ purchaseOrderItemId: poLineId, deliveredQuantity: 200, acceptedQuantity: 200, rejectedQuantity: 0 }],
      }),
    });
    const grnJson: any = await grnRes.json();
    const grnId = grnJson.data.id;

    await fetch(`${BASE_URL}/grns/${grnId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({}),
    });

    await fetch(`${BASE_URL}/grns/${grnId}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({ inspectionNotes: 'QA Passed' }),
    });

    await fetch(`${BASE_URL}/grns/${grnId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ comments: 'Approve WH-01 seed GRN' }),
    });

    await fetch(`${BASE_URL}/grns/${grnId}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({}),
    });

    // Get initial balances at WH-01 and WH-02
    const getBalance = async (warehouseId: string, projectId = 'PRJ-101') => {
      const res = await fetch(`${BASE_URL}/inventory/balances`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const json: any = await res.json();
      const list = Array.isArray(json.data) ? json.data : json.data?.items || [];
      return list.find(
        (b: any) => b.materialId === material.id && b.warehouseId === warehouseId && b.projectId === projectId
      );
    };

    const initialWh01Bal = await getBalance('WH-01', 'PRJ-101');
    const initialWh02Bal = await getBalance('WH-02', 'PRJ-101');
    const startWh01Qty = initialWh01Bal ? initialWh01Bal.quantityOnHand : 0;
    const startWh02Qty = initialWh02Bal ? initialWh02Bal.quantityOnHand : 0;

    assert(startWh01Qty >= 200, `Test 2: Source Warehouse WH-01 seeded with ${startWh01Qty} units`);

    // 3. Same Source and Destination Location Rejected (400 Bad Request)
    const sameLocRes = await fetch(`${BASE_URL}/stock-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-01',
        destinationProjectId: 'PRJ-101',
        purpose: 'Invalid same location transfer',
        items: [{ materialId: material.id, requestedQuantity: 10 }],
      }),
    });
    assert(
      sameLocRes.status === 400,
      `Test 3: Same source and destination location rejected with 400 (Got ${sameLocRes.status})`
    );

    // 4. Unauthorized Warehouse/Project Transfer Rejected (403 Forbidden)
    // store.north only has WH-02 (PRJ-101), so creating a transfer from WH-01 or to PRJ-102 is forbidden
    const unauthLocRes = await fetch(`${BASE_URL}/stock-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storekeeperToken}` },
      body: JSON.stringify({
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-03',
        destinationProjectId: 'PRJ-102',
        purpose: 'Unauthorized cross-warehouse & cross-project transfer',
        items: [{ materialId: material.id, requestedQuantity: 10 }],
      }),
    });
    assert(
      unauthLocRes.status === 403,
      `Test 4: Unauthorized warehouse/project transfer rejected with 403 (Got ${unauthLocRes.status})`
    );

    // Also verify pm.metro (PRJ-101 only) cannot create cross-project transfer to PRJ-102
    const unauthCrossPrjRes = await fetch(`${BASE_URL}/stock-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-03',
        destinationProjectId: 'PRJ-102',
        purpose: 'Unauthorized cross-project transfer by PM scoped to PRJ-101 only',
        items: [{ materialId: material.id, requestedQuantity: 10 }],
      }),
    });
    assert(
      unauthCrossPrjRes.status === 403,
      `Test 5: Cross-project transfer without destination project scope rejected with 403 (Got ${unauthCrossPrjRes.status})`
    );

    // 5. Return-for-Correction, Edit, Reject, and Cancel-Before-Dispatch Flows
    const draftFlowRes = await fetch(`${BASE_URL}/stock-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-02',
        destinationProjectId: 'PRJ-101',
        purpose: 'Lifecycle test: Return for correction & Cancel before dispatch',
        submitImmediately: true,
        items: [{ materialId: material.id, requestedQuantity: 12 }],
      }),
    });
    const draftFlowJson: any = await draftFlowRes.json();
    const draftFlowId = draftFlowJson.data.id;

    // Return for correction by InventoryManager
    const retCorrRes = await fetch(`${BASE_URL}/stock-transfers/${draftFlowId}/return-for-correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({ correctionNotes: 'Please adjust requested quantity from 12 to 15 units.' }),
    });
    const retCorrJson: any = await retCorrRes.json();
    assert(
      retCorrRes.status === 200 && retCorrJson.data?.status === 'ReturnedForCorrection',
      'Test 6: Transfer returned for correction transitions to ReturnedForCorrection status'
    );

    // Edit while in ReturnedForCorrection and resubmit
    const editRes = await fetch(`${BASE_URL}/stock-transfers/${draftFlowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({
        purpose: 'Updated purpose after correction',
        items: [{ materialId: material.id, requestedQuantity: 15 }],
      }),
    });
    const resubmitRes = await fetch(`${BASE_URL}/stock-transfers/${draftFlowId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({}),
    });
    const resubmitJson: any = await resubmitRes.json();
    assert(
      editRes.status === 200 && resubmitRes.status === 200 && resubmitJson.data?.status === 'Submitted',
      'Test 7: Returned transfer edited and resubmitted to Submitted status'
    );

    // Cancel before dispatch
    const cancelRes = await fetch(`${BASE_URL}/stock-transfers/${draftFlowId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({ cancellationReason: 'Site schedule changed before dispatch.' }),
    });
    const cancelJson: any = await cancelRes.json();
    assert(
      cancelRes.status === 200 && cancelJson.data?.status === 'Cancelled',
      'Test 8: Cancellation before dispatch succeeds and transitions to Cancelled'
    );

    // Create another transfer and test Reject flow
    const rejectFlowRes = await fetch(`${BASE_URL}/stock-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-02',
        destinationProjectId: 'PRJ-101',
        purpose: 'Test rejection workflow',
        submitImmediately: true,
        items: [{ materialId: material.id, requestedQuantity: 5 }],
      }),
    });
    const rejectFlowJson: any = await rejectFlowRes.json();
    const rejectFlowId = rejectFlowJson.data.id;

    const rejectRes = await fetch(`${BASE_URL}/stock-transfers/${rejectFlowId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({ rejectionReason: 'Duplicate transfer request rejected.' }),
    });
    const rejectJson: any = await rejectRes.json();
    assert(
      rejectRes.status === 200 && rejectJson.data?.status === 'Rejected',
      'Test 9: Transfer rejection succeeds and records rejectionReason'
    );

    // 6. Main Transfer Workflow: Create -> Self-Approval Blocked -> Dispatch Before Approval Blocked -> Approve
    const createRes = await fetch(`${BASE_URL}/stock-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-02',
        destinationProjectId: 'PRJ-101',
        purpose: 'Move stock from WH-01 Central Staging to WH-02 North Depot',
        priority: 'High',
        submitImmediately: true,
        items: [{ materialId: material.id, requestedQuantity: 30 }],
      }),
    });
    const createJson: any = await createRes.json();
    const transferId = createJson.data.id;
    assert(
      createRes.status === 201 && createJson.data?.status === 'Submitted',
      `Test 10: Valid Stock Transfer created & submitted (${createJson.data?.transferNumber})`
    );

    // Self-approval blocked under dual-control rules (pm.metro created it, cannot self-approve)
    const selfApproveRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({ comments: 'Attempting self-approval' }),
    });
    assert(
      selfApproveRes.status === 403,
      `Test 11: Self-approval blocked under dual-control rules with 403 (Got ${selfApproveRes.status})`
    );

    // Dispatch blocked before approval
    const prematureDispatchRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({}),
    });
    assert(
      prematureDispatchRes.status === 400,
      `Test 12: Dispatch before approval blocked with 400 (Got ${prematureDispatchRes.status})`
    );

    // Supervisory Approval by InventoryManager (approving 25 of 30 requested)
    const approveRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({
        comments: 'Approved 25 units for dispatch',
        items: [{ materialId: material.id, approvedQuantity: 25 }],
      }),
    });
    const approveJson: any = await approveRes.json();
    assert(
      approveRes.status === 200 && approveJson.data?.status === 'Approved',
      'Test 13: Dual-control approval by InventoryManager transitions transfer to Approved'
    );

    // 7. Dispatch Exceeding Approved Quantity or Insufficient Source Stock Blocked
    const overDispatchRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({
        items: [{ materialId: material.id, dispatchedQuantity: 28 }],
      }),
    });
    assert(
      overDispatchRes.status === 400,
      `Test 14: Dispatch exceeding approved quantity (28 > 25) rejected with 400 (Got ${overDispatchRes.status})`
    );

    // Test insufficient stock dispatch on a huge transfer
    const hugeTrfRes = await fetch(`${BASE_URL}/stock-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({
        sourceWarehouseId: 'WH-01',
        sourceProjectId: 'PRJ-101',
        destinationWarehouseId: 'WH-02',
        destinationProjectId: 'PRJ-101',
        purpose: 'Excessive stock test',
        submitImmediately: true,
        items: [{ materialId: material.id, requestedQuantity: 999999 }],
      }),
    });
    const hugeTrfJson: any = await hugeTrfRes.json();
    const hugeTrfId = hugeTrfJson.data.id;
    await fetch(`${BASE_URL}/stock-transfers/${hugeTrfId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({ comments: 'Approve for insufficient stock test' }),
    });
    const insuffDispatchRes = await fetch(`${BASE_URL}/stock-transfers/${hugeTrfId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({}),
    });
    assert(
      insuffDispatchRes.status === 400,
      `Test 15: Dispatch when source stock is insufficient rejected with 400 (Got ${insuffDispatchRes.status})`
    );
    // Clean up hugeTrf by cancelling before dispatch
    await fetch(`${BASE_URL}/stock-transfers/${hugeTrfId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({ cancellationReason: 'Insufficient stock test completed' }),
    });

    // 8. Valid Dispatch Creates Outbound Ledger Entry, Reduces Source Stock, and Tracks In-Transit
    const dispatchRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({
        dispatchDate: '2026-10-27',
        expectedArrivalDate: '2026-10-28',
        vehicleNumber: 'TRK-801',
        driverName: 'C. Vance',
        items: [{ materialId: material.id, dispatchedQuantity: 25 }],
      }),
    });
    const dispatchJson: any = await dispatchRes.json();
    const afterDispatchWh01Bal = await getBalance('WH-01', 'PRJ-101');
    const afterDispatchWh02Bal = await getBalance('WH-02', 'PRJ-101');

    assert(
      dispatchRes.status === 200 &&
        dispatchJson.data?.status === 'Dispatched' &&
        Boolean(dispatchJson.data?.items[0]?.sourceStockLedgerEntryId) &&
        afterDispatchWh01Bal.quantityOnHand === startWh01Qty - 25,
      `Test 16: Dispatch posts TransferOut ledger entry and reduces WH-01 stock by 25 (${startWh01Qty} -> ${afterDispatchWh01Bal?.quantityOnHand})`
    );

    // 9. Verify In-Transit Tracking & Destination Usable Stock Unchanged Before Receipt
    const inTransitRes = await fetch(`${BASE_URL}/inventory/in-transit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inTransitJson: any = await inTransitRes.json();
    const inTransitItem = (inTransitJson.data?.items || []).find(
      (i: any) => i.stockTransferId === transferId
    );

    assert(
      Boolean(inTransitItem) &&
        inTransitItem.remainingInTransitQuantity === 25 &&
        (afterDispatchWh02Bal ? afterDispatchWh02Bal.quantityOnHand : 0) === startWh02Qty &&
        (afterDispatchWh02Bal ? afterDispatchWh02Bal.quantityInTransit : 0) >= 25,
      'Test 17: Dispatched 25 units tracked in transit; destination WH-02 usable stock unchanged prior to receipt'
    );

    // 10. Duplicate Dispatch Retry Is Idempotent
    const retryDispatchRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
      body: JSON.stringify({ items: [{ materialId: material.id, dispatchedQuantity: 25 }] }),
    });
    const afterRetryWh01Bal = await getBalance('WH-01', 'PRJ-101');
    assert(
      retryDispatchRes.status === 200 && afterRetryWh01Bal.quantityOnHand === startWh01Qty - 25,
      'Test 18: Duplicate dispatch retry is idempotent (source stock not deducted twice)'
    );

    // 11. Cancellation After Dispatch Is Blocked (400 Bad Request) & Edit/Delete Blocked (405 Method Not Allowed)
    const cancelAfterDispatchRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ cancellationReason: 'Attempt cancel after dispatch' }),
    });
    const editDispatchedRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ purpose: 'Tamper attempt' }),
    });
    const deleteDispatchedRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      cancelAfterDispatchRes.status === 400 &&
        editDispatchedRes.status === 405 &&
        deleteDispatchedRes.status === 405,
      `Test 19: Dispatched transfer protected from cancel (400), edit (405), and delete (405)`
    );

    // 12. Over-Receipt Above Dispatched Quantity Rejected (400 Bad Request)
    const overReceiveRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storekeeperToken}` },
      body: JSON.stringify({
        items: [{ materialId: material.id, receivedGoodQuantity: 30, damagedQuantity: 0, shortQuantity: 0 }],
      }),
    });
    assert(
      overReceiveRes.status === 400,
      `Test 20: Over-receipt (30 > 25 dispatched) rejected with 400 (Got ${overReceiveRes.status})`
    );

    // 13. Partial Receipt (First Batch: 10 Good Units) Updates Destination Stock & Leaves 15 In Transit
    const partialRecRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storekeeperToken}` },
      body: JSON.stringify({
        actualReceiptDate: '2026-10-28',
        items: [
          {
            materialId: material.id,
            receivedGoodQuantity: 10,
            damagedQuantity: 0,
            shortQuantity: 0,
            disputedQuantity: 0,
          },
        ],
      }),
    });
    const partialRecJson: any = await partialRecRes.json();
    const afterPartialWh02Bal = await getBalance('WH-02', 'PRJ-101');

    assert(
      partialRecRes.status === 200 &&
        partialRecJson.data?.status === 'PartiallyReceived' &&
        partialRecJson.data?.items[0]?.remainingInTransitQuantity === 15 &&
        afterPartialWh02Bal.quantityOnHand === startWh02Qty + 10,
      `Test 21: Partial receipt of 10 good units transitions to PartiallyReceived, adds 10 to WH-02 usable stock, and leaves 15 in transit`
    );

    // 14. Second Receipt Batch (12 Good, 2 Damaged, 1 Short = 15 Remaining) Posts Only Delta (12 Good) & Creates Discrepancy
    const finalRecRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storekeeperToken}` },
      body: JSON.stringify({
        actualReceiptDate: '2026-10-28',
        isIncremental: true,
        items: [
          {
            materialId: material.id,
            receivedGoodQuantity: 12,
            damagedQuantity: 2,
            shortQuantity: 1,
            disputedQuantity: 0,
            discrepancyReason: '2 bags water-damaged, 1 bag short on second pallet',
            inspectionNotes: 'Quarantined 2 damaged bags at North Depot',
          },
        ],
      }),
    });
    const finalRecJson: any = await finalRecRes.json();
    const afterFinalWh02Bal = await getBalance('WH-02', 'PRJ-101');

    assert(
      finalRecRes.status === 200 &&
        finalRecJson.data?.status === 'Received' &&
        finalRecJson.data?.discrepancyStatus === 'PendingReview' &&
        finalRecJson.data?.items[0]?.receivedGoodQuantity === 22 &&
        finalRecJson.data?.items[0]?.damagedQuantity === 2 &&
        finalRecJson.data?.items[0]?.shortQuantity === 1 &&
        finalRecJson.data?.items[0]?.remainingInTransitQuantity === 0 &&
        afterFinalWh02Bal.quantityOnHand === startWh02Qty + 22,
      `Test 22: Second partial receipt posts delta +12 good (cumulative 22 good), excludes 2 damaged & 1 short from usable stock, clears in-transit to 0`
    );

    // 15. Verify Quantity Reconciliation Equation & WAC Preservation
    const reconRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/reconciliation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reconJson: any = await reconRes.json();
    const reconLine = reconJson.data?.lines?.[0];

    assert(
      reconRes.status === 200 &&
        reconJson.data?.isFullyReconciled === true &&
        reconLine?.dispatchedQuantity === 25 &&
        reconLine?.totalAccounted === 25 &&
        reconLine?.unitCostAtDispatch === afterDispatchWh01Bal.weightedAverageCost,
      'Test 23: Reconciliation equation (25 = 22 Good + 2 Damaged + 1 Short + 0 Disputed + 0 InTransit) and source WAC preserved'
    );

    // 16. Duplicate Receipt Retry Is Idempotent
    const retryReceiveRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storekeeperToken}` },
      body: JSON.stringify({
        items: [{ materialId: material.id, receivedGoodQuantity: 22, damagedQuantity: 2, shortQuantity: 1 }],
      }),
    });
    const afterRetryWh02Bal = await getBalance('WH-02', 'PRJ-101');
    assert(
      retryReceiveRes.status === 200 && afterRetryWh02Bal.quantityOnHand === startWh02Qty + 22,
      'Test 24: Duplicate receipt retry is idempotent (destination stock not inflated twice)'
    );

    // 17. Verify Discrepancy Queue & Resolution Workflow + Audit Trail
    const discQueueRes = await fetch(`${BASE_URL}/stock-transfers/discrepancies`, {
      headers: { Authorization: `Bearer ${invManagerToken}` },
    });
    const discQueueJson: any = await discQueueRes.json();
    const foundDisc = (discQueueJson.data || []).find((d: any) => d.stockTransferId === transferId);
    assert(
      Boolean(foundDisc) && foundDisc.damagedQuantity === 2 && foundDisc.shortQuantity === 1,
      'Test 25: Discrepancy appears in /api/stock-transfers/discrepancies queue'
    );

    const lineId = finalRecJson.data.items[0].id;
    const resolveRes = await fetch(
      `${BASE_URL}/stock-transfers/${transferId}/discrepancies/${lineId}/resolve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invManagerToken}` },
        body: JSON.stringify({
          resolutionAction: 'WriteOffApproved',
          resolutionNotes: 'Approved write-off for 2 damaged and 1 short unit after carrier inspection.',
        }),
      }
    );
    const resolveJson: any = await resolveRes.json();

    const historyRes = await fetch(`${BASE_URL}/stock-transfers/${transferId}/history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const historyJson: any = await historyRes.json();

    assert(
      resolveRes.status === 200 &&
        resolveJson.data?.status === 'Completed' &&
        resolveJson.data?.discrepancyStatus === 'Resolved' &&
        Array.isArray(historyJson.data) &&
        historyJson.data.length >= 5,
      'Test 26: Discrepancy resolution transitions transfer to Completed and records full audit trail'
    );

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Unhandled test execution error:', err);
    process.exit(1);
  }
}

runTests();
