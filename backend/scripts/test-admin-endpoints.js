import assert from "assert";

const BACKEND_URL = "http://127.0.0.1:8000/api";

async function runTests() {
  console.log("=== STARTING INTEGRATION TESTS FOR ADMIN ROLE ===\n");
  let token = "";
  let adminId = "";
  let targetUserId = "";

  // 1. Auth: Login
  console.log("Testing POST /auth/login...");
  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" })
    });
    assert.strictEqual(res.status, 200, "Login response should be 200");
    const body = await res.json();
    assert.ok(body.token, "Login should return token");
    assert.strictEqual(body.user.role_code, "administrator", "Role code should be administrator");
    token = body.token;
    adminId = body.user.id;
    console.log(`[PASS] Login successful. User: ${body.user.full_name} (${body.user.role_name})\n`);
  } catch (error) {
    console.error("[FAIL] Login failed:", error.message);
    process.exit(1);
  }

  // Helper for authorized requests
  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  // 2. Users: Get Users List
  console.log("Testing GET /users...");
  try {
    const res = await fetch(`${BACKEND_URL}/users?page=1&perPage=10`, { headers: authHeaders });
    assert.strictEqual(res.status, 200, "Get users should return 200");
    const body = await res.json();
    assert.ok(Array.isArray(body.data), "Users response should contain data array");
    assert.ok(body.meta, "Users response should contain metadata");
    console.log(`[PASS] Get users successful. Total users in system: ${body.meta.totalCount}`);
    
    // Select a non-admin user to test toggle status
    const targetUser = body.data.find(u => u.id !== adminId);
    if (targetUser) {
      targetUserId = targetUser.id;
      console.log(`[INFO] Selected target user for testing: ${targetUser.full_name} (ID: ${targetUserId}, Status: ${targetUser.status})\n`);
    } else {
      console.log("[INFO] No other users found to test toggle status.\n");
    }
  } catch (error) {
    console.error("[FAIL] GET /users failed:", error.message);
    process.exit(1);
  }

  // 3. Users: Toggle User Status
  if (targetUserId) {
    console.log(`Testing PATCH /users/${targetUserId}/toggle-status...`);
    try {
      const res1 = await fetch(`${BACKEND_URL}/users/${targetUserId}/toggle-status`, {
        method: "PATCH",
        headers: authHeaders
      });
      assert.strictEqual(res1.status, 200, "Toggle status first run should return 200");
      const body1 = await res1.json();
      const firstToggledStatus = body1.data.status;
      console.log(`[PASS] Toggled status once. New status: ${firstToggledStatus}`);

      const res2 = await fetch(`${BACKEND_URL}/users/${targetUserId}/toggle-status`, {
        method: "PATCH",
        headers: authHeaders
      });
      assert.strictEqual(res2.status, 200, "Toggle status second run should return 200");
      const body2 = await res2.json();
      assert.notStrictEqual(body2.data.status, firstToggledStatus, "Status should toggle back");
      console.log(`[PASS] Toggled status twice (restored original). Final status: ${body2.data.status}\n`);
    } catch (error) {
      console.error("[FAIL] Toggle status failed:", error.message);
      process.exit(1);
    }
  }

  // 4. Audit Logs: Get Audit Trail
  console.log("Testing GET /audit-logs...");
  let firstAuditLogId = "";
  try {
    const res = await fetch(`${BACKEND_URL}/audit-logs?perPage=10`, { headers: authHeaders });
    assert.strictEqual(res.status, 200, "Get audit logs should return 200");
    const body = await res.json();
    assert.ok(Array.isArray(body.data), "Audit logs response should contain data array");
    console.log(`[PASS] Get audit logs successful. Found ${body.data.length} logs in page`);
    if (body.data.length > 0) {
      firstAuditLogId = body.data[0].id;
      console.log(`[INFO] Selected audit log for review testing: ID: ${firstAuditLogId}, Activity: ${body.data[0].activity}\n`);
    } else {
      console.log("[INFO] No audit logs available to test review.\n");
    }
  } catch (error) {
    console.error("[FAIL] GET /audit-logs failed:", error.message);
    process.exit(1);
  }

  // 5. Audit Logs: Review Log
  if (firstAuditLogId) {
    console.log(`Testing PUT /audit-logs/${firstAuditLogId}/review...`);
    try {
      const res = await fetch(`${BACKEND_URL}/audit-logs/${firstAuditLogId}/review`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ status: "valid", notes: "Verified via automated test runner" })
      });
      assert.strictEqual(res.status, 200, "Review audit log should return 200");
      const body = await res.json();
      assert.strictEqual(body.message, "Tinjauan audit log berhasil disimpan.", "Success message check");
      console.log("[PASS] Audit log review successfully submitted.\n");
    } catch (error) {
      console.error("[FAIL] Review audit log failed:", error.message);
      process.exit(1);
    }
  }

  // 6. Backups: Get Backups List
  console.log("Testing GET /backups...");
  try {
    const res = await fetch(`${BACKEND_URL}/backups`, { headers: authHeaders });
    assert.strictEqual(res.status, 200, "Get backups list should return 200");
    const body = await res.json();
    assert.ok(Array.isArray(body.data), "Backups response should contain data array");
    console.log(`[PASS] Get backups successful. Found ${body.data.length} backups in database\n`);
  } catch (error) {
    console.error("[FAIL] GET /backups failed:", error.message);
    process.exit(1);
  }

  // 7. Backups: Create Database Backup
  console.log("Testing POST /backups (Create database backup)...");
  try {
    const res = await fetch(`${BACKEND_URL}/backups`, {
      method: "POST",
      headers: authHeaders
    });
    
    // Handled rate limiting or success
    if (res.status === 429) {
      console.log("[INFO] Backup creation rate-limited (normal test behavior on multiple attempts). Proceeding...\n");
    } else {
      assert.strictEqual(res.status, 201, "Create backup should return 201");
      const body = await res.json();
      assert.ok(body.data && body.data.id, "Create backup should return database record with ID");
      console.log(`[PASS] Backup successfully created. Code: ${body.data.backup_code}, Size: ${body.data.file_size_bytes} bytes\n`);
    }
  } catch (error) {
    console.error("[FAIL] Create backup failed:", error.message);
    process.exit(1);
  }

  console.log("=== ALL ADMIN ENDPOINT INTEGRATION TESTS PASSED ===\n");
}

runTests();
