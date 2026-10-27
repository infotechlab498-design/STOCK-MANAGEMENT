/**
 * Automated Supplier Management & Purchase Order Workflow Test Suite
 * Prompt 7 Validation Suite
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

async function runSupplierAndPOTests() {
  console.log('=== STARTING SUPPLIER MANAGEMENT & PURCHASE ORDER WORKFLOW TEST SUITE ===\n');
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
      if (payload) req.write(payload);
      req.end();
    });
  }

  function unwrap(res: { status: number; data: any }) {
    if (res.data && res.data.data !== undefined) {
      return res.data.data;
    }
    return res.data;
  }

  try {
    // 1. Authenticate actors
    const superAdminLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'admin',
      password: 'Admin@2026!Stock',
    });
    const superAdminToken = superAdminLogin.data?.data?.accessToken;
    assert(superAdminLogin.status === 200 && Boolean(superAdminToken), 'SuperAdmin authentication');

    const procurementLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'procurement',
      password: 'Procure@2026!Officer',
    });
    const procurementToken = procurementLogin.data?.data?.accessToken;
    assert(procurementLogin.status === 200 && Boolean(procurementToken), 'ProcurementOfficer authentication');

    const inventoryLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'inv.manager',
      password: 'Manager@2026!Inv',
    });
    const inventoryToken = inventoryLogin.data?.data?.accessToken;
    assert(inventoryLogin.status === 200 && Boolean(inventoryToken), 'InventoryManager authentication');

    // 2. Fetch seed materials and projects
    const matsRes = await apiRequest('GET', '/api/materials', undefined, superAdminToken);
    const materials = unwrap(matsRes) || [];
    assert(Array.isArray(materials) && materials.length > 0, 'Seed materials available', `Found ${materials?.length}`);
    const steelMat = materials.find((m: any) => m.itemCode === 'STL-REB-016') || materials[0];

    const projsRes = await apiRequest('GET', '/api/projects', undefined, superAdminToken);
    const projects = unwrap(projsRes) || [];
    assert(Array.isArray(projects) && projects.length > 0, 'Seed projects available', `Found ${projects?.length}`);
    const metroProject = projects.find((p: any) => p.id === 'PRJ-101') || projects[0];

    // ==========================================
    // SECTION 1: SUPPLIER MANAGEMENT & VALIDATION
    // ==========================================
    console.log('\n--- Section 1: Supplier Management & Validation ---');

    const uniqueCode = `SUP-TEST-${Date.now().toString().slice(-4)}`;
    const newSupplierPayload = {
      code: uniqueCode,
      name: 'Titan Heavy Industries Ltd',
      contactPerson: 'Marcus Vance',
      email: 'm.vance@titanheavy.example.com',
      phone: '+1-555-019-8833',
      address: '742 Foundry Blvd, Industrial Quarter',
      taxReference: 'TAX-TITAN-88219',
      paymentTerms: 'Net 45 Days',
      notes: 'Direct manufacturer of structural rebar and structural beams.',
    };

    // 3. Create valid supplier (201)
    const createSupRes = await apiRequest('POST', '/api/suppliers', newSupplierPayload, procurementToken);
    const createdSupplier = unwrap(createSupRes);
    const createdSupplierId = createdSupplier?.id;
    assert(createSupRes.status === 201 && Boolean(createdSupplierId), 'Create supplier with valid fields (201 Created)');

    // 4. Duplicate code rejection (case-insensitive, 409 Conflict)
    const dupSupRes = await apiRequest(
      'POST',
      '/api/suppliers',
      {
        ...newSupplierPayload,
        code: uniqueCode.toLowerCase(),
        name: 'Another Clone Supplier',
      },
      procurementToken
    );
    assert(dupSupRes.status === 409, 'Duplicate supplier code rejection is case-insensitive (409 Conflict)');

    // 5. Validation: missing code or name (400)
    const missingNameRes = await apiRequest('POST', '/api/suppliers', { code: 'NO-NAME' }, procurementToken);
    assert(missingNameRes.status === 400, 'Supplier missing required name is rejected (400 Bad Request)');

    // 6. Validation: invalid email format (400)
    const invalidEmailRes = await apiRequest(
      'POST',
      '/api/suppliers',
      { code: `SUP-EM-${Date.now().toString().slice(-4)}`, name: 'Bad Email Co', email: 'not-an-email' },
      procurementToken
    );
    assert(invalidEmailRes.status === 400, 'Invalid supplier email format is rejected (400 Bad Request)');

    // 7. Update supplier (200)
    const updateSupRes = await apiRequest(
      'PUT',
      `/api/suppliers/${createdSupplierId}`,
      {
        ...newSupplierPayload,
        name: 'Titan Heavy Industries International',
        paymentTerms: 'Net 60 Days',
      },
      procurementToken
    );
    const updatedSupplier = unwrap(updateSupRes);
    assert(updateSupRes.status === 200 && updatedSupplier?.name?.includes('International'), 'Update supplier details (200 OK)');

    // 8. Soft deactivation (200)
    const deactSupRes = await apiRequest(
      'PATCH',
      `/api/suppliers/${createdSupplierId}/status`,
      { status: 'Inactive', reason: 'Annual vendor compliance review pending' },
      procurementToken
    );
    const deactSupplier = unwrap(deactSupRes);
    assert(deactSupRes.status === 200 && (deactSupplier?.status === 'Inactive' || deactSupplier?.isActive === false), 'Supplier soft deactivation (200 OK)');

    // 9. Reactivation (200)
    const reactSupRes = await apiRequest(
      'PATCH',
      `/api/suppliers/${createdSupplierId}/status`,
      { status: 'Active', reason: 'Audit completed' },
      procurementToken
    );
    const reactSupplier = unwrap(reactSupRes);
    assert(reactSupRes.status === 200 && (reactSupplier?.status === 'Active' || reactSupplier?.isActive === true), 'Supplier reactivation (200 OK)');

    // ==========================================
    // SECTION 2: STANDALONE PURCHASE ORDERS & JUSTIFICATION
    // ==========================================
    console.log('\n--- Section 2: Standalone Purchase Orders ---');

    // 10. Standalone PO without justification rejected (400)
    const standaloneNoNotesRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        orderSource: 'STANDALONE',
        supplierId: createdSupplierId,
        projectId: metroProject.id,
        items: [
          {
            materialId: steelMat.id,
            orderedQuantity: 50,
            unitRate: 110.0,
            lineDiscount: 0,
            taxRate: 5.0,
          },
        ],
        notes: '', // Empty notes
      },
      procurementToken
    );
    assert(standaloneNoNotesRes.status === 400, 'Standalone PO without mandatory justification note rejected (400 Bad Request)');

    // 11. Standalone PO with justification note created (201)
    const standaloneValidRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        orderSource: 'STANDALONE',
        supplierId: createdSupplierId,
        projectId: metroProject.id,
        deliveryLocation: 'Central Staging Yard Gate 4',
        expectedDeliveryDate: new Date(Date.now() + 864000000).toISOString().substring(0, 10),
        paymentTerms: 'Net 30 Days',
        freight: 150.0,
        headerDiscount: 25.0,
        notes: 'Emergency structural reinforcement reserve authorized by project manager.',
        items: [
          {
            materialId: steelMat.id,
            orderedQuantity: 20,
            unitRate: 100.0,
            lineDiscount: 10.0,
            taxRate: 10.0,
          },
        ],
      },
      procurementToken
    );
    const standalonePo = unwrap(standaloneValidRes);
    assert(standaloneValidRes.status === 201 && Boolean(standalonePo?.id), 'Create valid Standalone PO (201 Created)');

    // 12. Verify Server-Side Financial Calculations
    // Line 1: qty=20, rate=100 => 2000. disc=10 => taxable=1990. tax 10% = 199. lineTotal = 2189.
    // Subtotal: 2000. Header disc: 25 => Subtotal after disc = 1975.
    // Freight = 150.
    const poSubtotal = standalonePo?.subTotal ?? standalonePo?.subtotal;
    assert(poSubtotal === 2000, 'Server-side subtotal calculation', `Expected 2000, got ${poSubtotal}`);
    assert(standalonePo?.items?.[0]?.lineTotal === 2189, 'Server-side line total calculation', `Expected 2189, got ${standalonePo?.items?.[0]?.lineTotal}`);
    assert(standalonePo?.receivedQuantity === 0, 'PO receivedQuantity strictly 0 on creation', `Got ${standalonePo?.receivedQuantity}`);
    assert(standalonePo?.outstandingQuantity === standalonePo?.orderedQuantity, 'PO outstandingQuantity equals orderedQuantity on creation', `Got ${standalonePo?.outstandingQuantity}`);

    // ==========================================
    // SECTION 3: REQUISITION LINKAGE & ALLOCATION CAPS
    // ==========================================
    console.log('\n--- Section 3: Requisition Linkage & Allocation Caps ---');

    // Create an approved requisition to test allocation
    const createReqRes = await apiRequest(
      'POST',
      '/api/requisitions',
      {
        projectId: metroProject.id,
        requiredDate: '2026-11-20',
        priority: 'High',
        purpose: 'Foundation structural work allocation test',
        items: [
          {
            materialId: steelMat.id,
            requestedQuantity: 100,
            remarks: 'High tensile rebar batch A',
          },
        ],
      },
      superAdminToken
    );
    const createdReqObj = unwrap(createReqRes);
    const testReqId = createdReqObj?.id;
    const reqItemId = createdReqObj?.items?.[0]?.id;

    // Submit requisition
    await apiRequest('POST', `/api/requisitions/${testReqId}/submit`, { comments: 'Submitting for test' }, superAdminToken);

    // 13. Rejection when attempting to create PO from unapproved requisition
    const unapprovedReqPoRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        orderSource: 'REQUISITION',
        requisitionId: testReqId,
        supplierId: createdSupplierId,
        projectId: metroProject.id,
        items: [
          {
            materialId: steelMat.id,
            requisitionItemId: reqItemId,
            orderedQuantity: 50,
            unitRate: 95.0,
          },
        ],
      },
      procurementToken
    );
    assert(unapprovedReqPoRes.status === 400, 'PO creation from unapproved requisition rejected (400 Bad Request)');

    // Approve requisition via superadmin
    await apiRequest('POST', `/api/requisitions/${testReqId}/approve`, { comments: 'Approved for procurement test' }, superAdminToken);

    // 14. Create PO allocating partial quantity (60 of 100)
    const getReqRes = await apiRequest('GET', `/api/requisitions/${testReqId}`, undefined, superAdminToken);
    const reqItem = unwrap(getReqRes)?.items?.[0];
    const partialPoRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        orderSource: 'REQUISITION',
        requisitionId: testReqId,
        supplierId: createdSupplierId,
        projectId: metroProject.id,
        expectedDeliveryDate: new Date(Date.now() + 864000000).toISOString().substring(0, 10),
        items: [
          {
            materialId: steelMat.id,
            requisitionItemId: reqItem?.id || reqItemId,
            orderedQuantity: 60,
            unitRate: 92.5,
          },
        ],
      },
      procurementToken
    );
    const linkedPo = unwrap(partialPoRes);
    assert(partialPoRes.status === 201 && Boolean(linkedPo?.id), 'Create PO allocating 60 units from 100 unit approved requisition (201 Created)');
    const linkedPoId = linkedPo?.id;

    // 15. Enforce Allocation Cap: Attempting to order remaining 50 units (exceeding 40 unallocated)
    const overAllocPoRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        orderSource: 'REQUISITION',
        requisitionId: testReqId,
        supplierId: createdSupplierId,
        projectId: metroProject.id,
        expectedDeliveryDate: new Date(Date.now() + 864000000).toISOString().substring(0, 10),
        items: [
          {
            materialId: steelMat.id,
            requisitionItemId: reqItem?.id || reqItemId,
            orderedQuantity: 50, // Only 40 remaining!
            unitRate: 92.5,
          },
        ],
      },
      procurementToken
    );
    assert(overAllocPoRes.status === 400, 'Over-allocation exceeding unallocated requisition line quantity is rejected (400 Bad Request)');

    // ==========================================
    // SECTION 4: WORKFLOW TRANSITIONS & DUAL CONTROL
    // ==========================================
    console.log('\n--- Section 4: Workflow Lifecycle & Dual Control ---');

    // 16. Submit draft PO for approval (Draft -> PendingApproval)
    const submitPoRes = await apiRequest('POST', `/api/purchase-orders/${linkedPoId}/submit`, {}, procurementToken);
    const submitPo = unwrap(submitPoRes);
    assert(submitPoRes.status === 200 && submitPo?.status === 'PendingApproval', 'Submit Draft PO for approval (Draft -> PendingApproval, 200 OK)');

    // 17. Edits to non-Draft PO rejected (400)
    const editNonDraftRes = await apiRequest(
      'PUT',
      `/api/purchase-orders/${linkedPoId}`,
      {
        deliveryLocation: 'New Unauthorized Location',
        items: [{ materialId: steelMat.id, orderedQuantity: 10, unitRate: 80 }],
      },
      procurementToken
    );
    assert(editNonDraftRes.status === 400, 'Prevent modifying purchase order after submission (400 Bad Request)');

    // 18. Dual Control: Creator (ProcurementOfficer) CANNOT approve their own PO (403 Forbidden)
    const selfApproveRes = await apiRequest('POST', `/api/purchase-orders/${linkedPoId}/approve`, { comments: 'Self sign-off' }, procurementToken);
    assert(selfApproveRes.status === 403, 'Dual-control policy: creator cannot approve their own PO (403 Forbidden)');

    // 19. Authorized Approval by InventoryManager (different user)
    const approverApproveRes = await apiRequest('POST', `/api/purchase-orders/${linkedPoId}/approve`, { comments: 'Approved by materials controller' }, inventoryToken);
    const approverPo = unwrap(approverApproveRes);
    assert(approverApproveRes.status === 200 && approverPo?.status === 'Approved', 'Authorized dual-control approval by different approver (PendingApproval -> Approved, 200 OK)');

    // 20. Issuance by Procurement Officer
    const issuePoRes = await apiRequest('POST', `/api/purchase-orders/${linkedPoId}/issue`, {}, procurementToken);
    const issuePo = unwrap(issuePoRes);
    assert(issuePoRes.status === 200 && issuePo?.status === 'Issued', 'Issue approved PO to supplier (Approved -> Issued, 200 OK)');

    // 21. Rejection Lifecycle Check
    // Create another draft, submit, and reject
    const poForRejectRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        orderSource: 'STANDALONE',
        supplierId: createdSupplierId,
        projectId: metroProject.id,
        expectedDeliveryDate: new Date(Date.now() + 864000000).toISOString().substring(0, 10),
        notes: 'Testing rejection branch',
        items: [{ materialId: steelMat.id, orderedQuantity: 5, unitRate: 99.0 }],
      },
      procurementToken
    );
    const rejectPoObj = unwrap(poForRejectRes);
    const rejectPoId = rejectPoObj?.id;
    await apiRequest('POST', `/api/purchase-orders/${rejectPoId}/submit`, {}, procurementToken);
    const rejectRes = await apiRequest('POST', `/api/purchase-orders/${rejectPoId}/reject`, { reason: 'Commercial pricing out of range' }, inventoryToken);
    const rejectPo = unwrap(rejectRes);
    assert(rejectRes.status === 200 && rejectPo?.status === 'Rejected', 'Reject PO with justification (PendingApproval -> Rejected, 200 OK)');

    // 22. Cancellation Lifecycle Check
    const cancelRes = await apiRequest('POST', `/api/purchase-orders/${linkedPoId}/cancel`, { reason: 'Engineering scope modification cancelled foundation pier' }, superAdminToken);
    const cancelPo = unwrap(cancelRes);
    assert(cancelRes.status === 200 && cancelPo?.status === 'Cancelled', 'Cancel issued PO with audit reason (Issued -> Cancelled, 200 OK)');

    // ==========================================
    // SECTION 5: HISTORICAL INTEGRITY & RATE COMPARISONS
    // ==========================================
    console.log('\n--- Section 5: Historical Integrity & Rate Comparison ---');

    // 23. Deactivate supplier and verify PO history remains intact
    await apiRequest('PATCH', `/api/suppliers/${createdSupplierId}/status`, { status: 'Inactive', reason: 'Temporary supplier deactivation' }, superAdminToken);

    const supPoHistoryRes = await apiRequest('GET', `/api/suppliers/${createdSupplierId}/purchase-orders`, undefined, superAdminToken);
    const supPoList = unwrap(supPoHistoryRes);
    assert(supPoHistoryRes.status === 200 && Array.isArray(supPoList) && supPoList.length >= 2, 'Supplier purchase order history retained through deactivation (200 OK)');

    // 24. Cannot create new PO with inactive supplier
    const newPoWithInactiveSupRes = await apiRequest(
      'POST',
      '/api/purchase-orders',
      {
        orderSource: 'STANDALONE',
        supplierId: createdSupplierId,
        projectId: metroProject.id,
        expectedDeliveryDate: new Date(Date.now() + 864000000).toISOString().substring(0, 10),
        notes: 'Testing inactive supplier block',
        items: [{ materialId: steelMat.id, orderedQuantity: 10, unitRate: 100.0 }],
      },
      procurementToken
    );
    assert(newPoWithInactiveSupRes.status === 400, 'Creating PO against inactive supplier is blocked (400 Bad Request)');

    // Reactivate supplier
    await apiRequest('PATCH', `/api/suppliers/${createdSupplierId}/status`, { status: 'Active', reason: 'Reactivated for benchmark comparison' }, superAdminToken);

    // 25. Quotation Registration and Rate Comparison Matrix
    const createQuoteRes = await apiRequest(
      'POST',
      '/api/quotations',
      {
        quotationReference: `RFQ-TEST-${Date.now().toString().slice(-4)}`,
        supplierId: createdSupplierId,
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
        items: [
          {
            materialId: steelMat.id,
            quotedQuantity: 100,
            unitRate: 88.0,
            discount: 0,
            taxRate: 5.0,
            freight: 50.0,
          },
        ],
      },
      procurementToken
    );
    assert(createQuoteRes.status === 201, 'Quotation record registered (201 Created)');

    const compareRes = await apiRequest('GET', '/api/quotations/compare', undefined, procurementToken);
    const compareList = unwrap(compareRes);
    assert(compareRes.status === 200 && Array.isArray(compareList), 'Rate comparison matrix compiled across suppliers (200 OK)');
    const steelCompare = compareList?.find((c: any) => c.materialId === steelMat.id);
    assert(steelCompare && steelCompare.quotes?.length > 0, 'Quotation rate comparison returns valid quotes for material');

    // 26. Local JSON Storage Persistence Verification
    const supJsonPath = path.resolve(process.cwd(), 'data', 'suppliers.json');
    const poJsonPath = path.resolve(process.cwd(), 'data', 'purchase_orders.json');
    assert(fs.existsSync(supJsonPath), 'Persistence: /data/suppliers.json exists on disk');
    assert(fs.existsSync(poJsonPath), 'Persistence: /data/purchase_orders.json exists on disk');

    const poDiskData = JSON.parse(fs.readFileSync(poJsonPath, 'utf8'));
    assert(poDiskData.some((p: any) => p.id === linkedPoId), 'Persistence: Created PO persisted safely in /data/purchase_orders.json');

    // 27. Deferred GRN Verification
    // Check all unreceived POs on disk: every line item and header receivedQuantity MUST be 0 and outstandingQuantity MUST equal orderedQuantity (until GRN prompt 8 receipt integration)
    const allReceivedAreZero = poDiskData
      .filter((p: any) => p.status !== 'PartiallyReceived' && p.status !== 'FullyReceived')
      .every((p: any) =>
        (p.receivedQuantity ?? 0) === 0 &&
        p.items.every((it: any) => it.receivedQuantity === 0 && it.outstandingQuantity === it.orderedQuantity)
      );
    assert(allReceivedAreZero, 'Scope verification: receivedQuantity strictly 0 on all unreceived POs (GRN integration active in Prompt 8)');

    console.log(`\n=== RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error executing test suite:', err);
    process.exit(1);
  }
}

runSupplierAndPOTests();
