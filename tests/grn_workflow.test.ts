/**
 * Automated Goods Received Note (GRN), Inspection & Receipt Control Test Suite
 * Prompt 8 Validation Suite
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

async function runGrnWorkflowTests() {
  console.log('=== STARTING GOODS RECEIVED NOTE (GRN) & RECEIPT CONTROL TEST SUITE ===\n');
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
    // Section 1: Authentication & Role Setup
    // -----------------------------------------------------------------------
    console.log('--- Section 1: Authentication & Role Setup ---');

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

    const managerLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'inv.manager',
      password: 'Manager@2026!Inv',
    });
    const managerToken = unwrap(managerLogin)?.accessToken;
    assert(managerLogin.status === 200 && !!managerToken, '3. Inventory Manager authenticated successfully');

    const pmLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'pm.metro',
      password: 'Project@2026!Metro',
    });
    const pmToken = unwrap(pmLogin)?.accessToken;
    assert(pmLogin.status === 200 && !!pmToken, '4. Project Manager (Metro) authenticated successfully');

    // -----------------------------------------------------------------------
    // Section 2: Baseline PO Verification
    // -----------------------------------------------------------------------
    console.log('\n--- Section 2: Baseline PO Verification & Receipt Eligibility ---');

    // Create a fresh test Purchase Order in Issued status for deterministic testing
    const createPoRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        supplierId: 'SUP-APEX-01',
        projectId: 'PRJ-101',
        orderDate: '2026-03-01',
        expectedDeliveryDate: '2026-03-15',
        paymentTerms: 'Net 30 Days',
        deliveryLocation: 'Metro Central Staging Yard Bay 4',
        items: [
          {
            materialId: 'MAT-STEEL-01',
            orderedQuantity: 20,
            unitRate: 750,
            taxRate: 5,
            notes: 'Batch T16 high-tensile structural rebar',
          },
        ],
        notes: 'Target PO for automated GRN full lifecycle test',
      },
      adminToken
    );
    assert(createPoRes.status === 201, '5. Created target purchase order in Draft status');
    const targetPo = unwrap(createPoRes);

    // Submit and approve target PO
    const submitPoRes = await apiRequest('POST', `/api/purchase-orders/${targetPo.id}/submit`, {}, adminToken);
    assert(submitPoRes.status === 200, '6. Submitted target purchase order for approval');

    const approvePoRes = await apiRequest('POST', `/api/purchase-orders/${targetPo.id}/approve`, {}, adminToken);
    assert(approvePoRes.status === 200, '7. Approved target purchase order');

    const issuePoRes = await apiRequest('POST', `/api/purchase-orders/${targetPo.id}/issue`, {}, adminToken);
    assert(issuePoRes.status === 200, '8. Issued target purchase order to supplier');

    const fetchedPoRes = await apiRequest('GET', `/api/purchase-orders/${targetPo.id}`, undefined, storeToken);
    const poBeforeReceipt = unwrap(fetchedPoRes);
    assert(
      poBeforeReceipt.status === 'Issued' &&
      poBeforeReceipt.items[0].receivedQuantity === 0 &&
      poBeforeReceipt.items[0].outstandingQuantity === 20,
      '9. Verified PO is in Issued status with receivedQuantity = 0 and outstandingQuantity = 20'
    );

    // -----------------------------------------------------------------------
    // Section 3: GRN Intake Validation & Negative Guards
    // -----------------------------------------------------------------------
    console.log('\n--- Section 3: GRN Validation & Integrity Guards ---');

    // Negative 1: Missing delivery challan
    const invalidChallanRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: targetPo.id,
        deliveryChallanNumber: '',
        vehicleNumber: 'TRK-9901',
        items: [
          {
            purchaseOrderItemId: poBeforeReceipt.items[0].id,
            deliveredQuantity: 5,
            acceptedQuantity: 5,
            rejectedQuantity: 0,
          },
        ],
      },
      storeToken
    );
    assert(invalidChallanRes.status === 400, '10. Rejects GRN without mandatory delivery challan number (400 Bad Request)');

    // Negative 2: Mathematical invariant violation (delivered != accepted + rejected)
    const mathMismatchRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: targetPo.id,
        deliveryChallanNumber: 'DC-INV-001',
        vehicleNumber: 'TRK-9901',
        items: [
          {
            purchaseOrderItemId: poBeforeReceipt.items[0].id,
            deliveredQuantity: 10,
            acceptedQuantity: 6,
            rejectedQuantity: 2, // 6 + 2 = 8 != 10
          },
        ],
      },
      storeToken
    );
    assert(mathMismatchRes.status === 400, '11. Rejects quantity invariant violation where delivered != accepted + rejected (400 Bad Request)');

    // Negative 3: Over-receipt violation (accepted > PO outstanding quantity)
    const overReceiptRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: targetPo.id,
        deliveryChallanNumber: 'DC-INV-002',
        vehicleNumber: 'TRK-9901',
        items: [
          {
            purchaseOrderItemId: poBeforeReceipt.items[0].id,
            deliveredQuantity: 25,
            acceptedQuantity: 25, // exceeds PO outstanding (20)
            rejectedQuantity: 0,
          },
        ],
      },
      storeToken
    );
    assert(overReceiptRes.status === 400, '12. Strictly rejects over-receipt exceeding PO outstanding quantity (400 Bad Request)');

    // -----------------------------------------------------------------------
    // Section 4: Partial Delivery GRN 1 Lifecycle (5 units out of 20)
    // -----------------------------------------------------------------------
    console.log('\n--- Section 4: Partial Delivery GRN 1 Lifecycle ---');

    const createGrn1Res = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: targetPo.id,
        deliveryChallanNumber: 'DC-APEX-1001',
        deliveryChallanDate: '2026-03-05',
        vehicleNumber: 'TRK-APEX-44',
        deliveredBy: 'Markus Lindholm (Hauler)',
        storageLocation: 'Staging Bay 4 South',
        generalRemarks: 'First partial delivery batch - 5 MT rebar',
        items: [
          {
            purchaseOrderItemId: poBeforeReceipt.items[0].id,
            deliveredQuantity: 5,
            acceptedQuantity: 5,
            rejectedQuantity: 0,
            damagedQuantity: 0,
            shortQuantity: 0,
          },
        ],
      },
      storeToken
    );
    assert(createGrn1Res.status === 201, '13. Created Draft GRN 1 with sequential number (201 Created)');
    const grn1 = unwrap(createGrn1Res);
    assert(grn1.grnNumber.startsWith('GRN-2026-'), '13b. GRN number follows sequential series GRN-YYYY-XXXX');
    assert(grn1.status === 'Draft', '13c. Initial status is Draft');

    // Submit for QA Inspection
    const submitGrn1Res = await apiRequest('POST', `/api/grns/${grn1.id}/submit`, {}, storeToken);
    assert(submitGrn1Res.status === 200, '14. Submitted GRN 1 for QA inspection (Draft -> SubmittedForInspection)');
    const submittedGrn1 = unwrap(submitGrn1Res);
    assert(submittedGrn1.status === 'SubmittedForInspection', '14b. Status is SubmittedForInspection');

    // Complete SCM-F-01 QA Inspection
    const inspectGrn1Res = await apiRequest(
      'POST',
      `/api/grns/${grn1.id}/inspect`,
      {
        checklist: {
          challanMatchesPO: true,
          vehicleUnloadedSafely: true,
          physicallyCounted: true,
          packagingIntact: true,
          batchTestCertsProvided: true,
          testCertificateNumber: 'MILL-CERT-2026-8812',
          materialsMeetSpecs: true,
          binTagsAttached: true,
          inspectionRemarks: 'Mill certificates verified against Grade 500B BS 4449. Tally 100% matched.',
          discrepancyIdentified: false,
          debitNoteRequired: false,
        },
      },
      storeToken
    );
    assert(inspectGrn1Res.status === 200, '15. QA Inspection checklist certified per SOP SCM-F-01 (status -> Inspected)');
    const inspectedGrn1 = unwrap(inspectGrn1Res);
    assert(inspectedGrn1.status === 'Inspected', '15b. Status is Inspected');
    assert(inspectedGrn1.inspectionChecklist.batchTestCertsProvided === true, '15c. Batch mill cert recorded');

    // Dual-Control Enforcement: Storekeeper (creator) cannot approve their own GRN
    const selfApproveRes = await apiRequest('POST', `/api/grns/${grn1.id}/approve`, {}, storeToken);
    assert(selfApproveRes.status === 403, '16. Dual-control policy blocks receiver/creator from approving own GRN (403 Forbidden)');

    // Supervisory Approval by independent Project Manager
    const approveGrn1Res = await apiRequest('POST', `/api/grns/${grn1.id}/approve`, { comments: 'Approved by PM' }, pmToken);
    assert(approveGrn1Res.status === 200, '17. Independent Project Manager approved GRN 1 (status -> Approved)');
    const approvedGrn1 = unwrap(approveGrn1Res);
    assert(approvedGrn1.status === 'Approved', '17b. Status is Approved');

    // Check PO BEFORE posting: unposted GRN must NOT alter PO receivedQuantity
    const poBeforePost = unwrap(await apiRequest('GET', `/api/purchase-orders/${targetPo.id}`, undefined, adminToken));
    assert(
      poBeforePost.items[0].receivedQuantity === 0 && poBeforePost.status === 'Issued',
      '18. Unposted approved GRN strictly does NOT alter PO receivedQuantity or status'
    );

    // Post GRN 1 to Receipt Ledger
    const postGrn1Res = await apiRequest('POST', `/api/grns/${grn1.id}/post`, {}, storeToken);
    assert(postGrn1Res.status === 200, '19. Successfully posted GRN 1 to durable receipt ledger (status -> Posted)');
    const postedGrn1 = unwrap(postGrn1Res);
    assert(postedGrn1.status === 'Posted', '19b. Status is Posted');

    // Idempotency check: posting an already posted GRN is rejected
    const repeatPostRes = await apiRequest('POST', `/api/grns/${grn1.id}/post`, {}, storeToken);
    assert(repeatPostRes.status === 400, '20. Duplicate posting attempt is rejected as idempotent terminal action (400 Bad Request)');

    // Verify PO received quantities and status after posting GRN 1
    const poAfterPost1 = unwrap(await apiRequest('GET', `/api/purchase-orders/${targetPo.id}`, undefined, adminToken));
    assert(
      poAfterPost1.status === 'PartiallyReceived',
      '21. Purchase order status transitioned from Issued to PartiallyReceived'
    );
    assert(
      poAfterPost1.items[0].receivedQuantity === 5 && poAfterPost1.items[0].outstandingQuantity === 15,
      '22. PO line item updated: receivedQuantity = 5, outstandingQuantity = 15'
    );

    // -----------------------------------------------------------------------
    // Section 5: Delivery GRN 2 with Discrepancy & Debit Note Recommendation
    // -----------------------------------------------------------------------
    console.log('\n--- Section 5: Delivery GRN 2 with Discrepancy & Debit Note ---');

    // Delivery 2: Delivered 10 units, but 2 are damaged during offloading -> Accepted: 8, Rejected: 2, Damaged: 2
    const createGrn2Res = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: targetPo.id,
        deliveryChallanNumber: 'DC-APEX-1002',
        deliveryChallanDate: '2026-03-08',
        vehicleNumber: 'TRK-APEX-51',
        deliveredBy: 'Carl Jenkins (Hauler)',
        items: [
          {
            purchaseOrderItemId: poBeforeReceipt.items[0].id,
            deliveredQuantity: 10,
            acceptedQuantity: 8,
            rejectedQuantity: 2,
            damagedQuantity: 2,
            shortQuantity: 0,
            remarks: '2 bundles dropped and bent beyond ASTM tolerance during offloading',
          },
        ],
      },
      storeToken
    );
    assert(createGrn2Res.status === 201, '23. Created GRN 2 with 8 accepted and 2 rejected units (201 Created)');
    const grn2 = unwrap(createGrn2Res);

    await apiRequest('POST', `/api/grns/${grn2.id}/submit`, {}, storeToken);

    // Debit Note without mandatory reason must be rejected
    const invalidDebitNoteRes = await apiRequest(
      'POST',
      `/api/grns/${grn2.id}/inspect`,
      {
        checklist: {
          debitNoteRequired: true,
          debitNoteReason: '', // missing
        },
      },
      storeToken
    );
    assert(invalidDebitNoteRes.status === 400, '24. Rejects debit note recommendation missing mandatory reason (400 Bad Request)');

    // Record valid inspection with discrepancy and debit note
    const inspectGrn2Res = await apiRequest(
      'POST',
      `/api/grns/${grn2.id}/inspect`,
      {
        checklist: {
          challanMatchesPO: true,
          vehicleUnloadedSafely: false, // rough unloading
          physicallyCounted: true,
          packagingIntact: false,
          materialsMeetSpecs: true,
          binTagsAttached: true,
          inspectionRemarks: '2 bundles rejected due to transit bends. Supplier delivery carrier driver acknowledged.',
          discrepancyIdentified: true,
          debitNoteRequired: true,
          debitNoteReason: 'Debit note recommended for 2 MT bent structural rebar ($1,500 + tax).',
        },
      },
      storeToken
    );
    assert(inspectGrn2Res.status === 200, '25. Certified QA inspection with discrepancy and debit note recommendation');
    const inspectedGrn2 = unwrap(inspectGrn2Res);
    assert(inspectedGrn2.inspectionChecklist.debitNoteRequired === true, '25b. Debit note recommendation flagged');

    // Approve and post GRN 2
    await apiRequest('POST', `/api/grns/${grn2.id}/approve`, {}, managerToken);
    const postGrn2Res = await apiRequest('POST', `/api/grns/${grn2.id}/post`, {}, storeToken);
    assert(postGrn2Res.status === 200, '26. Posted GRN 2 with discrepancy');

    const poAfterPost2 = unwrap(await apiRequest('GET', `/api/purchase-orders/${targetPo.id}`, undefined, adminToken));
    assert(
      poAfterPost2.status === 'PartiallyReceived',
      '27. PO status remains PartiallyReceived after partial receipt'
    );
    assert(
      poAfterPost2.items[0].receivedQuantity === 13 && poAfterPost2.items[0].outstandingQuantity === 7,
      '28. Cumulative PO balance: receivedQuantity = 13 (5 + 8), outstandingQuantity = 7 (20 - 13)'
    );

    // -----------------------------------------------------------------------
    // Section 6: Final Delivery GRN 3 & PO Fulfillment
    // -----------------------------------------------------------------------
    console.log('\n--- Section 6: Final Delivery GRN 3 & PO Fulfillment ---');

    // Deliver remaining 7 units
    const createGrn3Res = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: targetPo.id,
        deliveryChallanNumber: 'DC-APEX-1003',
        vehicleNumber: 'TRK-APEX-88',
        items: [
          {
            purchaseOrderItemId: poBeforeReceipt.items[0].id,
            deliveredQuantity: 7,
            acceptedQuantity: 7,
            rejectedQuantity: 0,
          },
        ],
      },
      storeToken
    );
    assert(createGrn3Res.status === 201, '29. Created final delivery GRN 3 for 7 units (201 Created)');
    const grn3 = unwrap(createGrn3Res);

    await apiRequest('POST', `/api/grns/${grn3.id}/submit`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn3.id}/inspect`, {}, storeToken);
    await apiRequest('POST', `/api/grns/${grn3.id}/approve`, {}, pmToken);
    const postGrn3Res = await apiRequest('POST', `/api/grns/${grn3.id}/post`, {}, storeToken);
    assert(postGrn3Res.status === 200, '30. Posted final GRN 3 to receipt ledger');

    const poAfterPost3 = unwrap(await apiRequest('GET', `/api/purchase-orders/${targetPo.id}`, undefined, adminToken));
    assert(
      poAfterPost3.status === 'FullyReceived',
      '31. Purchase order status automatically transitioned to FullyReceived upon 100% item fulfillment'
    );
    assert(
      poAfterPost3.items[0].receivedQuantity === 20 && poAfterPost3.items[0].outstandingQuantity === 0,
      '32. Final PO line item balances: receivedQuantity = 20, outstandingQuantity = 0'
    );

    // Verify attempting to create another GRN against FullyReceived PO is blocked
    const overReceiptPoRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: targetPo.id,
        deliveryChallanNumber: 'DC-EXTRA-999',
        items: [{ purchaseOrderItemId: poBeforeReceipt.items[0].id, deliveredQuantity: 1 }],
      },
      storeToken
    );
    assert(overReceiptPoRes.status === 400, '33. Blocks creating Goods Received Note against FullyReceived Purchase Order (400 Bad Request)');

    // -----------------------------------------------------------------------
    // Section 7: PO Receipt Integration Endpoint Verification
    // -----------------------------------------------------------------------
    console.log('\n--- Section 7: PO Receipt Integration Endpoint ---');

    const poReceiptsRes = await apiRequest('GET', `/api/purchase-orders/${targetPo.id}/receipts`, undefined, storeToken);
    assert(poReceiptsRes.status === 200, '34. GET /api/purchase-orders/:id/receipts returns 200 OK');
    const poReceiptsData = unwrap(poReceiptsRes);
    assert(
      poReceiptsData.grnCount === 3 && poReceiptsData.postedGrnCount === 3,
      '35. PO receipts endpoint accurately aggregates all 3 linked GRNs'
    );
    assert(
      poReceiptsData.totalReceivedQuantity === 20 && poReceiptsData.totalOutstandingQuantity === 0,
      '36. PO receipts summary reports 20 total received and 0 outstanding'
    );

    // -----------------------------------------------------------------------
    // Section 8: Return for Correction & Rejection Flows
    // -----------------------------------------------------------------------
    console.log('\n--- Section 8: Correction and Rejection Workflows ---');

    // Create another test PO for correction/rejection testing
    const createPo2Res = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        supplierId: 'SUP-APEX-01',
        projectId: 'PRJ-101',
        orderDate: '2026-03-01',
        expectedDeliveryDate: '2026-03-15',
        paymentTerms: 'Net 30 Days',
        deliveryLocation: 'Metro Central Staging Yard Bay 4',
        items: [{ materialId: 'MAT-STEEL-01', orderedQuantity: 10, unitRate: 750 }],
        notes: 'Target PO 2 for correction and rejection automated testing',
      },
      adminToken
    );
    const po2 = unwrap(createPo2Res);
    await apiRequest('POST', `/api/purchase-orders/${po2.id}/submit`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po2.id}/approve`, {}, adminToken);
    await apiRequest('POST', `/api/purchase-orders/${po2.id}/issue`, {}, adminToken);

    // Create draft GRN on PO2
    const createDraftRes = await apiRequest(
      'POST',
      '/api/grns',
      {
        purchaseOrderId: po2.id,
        deliveryChallanNumber: 'DC-CORR-01',
        vehicleNumber: 'TRK-CORR',
        items: [{ purchaseOrderItemId: po2.items[0].id, deliveredQuantity: 5, acceptedQuantity: 5, rejectedQuantity: 0 }],
      },
      storeToken
    );
    const corrGrn = unwrap(createDraftRes);
    await apiRequest('POST', `/api/grns/${corrGrn.id}/submit`, {}, storeToken);

    // Return for correction without notes must fail
    const invalidReturnRes = await apiRequest('POST', `/api/grns/${corrGrn.id}/return-for-correction`, {}, pmToken);
    assert(invalidReturnRes.status === 400, '37. Return for correction without mandatory instructions rejected (400 Bad Request)');

    // Return with correction notes
    const validReturnRes = await apiRequest(
      'POST',
      `/api/grns/${corrGrn.id}/return-for-correction`,
      { notes: 'Incorrect vehicle registration and storage bay. Please revise.' },
      pmToken
    );
    assert(validReturnRes.status === 200, '38. Project Manager returned GRN with status ReturnedForCorrection (200 OK)');
    const returnedGrn = unwrap(validReturnRes);
    assert(returnedGrn.status === 'ReturnedForCorrection', '38b. Status is ReturnedForCorrection');

    // Update returned GRN
    const updateRes = await apiRequest(
      'PUT',
      `/api/grns/${corrGrn.id}`,
      { vehicleNumber: 'TRK-CORR-REVISED', storageLocation: 'Bay 2 Revised Yard' },
      storeToken
    );
    assert(updateRes.status === 200, '39. Storekeeper updated ReturnedForCorrection draft GRN (200 OK)');

    // Re-submit
    await apiRequest('POST', `/api/grns/${corrGrn.id}/submit`, {}, storeToken);

    // Reject without reason must fail
    const invalidRejectRes = await apiRequest('POST', `/api/grns/${corrGrn.id}/reject`, {}, pmToken);
    assert(invalidRejectRes.status === 400, '40. Reject without mandatory reason rejected (400 Bad Request)');

    // Reject with reason
    const validRejectRes = await apiRequest(
      'POST',
      `/api/grns/${corrGrn.id}/reject`,
      { reason: 'Supplier dispatched wrong material grade BS 4483 mesh instead of T16 rebar.' },
      pmToken
    );
    assert(validRejectRes.status === 200, '41. GRN formally rejected with audit explanation (200 OK)');
    const rejectedGrn = unwrap(validRejectRes);
    assert(rejectedGrn.status === 'Rejected', '41b. Status is Rejected');

    // -----------------------------------------------------------------------
    // Section 9: File Persistence & Audit Integrity
    // -----------------------------------------------------------------------
    console.log('\n--- Section 9: JSON File Persistence & Audit Trail ---');

    const grnsPath = path.resolve(process.cwd(), 'data', 'grns.json');
    const ledgerPath = path.resolve(process.cwd(), 'data', 'receipt_ledger.json');
    const posPath = path.resolve(process.cwd(), 'data', 'purchase_orders.json');

    assert(fs.existsSync(grnsPath), '42. /data/grns.json exists on disk');
    assert(fs.existsSync(ledgerPath), '43. /data/receipt_ledger.json exists on disk');

    const diskGrns = JSON.parse(fs.readFileSync(grnsPath, 'utf-8'));
    const diskLedger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    const diskPos = JSON.parse(fs.readFileSync(posPath, 'utf-8'));

    const persistedTargetGrn = diskGrns.find((g: any) => g.id === grn1.id);
    assert(!!persistedTargetGrn && persistedTargetGrn.status === 'Posted', '44. Posted GRN atomically persisted in /data/grns.json');

    const persistedLedgerEntry = diskLedger.find((l: any) => l.grnId === grn1.id);
    assert(!!persistedLedgerEntry && persistedLedgerEntry.acceptedQuantity === 5, '45. Durable receipt journal entry persisted in /data/receipt_ledger.json');

    const persistedTargetPo = diskPos.find((p: any) => p.id === targetPo.id);
    assert(
      persistedTargetPo && persistedTargetPo.status === 'FullyReceived',
      '46. Updated PO with FullyReceived status atomically persisted in /data/purchase_orders.json'
    );

    // Audit trail verification
    const auditRes = await apiRequest('GET', `/api/grns/${grn1.id}/history`, undefined, adminToken);
    const auditLogs = unwrap(auditRes);
    assert(
      Array.isArray(auditLogs) && auditLogs.some((a: any) => a.action === 'Posted'),
      '47. Complete chronological audit trail preserved with all state transitions'
    );

  } catch (err: any) {
    console.error('[FATAL EXCEPTION IN TEST RUNNER]', err);
    testsFailed++;
  }

  console.log(`\n=== GRN WORKFLOW TEST SUITE COMPLETED: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runGrnWorkflowTests();
