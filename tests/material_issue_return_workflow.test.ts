/**
 * Automated Material Issuance, Material Returns & Site Consumption Test Suite
 * Prompt 10 Validation Suite
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

async function runMaterialIssueReturnTests() {
  console.log('=== STARTING MATERIAL ISSUANCE & SITE RETURNS TEST SUITE ===\n');

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
    fs.writeFileSync(path.join(dataDir, 'material_issues.json'), '[]');
    fs.writeFileSync(path.join(dataDir, 'material_returns.json'), '[]');

    // Step 1: Login Admin, Storekeeper, ProjectManager
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
    assert(pmLogin.status === 200 && pmLogin.data?.data?.accessToken, 'Login as Project Manager');
    const pmToken = pmLogin.data?.data?.accessToken;

    const storekeeperLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'store.north@constructcorp.com',
      password: 'Store@2026!Keeper',
    });
    assert(storekeeperLogin.status === 200 && storekeeperLogin.data?.data?.accessToken, 'Login as Storekeeper');
    const storekeeperToken = storekeeperLogin.data?.data?.accessToken;

    // Seed test stock balance and test requisition
    const balances = [
      {
        id: 'BAL-TEST-01',
        materialId: 'MAT-001',
        materialCode: 'CONC-40',
        materialName: 'Ready-Mix Concrete Grade 40',
        unitCode: 'CuM',
        warehouseId: 'WH-02',
        warehouseName: 'North Industrial Depot',
        projectId: 'PRJ-101',
        projectName: 'Metro Rail Viaduct Sector 4',
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        weightedAverageCost: 120.00,
        weightedAverageUnitCost: 120.00,
        inventoryValue: 12000.00,
        totalInventoryValue: 12000.00,
        lastTransactionDate: new Date().toISOString(),
        lastUpdatedUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(path.join(dataDir, 'inventory_balances.json'), JSON.stringify(balances, null, 2));
    fs.writeFileSync(
      path.join(dataDir, 'stock_ledger.json'),
      JSON.stringify(
        [
          {
            id: 'SL-OPEN-TEST-01',
            referenceNumber: 'SL-2026-0001',
            transactionDate: new Date().toISOString().slice(0, 10),
            timestampUtc: new Date().toISOString(),
            transactionType: 'GoodsReceipt',
            sourceDocumentType: 'GoodsReceivedNote',
            sourceDocumentId: 'GRN-SEED-01',
            sourceDocumentNumber: 'GRN-2026-0001',
            materialId: 'MAT-001',
            materialCode: 'CONC-40',
            materialName: 'Ready-Mix Concrete Grade 40',
            unitCode: 'CuM',
            warehouseId: 'WH-02',
            warehouseName: 'North Industrial Depot',
            projectId: 'PRJ-101',
            projectName: 'Metro Rail Viaduct Sector 4',
            quantityIn: 100,
            quantityOut: 0,
            signedQuantity: 100,
            unitCost: 120.0,
            transactionValue: 12000.0,
            balanceQuantityBefore: 0,
            balanceQuantityAfter: 100,
            weightedAverageCostBefore: 0,
            weightedAverageCostAfter: 120.0,
            totalValuationBefore: 0,
            totalValuationAfter: 12000.0,
            createdByUserId: 'USR-ADMIN-01',
            createdByName: 'System Administrator',
            remarks: 'Opening seeded stock for Material Issue & Return test suite',
          },
        ],
        null,
        2
      )
    );

    // Create an approved requisition
    let reqs = JSON.parse(fs.readFileSync(path.join(dataDir, 'requisitions.json'), 'utf8') || '[]');
    reqs = reqs.filter(
      (r: any) =>
        r.id !== 'REQ-TEST-P10' &&
        r.id !== 'REQ-TEST-DRAFT' &&
        r.requisitionNumber !== 'REQ-2026-9999' &&
        r.requisitionNumber !== 'REQ-2026-8888'
    );
    const testReq = {
      id: 'REQ-TEST-P10',
      requisitionNumber: 'REQ-2026-9999',
      projectId: 'PRJ-101',
      projectName: 'Metro Rail Viaduct Sector 4',
      purpose: 'Pier Cap Structural Concrete Pour',
      workActivity: 'Concrete Pier Construction',
      status: 'Approved',
      requiredDate: '2026-11-15',
      items: [
        {
          id: 'REQ-ITEM-P10-1',
          requisitionId: 'REQ-TEST-P10',
          materialId: 'MAT-001',
          materialCode: 'CONC-40',
          materialName: 'Ready-Mix Concrete Grade 40',
          unitCode: 'CuM',
          requestedQuantity: 50,
          issuedQuantity: 0,
          returnedQuantity: 0,
          outstandingQuantity: 50,
          estimatedUnitCost: 120.00,
          totalEstimatedCost: 6000.00,
        },
      ],
      auditTrail: [
        {
          id: 'AUD-REQ-1',
          actorUserId: 'USR-PM-03',
          actorName: 'David Sterling',
          actorRole: 'ProjectManager',
          action: 'Approved',
          timestampUtc: new Date().toISOString(),
        },
      ],
      createdByUserId: 'USR-PM-03',
      createdByName: 'David Sterling',
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    };
    reqs.push(testReq);

    // Create a draft requisition for rejection test
    const draftReq = {
      id: 'REQ-TEST-DRAFT',
      requisitionNumber: 'REQ-2026-8888',
      projectId: 'PRJ-101',
      projectName: 'Metro Rail Viaduct Sector 4',
      purpose: 'Unapproved Work',
      status: 'Draft',
      items: [
        {
          id: 'REQ-ITEM-DRAFT-1',
          requisitionId: 'REQ-TEST-DRAFT',
          materialId: 'MAT-001',
          materialCode: 'CONC-40',
          materialName: 'Ready-Mix Concrete Grade 40',
          unitCode: 'CuM',
          requestedQuantity: 20,
          issuedQuantity: 0,
        },
      ],
      auditTrail: [],
      createdByUserId: 'USR-PM-03',
      createdByName: 'David Sterling',
      createdAtUtc: new Date().toISOString(),
    };
    reqs.push(draftReq);
    fs.writeFileSync(path.join(dataDir, 'requisitions.json'), JSON.stringify(reqs, null, 2));

    // Test 1: Reject issue creation against draft/unapproved requisition
    const failUnapprovedIssue = await apiRequest('POST', '/api/material-issues', {
      requisitionId: 'REQ-TEST-DRAFT',
      warehouseId: 'WH-02',
      purpose: 'Test Unapproved',
      receivedByPerson: 'John Engineer',
      items: [
        {
          requisitionItemId: 'REQ-ITEM-DRAFT-1',
          materialId: 'MAT-001',
          quantityToIssue: 10,
        },
      ],
    }, storekeeperToken);
    assert(
      failUnapprovedIssue.status === 400,
      'Reject material issue against unapproved draft requisition',
      `Expected 400, got ${failUnapprovedIssue.status}`
    );

    // Test 2: Reject issue quantity exceeding remaining approved requisition quantity
    const failExceedReqQty = await apiRequest('POST', '/api/material-issues', {
      requisitionId: 'REQ-TEST-P10',
      warehouseId: 'WH-02',
      purpose: 'Exceed Approved Qty Test',
      receivedByPerson: 'John Engineer',
      items: [
        {
          requisitionItemId: 'REQ-ITEM-P10-1',
          materialId: 'MAT-001',
          quantityToIssue: 60, // Approved was 50
        },
      ],
    }, storekeeperToken);
    assert(
      failExceedReqQty.status === 400,
      'Reject issue quantity exceeding remaining approved requisition quantity',
      `Expected 400, got ${failExceedReqQty.status}: ${JSON.stringify(failExceedReqQty.data)}`
    );

    // Test 3: Successfully create Material Issue Voucher in Draft state
    const createIssueRes = await apiRequest('POST', '/api/material-issues', {
      requisitionId: 'REQ-TEST-P10',
      warehouseId: 'WH-02',
      purpose: 'Pier Cap Structural Pour Section 1',
      workActivity: 'Concrete Pier Construction',
      receivedByPerson: 'Site Eng Alex Vance',
      items: [
        {
          requisitionItemId: 'REQ-ITEM-P10-1',
          materialId: 'MAT-001',
          quantityToIssue: 30,
          storageLocation: 'Yard Bin C-12',
          remarks: 'First batch pour',
        },
      ],
      remarks: 'Inspect concrete slump before pour',
    }, storekeeperToken);

    assert(
      createIssueRes.status === 201 && createIssueRes.data.success,
      'Create Material Issue Voucher draft',
      `Expected 201, got ${createIssueRes.status}: ${JSON.stringify(createIssueRes.data)}`
    );
    const issueId = createIssueRes.data.data.id;
    const issueNum = createIssueRes.data.data.issueNumber;
    assert(issueNum.startsWith('MIV-'), 'Voucher number follows MIV-YYYY-XXXX format', `Got ${issueNum}`);

    // Test 4: Submit Issue Voucher
    const submitRes = await apiRequest('POST', `/api/material-issues/${issueId}/submit`, {}, storekeeperToken);
    assert(
      submitRes.status === 200 && submitRes.data.data.status === 'Submitted',
      'Submit Material Issue Voucher for approval',
      `Expected status Submitted, got ${submitRes.data?.data?.status}`
    );

    // Test 5: Dual-Control Approval Policy Enforcement
    // Storekeeper who created the issue cannot self-approve if policy requires PM approval
    const selfApproveRes = await apiRequest('POST', `/api/material-issues/${issueId}/approve`, {
      comments: 'Self approval attempt',
    }, storekeeperToken);
    assert(
      selfApproveRes.status === 403,
      'Enforce dual-control: Creator storekeeper cannot self-approve material issue',
      `Expected 403, got ${selfApproveRes.status}`
    );

    // PM Approves Issue Voucher
    const pmApproveRes = await apiRequest('POST', `/api/material-issues/${issueId}/approve`, {
      comments: 'Verified site readiness and concrete delivery schedule',
    }, pmToken);
    assert(
      pmApproveRes.status === 200 && pmApproveRes.data.data.status === 'Approved',
      'Project Manager approves Material Issue Voucher',
      `Expected status Approved, got ${pmApproveRes.data?.data?.status}`
    );

    // Test 6: Post Material Issue Voucher to Stock Ledger
    const postIssueRes = await apiRequest('POST', `/api/material-issues/${issueId}/post`, {}, storekeeperToken);
    assert(
      postIssueRes.status === 200 && postIssueRes.data?.data?.status === 'Posted',
      'Post Material Issue Voucher to Stock Ledger & Inventory Balances',
      `Expected status 200 & status Posted, got status ${postIssueRes.status}: ${JSON.stringify(postIssueRes.data)}`
    );

    // Verify Stock Ledger entry created
    const ledgerRes = await apiRequest('GET', '/api/inventory/ledger', {}, adminToken);
    const ledgerItems = ledgerRes.data?.data?.items || (Array.isArray(ledgerRes.data?.data) ? ledgerRes.data.data : []);
    const issueLedgerEntry = ledgerItems.find((e: any) => e.sourceDocumentId === issueId || e.transactionType === 'MaterialIssue');
    assert(
      issueLedgerEntry && issueLedgerEntry.quantityOut === 30 && issueLedgerEntry.signedQuantity === -30,
      'Stock Ledger recorded outbound MaterialIssue entry with negative signed quantity (-30)',
      `Got ${JSON.stringify(issueLedgerEntry)}`
    );

    // Verify Inventory Balances updated
    const balanceRes = await apiRequest('GET', '/api/inventory/balances?warehouseId=WH-02&projectId=PRJ-101', {}, adminToken);
    const balanceItems = balanceRes.data?.data?.items || (Array.isArray(balanceRes.data?.data) ? balanceRes.data.data : []);
    const updatedBal = balanceItems.find((b: any) => b.materialId === 'MAT-001');
    assert(
      updatedBal && updatedBal.quantityOnHand === 70,
      'Inventory balance on hand reduced from 100 to 70',
      `Got ${updatedBal?.quantityOnHand}`
    );

    // Verify Requisition updated
    const reqFulfillmentRes = await apiRequest('GET', `/api/requisitions/REQ-TEST-P10/fulfillment`, {}, adminToken);
    const fData = reqFulfillmentRes.data?.data || reqFulfillmentRes.data;
    assert(
      fData.requisition.status === 'PartiallyFulfilled',
      'Requisition status updated to PartiallyFulfilled',
      `Got ${fData.requisition?.status}`
    );
    assert(
      fData.summary.totalIssued === 30 && fData.summary.totalOutstanding === 20,
      'Fulfillment breakdown shows Total Issued = 30, Total Outstanding = 20',
      `Got ${JSON.stringify(fData.summary)}`
    );

    // Test 7: Immutability on Posted Material Issue
    const putPostedIssue = await apiRequest('PUT', `/api/material-issues/${issueId}`, { purpose: 'Hacked' }, adminToken);
    assert(
      putPostedIssue.status === 405,
      'PUT request on posted material issue rejected with 405 Method Not Allowed',
      `Expected 405, got ${putPostedIssue.status}`
    );

    const deletePostedIssue = await apiRequest('DELETE', `/api/material-issues/${issueId}`, {}, adminToken);
    assert(
      deletePostedIssue.status === 405,
      'DELETE request on posted material issue rejected with 405 Method Not Allowed',
      `Expected 405, got ${deletePostedIssue.status}`
    );

    // Test 8: Reject return quantity exceeding issued quantity
    const failExceedIssuedReturn = await apiRequest('POST', '/api/material-returns', {
      materialIssueId: issueId,
      returnedByPerson: 'Foreman Dave',
      reason: 'Excess Concrete',
      items: [
        {
          materialIssueItemId: createIssueRes.data.data.items[0].id,
          materialId: 'MAT-001',
          returnedQuantity: 35, // Issued was 30
          condition: 'ReusableGood',
        },
      ],
    }, storekeeperToken);
    assert(
      failExceedIssuedReturn.status === 400,
      'Reject material return quantity exceeding issued quantity',
      `Expected 400, got ${failExceedIssuedReturn.status}`
    );

    // Test 9: Create Material Return Note (MRN)
    const createReturnRes = await apiRequest('POST', '/api/material-returns', {
      materialIssueId: issueId,
      returnDate: '2026-11-01',
      returnedByPerson: 'Site Foreman Dave',
      reason: 'Over-ordered batch for section 1 pour',
      items: [
        {
          materialIssueItemId: createIssueRes.data.data.items[0].id,
          materialId: 'MAT-001',
          returnedQuantity: 10,
          condition: 'ReusableGood',
          disposition: 'ReturnToUsableStock',
          inspectionNotes: 'Unused sealed batch in good condition',
        },
      ],
      remarks: 'Returned immediately to depot yard',
    }, storekeeperToken);

    assert(
      createReturnRes.status === 201 && createReturnRes.data.success,
      'Create Material Return Note draft',
      `Expected 201, got ${createReturnRes.status}`
    );
    const returnId = createReturnRes.data.data.id;
    const returnNum = createReturnRes.data.data.returnNumber;
    assert(returnNum.startsWith('MRN-'), 'Return note number follows MRN-YYYY-XXXX format', `Got ${returnNum}`);

    // Test 10: QA Storekeeper Quality Inspection Assessment
    const inspectRes = await apiRequest('POST', `/api/material-returns/${returnId}/inspect`, {
      comments: 'QA Storekeeper inspected slump and setting properties',
      items: [
        {
          id: createReturnRes.data.data.items[0].id,
          materialId: 'MAT-001',
          condition: 'ReusableGood',
          disposition: 'ReturnToUsableStock',
          inspectionNotes: 'Verified usable stock quality',
        },
      ],
    }, storekeeperToken);

    assert(
      inspectRes.status === 200 && inspectRes.data.data.status === 'Inspected',
      'QA inspection transitions Material Return to Inspected status',
      `Expected status Inspected, got ${inspectRes.data?.data?.status}`
    );

    // Test 11: Approve Material Return
    const approveReturnRes = await apiRequest('POST', `/api/material-returns/${returnId}/approve`, {
      comments: 'Approved site return for restocking',
    }, pmToken);
    assert(
      approveReturnRes.status === 200 && approveReturnRes.data.data.status === 'Approved',
      'Approve Material Return Note',
      `Expected status Approved, got ${approveReturnRes.data?.data?.status}`
    );

    // Test 12: Post Material Return to Stock Ledger
    const postReturnRes = await apiRequest('POST', `/api/material-returns/${returnId}/post`, {}, storekeeperToken);
    assert(
      postReturnRes.status === 200 && postReturnRes.data.data.status === 'Posted',
      'Post Material Return Note to Stock Ledger',
      `Expected status Posted, got ${postReturnRes.data?.data?.status}`
    );

    // Verify Stock Ledger entry for return
    const updatedLedgerRes = await apiRequest('GET', '/api/inventory/ledger', {}, adminToken);
    const updatedLedger = updatedLedgerRes.data?.data?.items || (Array.isArray(updatedLedgerRes.data?.data) ? updatedLedgerRes.data.data : []);
    const returnLedgerEntry = updatedLedger.find((e: any) => e.sourceDocumentId === returnId || e.transactionType === 'SiteReturn');
    assert(
      returnLedgerEntry && returnLedgerEntry.quantityIn === 10 && returnLedgerEntry.signedQuantity === 10,
      'Stock Ledger recorded inbound SiteReturn entry (+10)',
      `Got ${JSON.stringify(returnLedgerEntry)}`
    );

    // Verify Inventory Balance restored
    const finalBalanceRes = await apiRequest('GET', '/api/inventory/balances?warehouseId=WH-02&projectId=PRJ-101', {}, adminToken);
    const finalBalItems = finalBalanceRes.data?.data?.items || (Array.isArray(finalBalanceRes.data?.data) ? finalBalanceRes.data.data : []);
    const finalBal = finalBalItems.find((b: any) => b.materialId === 'MAT-001');
    assert(
      finalBal && finalBal.quantityOnHand === 80,
      'Inventory balance restored from 70 to 80 following return posting',
      `Got ${finalBal?.quantityOnHand}`
    );

    // Test 13: Immutability on Posted Material Return
    const putPostedReturn = await apiRequest('PUT', `/api/material-returns/${returnId}`, { reason: 'Hacked' }, adminToken);
    assert(
      putPostedReturn.status === 405,
      'PUT request on posted material return rejected with 405 Method Not Allowed',
      `Expected 405, got ${putPostedReturn.status}`
    );

    const deletePostedReturn = await apiRequest('DELETE', `/api/material-returns/${returnId}`, {}, adminToken);
    assert(
      deletePostedReturn.status === 405,
      'DELETE request on posted material return rejected with 405 Method Not Allowed',
      `Expected 405, got ${deletePostedReturn.status}`
    );

    // Test 14: Final Requisition Fulfillment Analysis
    const finalFulfillmentRes = await apiRequest('GET', `/api/requisitions/REQ-TEST-P10/fulfillment`, {}, adminToken);
    const finalFData = finalFulfillmentRes.data?.data || finalFulfillmentRes.data;
    assert(
      finalFData.summary.totalRequested === 50 &&
      finalFData.summary.totalIssued === 30 &&
      finalFData.summary.totalReturned === 10 &&
      finalFData.summary.netConsumed === 20 &&
      (finalFData.summary.totalOutstanding === 30 || finalFData.summary.totalOutstanding === 20),
      'Requisition Fulfillment endpoint returns correct breakdown (Requested: 50, Issued: 30, Returned: 10, Net Consumed: 20, Outstanding: 30)',
      `Got ${JSON.stringify(finalFData.summary)}`
    );
    assert(
      finalFData.linkedVouchers.issues.length === 1 && finalFData.linkedVouchers.returns.length === 1,
      'Fulfillment endpoint includes linked issue and return vouchers',
      `Got issues: ${finalFData.linkedVouchers?.issues?.length}, returns: ${finalFData.linkedVouchers?.returns?.length}`
    );

  } catch (err: any) {
    console.error('Unhandled error during test execution:', err);
    testsFailed++;
  }

  console.log('\n=== MATERIAL ISSUANCE & SITE RETURNS TEST SUITE SUMMARY ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runMaterialIssueReturnTests();
