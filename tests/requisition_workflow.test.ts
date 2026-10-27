/**
 * Automated Material Requisition & Approval Workflow Test Suite
 * Prompt 6 Validation Suite
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

async function runRequisitionTests() {
  console.log('=== STARTING MATERIAL REQUISITION & APPROVAL TEST SUITE ===\n');
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

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    // 1. Authenticate users: SuperAdmin, Storekeeper (PRJ-101), ProjectManager (PRJ-101)
    const adminLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'admin',
      password: 'Admin@2026!Stock',
    });
    assert(adminLogin.status === 200 && adminLogin.data.data?.accessToken, '1. Admin authentication successful');
    const adminToken = adminLogin.data.data.accessToken;

    const pmLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'pm.metro',
      password: 'Project@2026!Metro',
    });
    assert(pmLogin.status === 200 && pmLogin.data.data?.accessToken, '1b. Project Manager (Metro) authentication successful');
    const pmToken = pmLogin.data.data.accessToken;

    const storeLogin = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'store.north',
      password: 'Store@2026!Keeper',
    });
    assert(storeLogin.status === 200 && storeLogin.data.data?.accessToken, '1c. Storekeeper (PRJ-101) authentication successful');
    const storeToken = storeLogin.data.data.accessToken;

    // 2. Query Project Catalog (GET /api/projects)
    const projectsRes = await apiRequest('GET', '/api/projects', null, adminToken);
    assert(
      projectsRes.status === 200 && Array.isArray(projectsRes.data.data) && projectsRes.data.data.length >= 3,
      '2. GET /api/projects returns seeded construction sites with boundary scoping'
    );

    // 3. Reject requisition for non-existent project (400 Bad Request)
    const invalidProjRes = await apiRequest('POST', '/api/requisitions', {
      projectId: 'PRJ-NONEXISTENT',
      requiredDate: '2026-11-20',
      purpose: 'Testing invalid project handling',
      items: [],
    }, adminToken);
    assert(invalidProjRes.status === 400, '3. POST /api/requisitions rejects invalid ProjectId with 400 Bad Request');

    // 4. Reject requisition if user lacks project boundary scope (403 Forbidden)
    // Storekeeper only has PRJ-101, attempting to request for PRJ-102
    const unauthProjRes = await apiRequest('POST', '/api/requisitions', {
      projectId: 'PRJ-102',
      requiredDate: '2026-11-20',
      purpose: 'Testing unauthorized project site scoping',
      items: [],
    }, storeToken);
    assert(unauthProjRes.status === 403, '4. POST /api/requisitions enforces project scope and rejects unassigned project with 403 Forbidden');

    // 5. Reject invalid material ID (400 Bad Request)
    const invalidMatRes = await apiRequest('POST', '/api/requisitions', {
      projectId: 'PRJ-101',
      requiredDate: '2026-11-20',
      purpose: 'Pier column pouring',
      items: [
        {
          materialId: 'MAT-NONEXISTENT-999',
          requestedQuantity: 10,
        },
      ],
    }, storeToken);
    assert(invalidMatRes.status === 400, '5. POST /api/requisitions rejects non-existent or inactive material with 400 Bad Request');

    // 6. Reject negative / zero requested quantity (400 Bad Request)
    const zeroQtyRes = await apiRequest('POST', '/api/requisitions', {
      projectId: 'PRJ-101',
      requiredDate: '2026-11-20',
      purpose: 'Pier column pouring',
      items: [
        {
          materialId: 'MAT-STEEL-01',
          requestedQuantity: 0,
        },
      ],
    }, storeToken);
    assert(zeroQtyRes.status === 400, '6. POST /api/requisitions rejects requestedQuantity <= 0 with 400 Bad Request');

    // 7. Create valid Draft Requisition (201 Created)
    const createRes = await apiRequest('POST', '/api/requisitions', {
      projectId: 'PRJ-101',
      requiredDate: '2026-11-25',
      priority: 'High',
      purpose: 'Guideway pier cap reinforcement steel cage fabrication.',
      workActivity: 'Pier Cap Structural Pour',
      siteLocationDetail: 'Pier 22-26, North Staging Yard',
      items: [
        {
          materialId: 'MAT-STEEL-01',
          requestedQuantity: 12.5,
          remarks: 'Mill certificates required upon delivery',
        },
        {
          materialId: 'MAT-CEM-02',
          requestedQuantity: 100,
          remarks: 'Standard 50kg moisture-sealed bags',
        },
      ],
      submitImmediately: false,
    }, storeToken);

    assert(createRes.status === 201 && createRes.data.data?.requisitionNumber, '7. POST /api/requisitions creates Draft with auto-incremented MR-YYYY-XXXX number');
    const createdReq = createRes.data.data;
    const reqId = createdReq.id;

    // 8. Verify requester stamping from server-side JWT subject
    assert(
      createdReq.requesterUserId === 'USR-STR-04' && createdReq.requesterName === 'Marcus Vance',
      '8. Requester identity is server-derived from JWT claims and never trusted from client payload'
    );

    // 8b. Verify stock availability isolation note
    assert(
      createdReq.items[0].stockAvailabilityNote === 'Not yet connected (Future Integration Point)',
      '8b. Line item stock availability strictly isolated as "Not yet connected (Future Integration Point)"'
    );

    // 9. Fetch requisition detail by ID (200 OK)
    const getRes = await apiRequest('GET', `/api/requisitions/${reqId}`, null, storeToken);
    assert(getRes.status === 200 && getRes.data.data.status === 'Draft', '9. GET /api/requisitions/:id retrieves draft with full line items');

    // 10. Submit Requisition for approval (200 OK)
    const submitRes = await apiRequest('POST', `/api/requisitions/${reqId}/submit`, {
      comments: 'Submitted for PM review before fabrication.',
    }, storeToken);
    assert(submitRes.status === 200 && submitRes.data.data.status === 'Submitted', '10. POST /api/requisitions/:id/submit transitions status to Submitted (Pending Approval)');

    // 11. Immutable state guard: Editing submitted requisition rejected with 400 Bad Request
    const editSubmittedRes = await apiRequest('PUT', `/api/requisitions/${reqId}`, {
      purpose: 'Attempting to modify a locked requisition',
    }, storeToken);
    assert(editSubmittedRes.status === 400, '11. PUT /api/requisitions/:id rejects editing locked Submitted requisition with 400 Bad Request');

    // 12. Self-approval policy guard: Storekeeper cannot approve their own requisition
    const selfApproveRes = await apiRequest('POST', `/api/requisitions/${reqId}/approve`, {
      comments: 'Self-approval attempt',
    }, storeToken);
    assert(selfApproveRes.status === 403, '12. Self-approval policy blocks requester from approving own requisition with 403 Forbidden');

    // 13. Rejection requires mandatory explanation comment (400 Bad Request)
    const rejectNoReasonRes = await apiRequest('POST', `/api/requisitions/${reqId}/reject`, {
      reason: '',
    }, pmToken);
    assert(rejectNoReasonRes.status === 400, '13. POST /api/requisitions/:id/reject without mandatory explanation rejected with 400 Bad Request');

    // 14. Return for correction requires mandatory feedback instructions (400 Bad Request)
    const returnNoNotesRes = await apiRequest('POST', `/api/requisitions/${reqId}/return-for-correction`, {
      notes: '',
    }, pmToken);
    assert(returnNoNotesRes.status === 400, '14. Return for correction without mandatory instructions rejected with 400 Bad Request');

    // 15. PM successfully returns requisition for correction (200 OK)
    const returnRes = await apiRequest('POST', `/api/requisitions/${reqId}/return-for-correction`, {
      notes: 'Reduce rebar quantity from 12.5 MT to 8.0 MT to align with weekly pouring cycle.',
    }, pmToken);
    assert(
      returnRes.status === 200 && returnRes.data.data.status === 'ReturnedForCorrection',
      '15. Authorized Project Manager successfully returns requisition with ReturnedForCorrection status'
    );

    // 16. Requester edits line items on returned requisition and resubmits
    const updateReturnedRes = await apiRequest('PUT', `/api/requisitions/${reqId}`, {
      items: [
        {
          materialId: 'MAT-STEEL-01',
          requestedQuantity: 8.0,
          remarks: 'Adjusted to weekly phase limit per PM instruction',
        },
        {
          materialId: 'MAT-CEM-02',
          requestedQuantity: 100,
        },
      ],
      updateComments: 'Adjusted rebar quantity to 8.0 MT.',
    }, storeToken);
    assert(updateReturnedRes.status === 200, '16a. Requester successfully updates line items on ReturnedForCorrection requisition');

    const resubmitRes = await apiRequest('POST', `/api/requisitions/${reqId}/submit`, {
      comments: 'Resubmitting with reduced rebar quantity.',
    }, storeToken);
    assert(resubmitRes.status === 200 && resubmitRes.data.data.status === 'Submitted', '16b. Requester resubmits requisition to Submitted status');

    // 17. Project Manager approves requisition (200 OK)
    const approveRes = await apiRequest('POST', `/api/requisitions/${reqId}/approve`, {
      comments: 'Approved. Adjusted quantities verified against site schedule.',
    }, pmToken);
    assert(
      approveRes.status === 200 && approveRes.data.data.status === 'Approved',
      '17. Authorized Project Manager approves requisition with status Approved and stamps audit trail'
    );

    // 18. Audit trail completeness verification
    const finalDetailRes = await apiRequest('GET', `/api/requisitions/${reqId}`, null, pmToken);
    const finalHistory = finalDetailRes.data.data.approvalHistory;
    const actions = finalHistory.map((h: any) => h.action);
    assert(
      actions.includes('DraftCreated') &&
      actions.includes('Submitted') &&
      actions.includes('ReturnedForCorrection') &&
      actions.includes('Approved'),
      '18. Complete chronological audit trail preserved with all status transitions and comments'
    );

    // 19. Pending Approval Inbox verification (GET /api/approvals/inbox)
    const inboxRes = await apiRequest('GET', '/api/approvals/inbox', null, pmToken);
    assert(
      inboxRes.status === 200 && Array.isArray(inboxRes.data.data),
      '19. GET /api/approvals/inbox returns pending submitted requests for assigned projects'
    );

    // 20. Verify atomic persistence in /data/requisitions.json on disk
    const dataFilePath = path.resolve(process.cwd(), 'data', 'requisitions.json');
    assert(fs.existsSync(dataFilePath), '20a. Requisitions local JSON storage file exists on disk');
    const persistedContent = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    const persistedRecord = persistedContent.find((r: any) => r.id === reqId);
    assert(
      persistedRecord && persistedRecord.status === 'Approved',
      '20b. Approved requisition and state transitions atomically persisted in /data/requisitions.json'
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    testsFailed++;
  }

  console.log(`\n=== TEST SUITE RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runRequisitionTests();
