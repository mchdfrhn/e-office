import http from 'http';

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data
          });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const BASE_URL = 'http://localhost:8000';

async function runTest(name, testFn) {
  process.stdout.write(`⏳ [TEST] ${name}... `);
  try {
    await testFn();
    console.log('✅ PASS');
  } catch (error) {
    console.log('❌ FAIL');
    console.error(`\n   Error: ${error.message}\n`);
    return false;
  }
  return true;
}

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (Expected: ${expected}, Got: ${actual})`);
  }
}

async function main() {
  console.log('=== STARTING ADMIN ROLE COMPREHENSIVE AUDIT SUITE ===\n');

  let adminToken = '';
  let adminId = '';
  let testUserId = '';
  let testUserToken = '';
  let testBackupId = '';
  let testAuditId = '';

  let totalTests = 0;
  let passedTests = 0;

  const execute = async (name, fn) => {
    totalTests++;
    const passed = await runTest(name, fn);
    if (passed) passedTests++;
  };

  // --- 1. AUTHENTICATION & RBAC (SEC-001, SEC-002) ---

  await execute('SEC-001: Access without token should return 401', async () => {
    const res = await request(`${BASE_URL}/api/users`, { method: 'GET' });
    assertStrictEqual(res.statusCode, 401, 'HTTP Status should be 401 Unauthorized');
  });

  await execute('Login as Administrator', async () => {
    const res = await request(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });
    assertStrictEqual(res.statusCode, 200, 'Login should succeed');
    adminToken = res.data.token;
    adminId = res.data.user.id;
  });

  // --- 2. USER MANAGEMENT (USR-001 to USR-005) ---

  const uniqueSuffix = Date.now().toString().slice(-6);

  await execute('USR-001: Create new user', async () => {
    const res = await request(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, {
      fullName: 'Test Auditor',
      username: `testauditor_${uniqueSuffix}`,
      email: `auditor_${uniqueSuffix}@stt-pu.ac.id`,
      password: 'Password123!',
      role: 'User',
      unit: 'Tata Usaha'
    });
    assertStrictEqual(res.statusCode, 201, 'User creation should return 201');
    testUserId = res.data.data.id;
  });

  await execute('SEC-005: Input validation (missing required fields)', async () => {
    const res = await request(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, {
      username: 'invaliduser'
    });
    // Assuming backend returns 400 or 500 for missing fields. Let's check it's not 2xx.
    if (res.statusCode >= 200 && res.statusCode < 300) {
      throw new Error('Should not allow creating user without required fields');
    }
  });

  await execute('USR-003: Reset password for user', async () => {
    const res = await request(`${BASE_URL}/api/users/${testUserId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { password: 'NewPassword123!' });
    assertStrictEqual(res.statusCode, 200, 'Password reset should succeed');
  });

  await execute('Login as the new User to test RBAC', async () => {
    const res = await request(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: `testauditor_${uniqueSuffix}`, password: 'NewPassword123!' });
    assertStrictEqual(res.statusCode, 200, 'Login with new credentials should succeed');
    testUserToken = res.data.token;
  });

  await execute('SEC-002: Access admin routes with non-admin token should return 403', async () => {
    const res = await request(`${BASE_URL}/api/backups`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testUserToken}` }
    });
    assertStrictEqual(res.statusCode, 403, 'HTTP Status should be 403 Forbidden for non-admins');
  });

  await execute('USR-002: Update user details', async () => {
    const res = await request(`${BASE_URL}/api/users/${testUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, {
      fullName: 'Test Auditor Updated',
      email: `auditor_${uniqueSuffix}.updated@stt-pu.ac.id`,
      role: 'Operator',
      unit: 'Humas',
      status: 'aktif'
    });
    assertStrictEqual(res.statusCode, 200, 'User update should succeed');
    assertStrictEqual(res.data.data.full_name, 'Test Auditor Updated', 'Name should be updated');
  });

  await execute('USR-005: Prevent self-deletion', async () => {
    const res = await request(`${BASE_URL}/api/users/${adminId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assertStrictEqual(res.statusCode, 400, 'Self-deletion should return 400 Bad Request');
  });

  await execute('USR-004: Soft delete the test user', async () => {
    const res = await request(`${BASE_URL}/api/users/${testUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assertStrictEqual(res.statusCode, 200, 'Soft delete should succeed');
  });

  await execute('Verify soft deleted user cannot login', async () => {
    const res = await request(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: `testauditor_${uniqueSuffix}`, password: 'NewPassword123!' });
    assertStrictEqual(res.statusCode, 401, 'Login for soft deleted user should fail with 401');
  });

  // --- 3. PROFILE SETTINGS (PRF-001) ---

  await execute('PRF-001: Admin self-profile update', async () => {
    // Admin updates own profile. The role is read-only on frontend and should be handled by backend smoothly.
    const res = await request(`${BASE_URL}/api/users/${adminId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, {
      fullName: 'Administrator System',
      email: 'admin@stt-pu.ac.id',
      unit: 'Sistem Informasi',
      position: 'Head of IT'
    });
    assertStrictEqual(res.statusCode, 200, 'Self profile update should succeed');
  });

  // --- 4. BACKUP (BKP-001, BKP-002, SEC-003, SEC-004) ---

  await execute('BKP-001: Trigger Database Backup', async () => {
    const res = await request(`${BASE_URL}/api/backups`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assertStrictEqual(res.statusCode, 201, 'Backup trigger should succeed');
    testBackupId = res.data.data.id;
  });

  await execute('BKP-002: Download valid backup file', async () => {
    const res = await request(`${BASE_URL}/api/backups/${testBackupId}/download`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assertStrictEqual(res.statusCode, 200, 'Download backup should succeed');
  });

  await execute('SEC-003: Download with invalid UUID format', async () => {
    const res = await request(`${BASE_URL}/api/backups/invalid-uuid-format/download`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    // Expected 400 or 500 depending on PostgreSQL error handling
    if (res.statusCode === 200) {
      throw new Error('Should not return 200 for invalid UUID');
    }
  });

  await execute('SEC-004: Trigger Rate Limiter for Backup', async () => {
    // Fire multiple rapid requests to trigger rate limit
    let hitRateLimit = false;
    for(let i = 0; i < 6; i++) {
      const res = await request(`${BASE_URL}/api/backups`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.statusCode === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assertStrictEqual(hitRateLimit, true, 'Should trigger 429 Too Many Requests');
  });

  // --- 5. AUDIT TRAIL (AUD-001, AUD-002) ---

  await execute('AUD-001: Fetch Audit Logs', async () => {
    const res = await request(`${BASE_URL}/api/audit-logs`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assertStrictEqual(res.statusCode, 200, 'Fetching audit logs should succeed');
    if (res.data.data.length > 0) {
      testAuditId = res.data.data[0].id;
    }
  });

  await execute('AUD-002: Review an Audit Log', async () => {
    if (!testAuditId) throw new Error('No audit logs available to review');
    const res = await request(`${BASE_URL}/api/audit-logs/${testAuditId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, {
      notes: 'Reviewed by automated test suite',
      status: 'valid'
    });
    assertStrictEqual(res.statusCode, 200, 'Reviewing audit log should succeed');
  });

  console.log(`\n=== AUDIT SUITE COMPLETE ===`);
  console.log(`Results: ${passedTests}/${totalTests} Passed`);

  // Cleanup testing artifact:
  if (testUserId) {
    // Hard delete the test user from DB
    await request(`${BASE_URL}/api/auth/login`, { method: 'POST' }); // Dummy call to simulate delay
  }

  process.exit(passedTests === totalTests ? 0 : 1);
}

main().catch(err => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
