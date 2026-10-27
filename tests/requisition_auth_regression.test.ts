import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveApiUrl, isJwtTokenValid } from '../src/services/api/apiClient';

const BASE_URL = 'http://localhost:3000/api/v1';

async function request(method: string, endpoint: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

function createExpiredToken(): string {
  const secret = process.env.JWT_SECRET || 'construct-stock-enterprise-secret-key-2026-v1';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'USR-ADMIN-01',
      email: 'admin@constructstock.io',
      username: 'superadmin',
      fullName: 'Alexander Vance (Chief Operations Officer)',
      roles: ['SuperAdmin'],
      projectScopes: ['PRJ-001', 'PRJ-002', 'PRJ-003'],
      warehouseScopes: ['WH-CENTRAL-01', 'WH-SITE-01', 'WH-SITE-02'],
      iss: 'ConstructionStock.Enterprise.Api',
      aud: 'ConstructionStock.Enterprise.Client',
      iat: now - 7200,
      exp: now - 3600, // Expired 1 hour ago
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function runTests() {
  console.log('=== Starting Requisition, Auth & 404 Regression Suite ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${details ? ` — ${details}` : ''}`);
      failed++;
    }
  }

  // Backup requisitions.json so test creations do not pollute demo state
  const reqFilePath = path.join(process.cwd(), 'data', 'requisitions.json');
  const originalRequisitions = fs.existsSync(reqFilePath)
    ? fs.readFileSync(reqFilePath, 'utf-8')
    : null;

  try {
    // 1. Missing token -> 401
    const noAuthProjects = await request('GET', '/projects');
    assert(
      noAuthProjects.status === 401 &&
        noAuthProjects.body?.message === 'Unauthorized: Missing or invalid authorization token',
      '1. GET /api/v1/projects without Authorization header returns 401',
      JSON.stringify(noAuthProjects)
    );

    // 2. Expired JWT -> 401 + frontend isJwtTokenValid detects expiry
    const expiredJwt = createExpiredToken();
    assert(
      isJwtTokenValid(expiredJwt) === false,
      '2a. Frontend isJwtTokenValid() returns false for expired JWT'
    );
    const expiredProjects = await request('GET', '/projects', expiredJwt);
    assert(
      expiredProjects.status === 401 &&
        expiredProjects.body?.message === 'Unauthorized: Token is expired or invalid',
      '2b. GET /api/v1/projects with expired JWT returns 401 Token is expired or invalid',
      JSON.stringify(expiredProjects)
    );

    // 3. Legacy bypass-token is rejected with 401
    const bypassRes = await request('GET', '/projects', 'bypass-token:USR-ADMIN-01');
    assert(
      bypassRes.status === 401,
      '3. Legacy bypass-token is strictly rejected with 401 Unauthorized',
      JSON.stringify(bypassRes)
    );

    // 4. Valid login returns signed JWT that passes isJwtTokenValid
    const loginRes = await request('POST', '/auth/login', undefined, {
      usernameOrEmail: 'pm.metro@constructcorp.com',
      password: 'Project@2026!Metro',
    });
    const pmToken = loginRes.body?.data?.accessToken;
    assert(
      loginRes.status === 200 && Boolean(pmToken) && isJwtTokenValid(pmToken),
      '4. POST /api/v1/auth/login issues valid JWT for ProjectManager (pm.metro)',
      `status=${loginRes.status}`
    );

    // 5. Authenticated GET /api/v1/projects returns scoped projects for pm.metro (PRJ-101)
    const projectsRes = await request('GET', '/projects', pmToken);
    assert(
      projectsRes.status === 200 &&
        Array.isArray(projectsRes.body?.data) &&
        projectsRes.body.data.length === 1 &&
        projectsRes.body.data[0].id === 'PRJ-101',
      '5. GET /api/v1/projects returns authorized projects for ProjectManager (PRJ-101)',
      JSON.stringify(projectsRes.body)
    );

    // 6. Earlier 404 Regression Check:
    // Verify that double-prefixed '/api/v1/api/materials' was the 404 cause, and resolveApiUrl normalizes '/api/materials' -> '/api/v1/materials'
    const normalizedMaterialsUrl = resolveApiUrl('/api/materials?status=ACTIVE').url;
    assert(
      normalizedMaterialsUrl === '/api/v1/materials?status=ACTIVE',
      '6a. resolveApiUrl("/api/materials?status=ACTIVE").url normalizes to "/api/v1/materials?status=ACTIVE"',
      `got ${normalizedMaterialsUrl}`
    );
    const materialsRes = await request('GET', '/materials?status=ACTIVE', pmToken);
    const activeMaterialId = materialsRes.body?.data?.[0]?.id || 'MAT-101';
    assert(
      materialsRes.status === 200 &&
        Array.isArray(materialsRes.body?.data) &&
        materialsRes.body.data.length > 0,
      '6b. GET /api/v1/materials?status=ACTIVE returns 200 OK with active materials for New Requisition form',
      `status=${materialsRes.status}`
    );

    // 7. Requisition Directory & Search
    const reqListRes = await request('GET', '/requisitions?page=1&pageSize=20', pmToken);
    assert(
      reqListRes.status === 200 && Array.isArray(reqListRes.body?.data?.items),
      '7a. GET /api/v1/requisitions loads authorized requisitions',
      `status=${reqListRes.status}`
    );
    const reqSearchRes = await request('GET', '/requisitions?search=Portland', pmToken);
    assert(
      reqSearchRes.status === 200 && Array.isArray(reqSearchRes.body?.data?.items),
      '7b. GET /api/v1/requisitions?search=Portland succeeds without 500 error',
      `status=${reqSearchRes.status}`
    );

    // 8. Validation failure (400) when creating requisition without required fields
    const invalidCreateRes = await request('POST', '/requisitions', pmToken, {
      projectId: 'PRJ-101',
      requiredDate: 'invalid-date',
      purpose: 'Short',
      items: [],
    });
    assert(
      invalidCreateRes.status === 400,
      '8. POST /api/v1/requisitions with invalid input returns 400 Bad Request',
      JSON.stringify(invalidCreateRes.body)
    );

    // 9. Unauthorized project (403) when pm.metro attempts to create requisition for PRJ-102
    const forbiddenProjectRes = await request('POST', '/requisitions', pmToken, {
      projectId: 'PRJ-102',
      requiredDate: '2026-12-01',
      priority: 'Medium',
      purpose: 'Unauthorized project requisition test',
      items: [{ materialId: activeMaterialId, requestedQuantity: 10 }],
    });
    assert(
      forbiddenProjectRes.status === 403,
      '9. POST /api/v1/requisitions for unauthorized project PRJ-102 returns 403 Forbidden',
      JSON.stringify(forbiddenProjectRes.body)
    );

    // 10. Create Draft Requisition -> Verify Draft status, no stock ledger impact, and retrievable via GET /requisitions/:id
    const ledgerBefore = await request('GET', '/inventory/ledger?projectId=PRJ-101', pmToken);
    const ledgerCountBefore = ledgerBefore.body?.data?.totalCount ?? 0;

    const validCreateRes = await request('POST', '/requisitions', pmToken, {
      projectId: 'PRJ-101',
      requiredDate: '2026-11-30',
      priority: 'High',
      purpose: 'Podium slab concreting and reinforcement works',
      workActivity: 'Level 4 Podium Slab',
      siteLocationDetail: 'Zone A Grid C1-C6',
      submitImmediately: false,
      items: [
        {
          materialId: activeMaterialId,
          requestedQuantity: 50,
          remarks: 'Urgent batch for podium pour',
        },
      ],
    });
    const createdReq = validCreateRes.body?.data;
    assert(
      validCreateRes.status === 201 &&
        createdReq?.status === 'Draft' &&
        createdReq?.projectId === 'PRJ-101' &&
        createdReq?.items?.length === 1,
      '10a. POST /api/v1/requisitions creates Draft requisition (201 Created)',
      JSON.stringify(validCreateRes.body)
    );

    const ledgerAfter = await request('GET', '/inventory/ledger?projectId=PRJ-101', pmToken);
    const ledgerCountAfter = ledgerAfter.body?.data?.totalCount ?? 0;
    assert(
      ledgerCountAfter === ledgerCountBefore,
      '10b. Saving a Draft requisition does NOT issue stock or create ledger entries',
      `before=${ledgerCountBefore}, after=${ledgerCountAfter}`
    );

    const detailRes = await request('GET', `/requisitions/${createdReq.id}`, pmToken);
    assert(
      detailRes.status === 200 && detailRes.body?.data?.id === createdReq.id,
      '10c. GET /api/v1/requisitions/:id retrieves saved draft requisition',
      JSON.stringify(detailRes.body)
    );

    // 11. Nonexistent requisition ID -> 404
    const notFoundRes = await request('GET', '/requisitions/REQ-NONEXISTENT-9999', pmToken);
    assert(
      notFoundRes.status === 404,
      '11. GET /api/v1/requisitions/REQ-NONEXISTENT-9999 returns 404 Not Found',
      JSON.stringify(notFoundRes.body)
    );
  } finally {
    if (originalRequisitions !== null) {
      fs.writeFileSync(reqFilePath, originalRequisitions, 'utf-8');
    }
  }

  console.log(`\n=== Regression Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in regression suite:', err);
  process.exit(1);
});
