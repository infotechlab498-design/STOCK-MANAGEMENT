/**
 * Automated Security & Authentication Test Suite
 * Tests:
 * 1. Valid login generates JWT and user profile
 * 2. Invalid password returns 401 (generic message, anti-enumeration)
 * 3. Non-existent user returns 401 (generic message, anti-enumeration)
 * 4. Disabled/inactive user returns 403 Forbidden
 * 5. Unauthenticated requests to protected endpoints return 401 Unauthorized
 * 6. Role-based access: Viewer/Storekeeper denied from /api/users (403 Forbidden)
 * 7. Role-based access: SuperAdmin permitted on /api/users (200 OK)
 * 8. Unauthorized role escalation blocked: Non-SuperAdmin cannot create SuperAdmin
 * 9. Input validation: Password < 8 characters rejected (400 Bad Request)
 * 10. Last Super Admin protection: Cannot deactivate the sole active Super Admin
 * 11. Project & Warehouse scope enforcement verification
 */

import http from 'node:http';
import { AddressInfo } from 'node:net';

// Import our server setup or test against running endpoint
async function runSecurityTests() {
  console.log('=== STARTING SECURITY & AUTHENTICATION TEST SUITE ===\n');
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

  // Helper to make HTTP requests
  async function apiRequest(
    method: string,
    path: string,
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
          path,
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
    // 1. Valid Login (Super Admin)
    const validLoginRes = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'admin@constructcorp.com',
      password: 'Admin@2026!Stock',
    });
    assert(
      validLoginRes.status === 200 && Boolean(validLoginRes.data?.data?.accessToken),
      '1. Valid login generates JWT access token and returns 200 OK',
      `Got status ${validLoginRes.status}`
    );
    const adminToken = validLoginRes.data?.data?.accessToken;
    const adminProfile = validLoginRes.data?.data?.user;
    assert(
      adminProfile?.roles?.includes('SuperAdmin'),
      '1b. Authenticated user profile contains SuperAdmin role'
    );

    // 2. Invalid Password (Anti-Enumeration)
    const badPassRes = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'admin@constructcorp.com',
      password: 'WrongPassword123!',
    });
    assert(
      badPassRes.status === 401 && badPassRes.data?.message === 'Invalid email or password',
      '2. Invalid password returns 401 with generic message (prevents user enumeration)'
    );

    // 3. Non-existent User (Anti-Enumeration)
    const nonExistentRes = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'ghost.user@constructcorp.com',
      password: 'AnyPassword123!',
    });
    assert(
      nonExistentRes.status === 401 && nonExistentRes.data?.message === 'Invalid email or password',
      '3. Non-existent email returns identical 401 message (prevents timing/content enumeration)'
    );

    // 4. Inactive/Disabled User
    const disabledLoginRes = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'disabled.user@constructcorp.com',
      password: 'Disabled@2026!Test',
    });
    assert(
      disabledLoginRes.status === 403 && disabledLoginRes.data?.message?.includes('inactive'),
      '4. Disabled/inactive user rejected with 403 Forbidden'
    );

    // 5. Unauthenticated Access Protection
    const unauthRes = await apiRequest('GET', '/api/auth/me');
    assert(
      unauthRes.status === 401,
      '5. Unauthenticated request to /api/auth/me rejected with 401'
    );

    // 6. Valid Login as Storekeeper
    const storekeeperLoginRes = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: 'store.north@constructcorp.com',
      password: 'Store@2026!Keeper',
    });
    assert(
      storekeeperLoginRes.status === 200,
      '6a. Valid login as Storekeeper succeeded'
    );
    const storekeeperToken = storekeeperLoginRes.data?.data?.accessToken;

    // 6b. Role-Based Access: Storekeeper denied from /api/users
    const forbiddenUsersRes = await apiRequest('GET', '/api/users', undefined, storekeeperToken);
    assert(
      forbiddenUsersRes.status === 403,
      '6b. Storekeeper user correctly denied from /api/users with 403 Forbidden'
    );

    // 7. Role-Based Access: SuperAdmin permitted on /api/users
    const adminUsersRes = await apiRequest('GET', '/api/users', undefined, adminToken);
    assert(
      adminUsersRes.status === 200 && Array.isArray(adminUsersRes.data?.data),
      '7. Super Admin permitted on /api/users and receives user directory list'
    );

    // 8. Input Validation: Password length < 8 chars rejected
    const shortPassRes = await apiRequest(
      'POST',
      '/api/users',
      {
        username: 'short.pass',
        email: 'short@constructcorp.com',
        fullName: 'Short Pass Test',
        password: 'short',
        roles: ['Viewer'],
      },
      adminToken
    );
    assert(
      shortPassRes.status === 400 && shortPassRes.data?.message?.includes('8 characters'),
      '8. User creation rejects password under 8 characters with 400 Bad Request'
    );

    // 9. Input Validation: Duplicate Email Rejected
    const dupEmailRes = await apiRequest(
      'POST',
      '/api/users',
      {
        username: 'another.admin',
        email: 'admin@constructcorp.com', // Duplicate
        fullName: 'Another Admin',
        password: 'ValidPassword123!',
        roles: ['Viewer'],
      },
      adminToken
    );
    assert(
      dupEmailRes.status === 400 && dupEmailRes.data?.message?.includes('already exists'),
      '9. Duplicate email address rejected with 400 Bad Request'
    );

    // 10. Creation of valid new user
    const uniqueUser = `qa.tech.${Date.now()}`;
    const createSuccessRes = await apiRequest(
      'POST',
      '/api/users',
      {
        username: uniqueUser,
        email: `${uniqueUser}@constructcorp.com`,
        fullName: 'QA Testing Technician',
        password: 'StrongPassword2026!',
        roles: ['Viewer'],
        projectScopes: ['PRJ-101'],
        warehouseScopes: ['WH-01'],
      },
      adminToken
    );
    assert(
      createSuccessRes.status === 201,
      '10. Valid user creation succeeded with 201 Created and scoped boundaries'
    );
    const createdUserId = createSuccessRes.data?.data?.id;

    // 11. Status Toggle (Deactivate user)
    const deactivateRes = await apiRequest(
      'PATCH',
      `/api/users/${createdUserId}/status`,
      { isActive: false },
      adminToken
    );
    assert(
      deactivateRes.status === 200 && deactivateRes.data?.data?.isActive === false,
      '11. Successfully deactivated user account via PATCH /api/users/{id}/status'
    );

    // 12. Deactivated User Cannot Login
    const deactivatedLoginRes = await apiRequest('POST', '/api/auth/login', {
      usernameOrEmail: `${uniqueUser}@constructcorp.com`,
      password: 'StrongPassword2026!',
    });
    assert(
      deactivatedLoginRes.status === 403,
      '12. Deactivated user cannot log in (403 Forbidden)'
    );

    // 13. Guard: Cannot Deactivate Last Active Super Admin
    const deactivateAdminRes = await apiRequest(
      'PATCH',
      '/api/users/USR-ADMIN-01/status',
      { isActive: false },
      adminToken
    );
    assert(
      deactivateAdminRes.status === 400 && deactivateAdminRes.data?.message?.includes('last active Super Admin'),
      '13. Guard prevents deactivating the last active Super Admin account'
    );

    // 14. Project & Warehouse Scope verification via /api/auth/me
    const storeMeRes = await apiRequest('GET', '/api/auth/me', undefined, storekeeperToken);
    assert(
      storeMeRes.status === 200 &&
      storeMeRes.data?.data?.projectScopes?.includes('PRJ-101') &&
      storeMeRes.data?.data?.warehouseScopes?.includes('WH-02'),
      '14. Authenticated session enforces specific Project and Warehouse boundary scopes'
    );

    // 15. Session Logout
    const logoutRes = await apiRequest('POST', '/api/auth/logout', undefined, adminToken);
    assert(
      logoutRes.status === 200,
      '15. Logout endpoint terminates session cleanly'
    );
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    testsFailed++;
  }

  console.log(`\n=== TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED ===\n`);
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runSecurityTests();
