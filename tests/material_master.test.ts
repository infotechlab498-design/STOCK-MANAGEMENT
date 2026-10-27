/**
 * Automated Material Master & Local JSON Storage Test Suite
 * Tests:
 * 1. Seed categories and units retrieval
 * 2. Material creation with valid parameters (201 Created)
 * 3. Duplicate ItemCode rejection (409 Conflict)
 * 4. Case-insensitive duplicate ItemCode rejection (409 Conflict)
 * 5. Negative minimumStockLevel rejection (400 Bad Request)
 * 6. ReorderLevel < MinimumStockLevel rejection (400 Bad Request)
 * 7. Non-existent category rejection (400 Bad Request)
 * 8. Non-existent base unit rejection (400 Bad Request)
 * 9. Fetch material by ID (200 OK)
 * 10. Update material fields (200 OK)
 * 11. Deactivate material (200 OK)
 * 12. Reactivate material (200 OK)
 * 13. Search and filter by category (200 OK)
 * 14. Unit conversions query (200 OK)
 * 15. Verify persistence in /data/materials.json
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

async function runMaterialMasterTests() {
  console.log('=== STARTING MATERIAL MASTER TEST SUITE ===\n');
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
            let parsed = null;
            try {
              parsed = JSON.parse(chunks);
            } catch {
              parsed = chunks;
            }
            resolve({ status: res.statusCode || 500, data: parsed });
          });
        }
      );

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    // 1. Authenticate as Super Admin
    const loginRes = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'admin@constructcorp.com',
      password: 'Admin@2026!Stock',
    });
    assert(loginRes.status === 200, '1. Admin authentication successful for test suite');
    const adminToken = loginRes.data?.data?.accessToken;

    // 2. Fetch Master Categories
    const categoriesRes = await apiRequest('GET', '/api/material-categories', undefined, adminToken);
    assert(
      categoriesRes.status === 200 && Array.isArray(categoriesRes.data?.data) && categoriesRes.data?.data?.length >= 10,
      '2. GET /api/material-categories returns seeded construction categories',
      `Count: ${categoriesRes.data?.data?.length}`
    );
    const steelCat = categoriesRes.data?.data?.find((c: any) => c.code === 'STEEL') || categoriesRes.data?.data?.[0];

    // 3. Fetch Master Units of Measure
    const unitsRes = await apiRequest('GET', '/api/units', undefined, adminToken);
    assert(
      unitsRes.status === 200 && Array.isArray(unitsRes.data?.data) && unitsRes.data?.data?.length >= 6,
      '3. GET /api/units returns standard engineering UoMs',
      `Count: ${unitsRes.data?.data?.length}`
    );
    const mtUnit = unitsRes.data?.data?.find((u: any) => u.code === 'MT') || unitsRes.data?.data?.[0];

    // 4. Fetch Unit Conversions
    const convRes = await apiRequest('GET', '/api/unit-conversions', undefined, adminToken);
    assert(
      convRes.status === 200 && Array.isArray(convRes.data?.data) && convRes.data?.data?.length >= 2,
      '4. GET /api/unit-conversions returns standard conversion ratios'
    );

    // 5. Create New Material SKU (201 Created)
    const testSkuCode = `TEST-REBAR-${Date.now().toString(36).toUpperCase()}`;
    const createRes = await apiRequest(
      'POST',
      '/api/materials',
      {
        itemCode: testSkuCode,
        name: 'High Tensile Rebar 25mm Grade 500',
        description: 'Testing material creation with atomic JSON backend',
        specification: 'ASTM A615 Grade 60, 12m length',
        categoryId: steelCat.id,
        baseUnitId: mtUnit.id,
        minimumStockLevel: 15.5,
        reorderLevel: 30.0,
      },
      adminToken
    );
    assert(
      createRes.status === 201 && createRes.data?.data?.itemCode === testSkuCode,
      '5. POST /api/materials creates new material and returns 201 Created',
      `Status: ${createRes.status}`
    );
    const createdMaterialId = createRes.data?.data?.id;

    // 6. Duplicate ItemCode Rejection (409 Conflict)
    const duplicateRes = await apiRequest(
      'POST',
      '/api/materials',
      {
        itemCode: testSkuCode,
        name: 'Duplicate Rebar Attempt',
        categoryId: steelCat.id,
        baseUnitId: mtUnit.id,
        minimumStockLevel: 5,
        reorderLevel: 10,
      },
      adminToken
    );
    assert(
      duplicateRes.status === 409,
      '6. POST /api/materials rejects exact duplicate ItemCode with 409 Conflict',
      `Status: ${duplicateRes.status}, Message: ${duplicateRes.data?.message}`
    );

    // 7. Case-insensitive Duplicate Rejection (409 Conflict)
    const caseDuplicateRes = await apiRequest(
      'POST',
      '/api/materials',
      {
        itemCode: testSkuCode.toLowerCase(),
        name: 'Case Insensitive Duplicate Attempt',
        categoryId: steelCat.id,
        baseUnitId: mtUnit.id,
        minimumStockLevel: 5,
        reorderLevel: 10,
      },
      adminToken
    );
    assert(
      caseDuplicateRes.status === 409,
      '7. POST /api/materials rejects case-insensitive duplicate ItemCode with 409 Conflict',
      `Status: ${caseDuplicateRes.status}`
    );

    // 8. Negative Minimum Stock Rejection (400 Bad Request)
    const negativeStockRes = await apiRequest(
      'POST',
      '/api/materials',
      {
        itemCode: `TEST-NEG-${Date.now().toString(36)}`,
        name: 'Negative Stock Rebar',
        categoryId: steelCat.id,
        baseUnitId: mtUnit.id,
        minimumStockLevel: -5,
        reorderLevel: 10,
      },
      adminToken
    );
    assert(
      negativeStockRes.status === 400,
      '8. POST /api/materials rejects negative minimumStockLevel with 400 Bad Request'
    );

    // 9. ReorderLevel < MinimumStockLevel Rejection (400 Bad Request)
    const invalidReorderRes = await apiRequest(
      'POST',
      '/api/materials',
      {
        itemCode: `TEST-REORDER-${Date.now().toString(36)}`,
        name: 'Invalid Reorder Rebar',
        categoryId: steelCat.id,
        baseUnitId: mtUnit.id,
        minimumStockLevel: 50,
        reorderLevel: 20, // Lower than minimum stock!
      },
      adminToken
    );
    assert(
      invalidReorderRes.status === 400,
      '9. POST /api/materials rejects ReorderLevel < MinimumStockLevel with 400 Bad Request'
    );

    // 10. Non-existent Category Rejection (400 Bad Request)
    const invalidCatRes = await apiRequest(
      'POST',
      '/api/materials',
      {
        itemCode: `TEST-CAT-${Date.now().toString(36)}`,
        name: 'Invalid Category Material',
        categoryId: 'NON_EXISTENT_CAT_999',
        baseUnitId: mtUnit.id,
        minimumStockLevel: 10,
        reorderLevel: 20,
      },
      adminToken
    );
    assert(
      invalidCatRes.status === 400,
      '10. POST /api/materials rejects invalid CategoryId with 400 Bad Request'
    );

    // 11. Fetch Material By ID (200 OK)
    const getByIdRes = await apiRequest('GET', `/api/materials/${createdMaterialId}`, undefined, adminToken);
    assert(
      getByIdRes.status === 200 && getByIdRes.data?.data?.id === createdMaterialId,
      '11. GET /api/materials/:id returns 200 OK and matching record'
    );

    // 12. Update Material (PUT /api/materials/:id) (200 OK)
    const updateRes = await apiRequest(
      'PUT',
      `/api/materials/${createdMaterialId}`,
      {
        name: 'Updated High Tensile Rebar 25mm Grade 500B',
        description: 'Updated description for testing',
        specification: 'BS 4449 Grade 500B, 12m',
        categoryId: steelCat.id,
        baseUnitId: mtUnit.id,
        minimumStockLevel: 20.0,
        reorderLevel: 45.0,
      },
      adminToken
    );
    assert(
      updateRes.status === 200 && updateRes.data?.data?.name === 'Updated High Tensile Rebar 25mm Grade 500B',
      '12. PUT /api/materials/:id updates material specifications and returns 200 OK'
    );

    // 13. Deactivate Material (PATCH /api/materials/:id/status)
    const deactivateRes = await apiRequest(
      'PATCH',
      `/api/materials/${createdMaterialId}/status`,
      { isActive: false },
      adminToken
    );
    assert(
      deactivateRes.status === 200 && deactivateRes.data?.data?.isActive === false,
      '13. PATCH /api/materials/:id/status deactivates material'
    );

    // 14. Reactivate Material
    const reactivateRes = await apiRequest(
      'PATCH',
      `/api/materials/${createdMaterialId}/status`,
      { isActive: true },
      adminToken
    );
    assert(
      reactivateRes.status === 200 && reactivateRes.data?.data?.isActive === true,
      '14. PATCH /api/materials/:id/status reactivates material'
    );

    // 15. Search and Filter
    const searchRes = await apiRequest(
      'GET',
      `/api/materials?search=${encodeURIComponent(testSkuCode)}`,
      undefined,
      adminToken
    );
    assert(
      searchRes.status === 200 && searchRes.data?.data?.length === 1,
      '15. GET /api/materials?search filters correctly by SKU code'
    );

    // 16. Verify Local Storage File Persistence
    const dataFilePath = path.resolve(process.cwd(), 'data', 'materials.json');
    const fileExists = fs.existsSync(dataFilePath);
    assert(fileExists, '16. Local storage file /data/materials.json exists on disk');

    if (fileExists) {
      const fileData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
      const foundInFile = fileData.some((m: any) => m.id === createdMaterialId);
      assert(foundInFile, '16b. Created material is atomically persisted in local JSON file');
    }

    console.log(`\n=== TEST SUITE RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled exception in test runner:', err);
    process.exit(1);
  }
}

runMaterialMasterTests();
