/**
 * Integration test for the POS Cloud Sync system
 * Tests the server endpoints, sync flow, and wiring without requiring PostgreSQL
 */

import http from 'node:http';

const BASE_URL = 'http://localhost:4000';
const SYNC_SECRET = 'test-secret-123';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

async function fetchJSON(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function testSyncEndpoint() {
  console.log('\n📡 Testing Sync Endpoint (POST /sync)');

  // Test without auth - should fail
  try {
    const res = await fetchJSON('/sync', {
      method: 'POST',
      body: { deviceId: 'test', tables: {} },
    });
    assert(res.status === 401, 'Rejects request without auth token');
  } catch (e) {
    assert(false, `Server not reachable: ${e.message}`);
    return false;
  }

  // Test with wrong secret - should fail
  try {
    const res = await fetchJSON('/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
      body: { deviceId: 'test', tables: {} },
    });
    assert(res.status === 401, 'Rejects request with wrong secret');
  } catch (e) {
    assert(false, `Error: ${e.message}`);
  }

  // Test with correct auth - should succeed (even with empty batch)
  try {
    const res = await fetchJSON('/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SYNC_SECRET}` },
      body: {
        deviceId: 'test-device-001',
        lastSyncAt: null,
        tables: {
          sales: [],
          returns: [],
          treasury_operations: [],
          user_shifts: [],
          products: [],
          categories: [],
          suppliers: [],
          customers: [],
        },
      },
    });
    assert(res.status === 200, 'Accepts valid sync request with auth');
    assert(res.data.success === true, 'Returns success: true');
    assert(typeof res.data.syncedAt === 'string', 'Returns syncedAt timestamp');
  } catch (e) {
    assert(false, `Error: ${e.message}`);
  }

  // Test with sample data
  try {
    const res = await fetchJSON('/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SYNC_SECRET}` },
      body: {
        deviceId: 'test-device-001',
        lastSyncAt: null,
        tables: {
          sales: [
            {
              id: 'test-sale-001',
              date: '2026-05-12T10:00:00.000Z',
              total: 150.0,
              discount: 0,
              tax: 0,
              net_total: 150.0,
              paid: 150.0,
              change: 0,
              payment_method: 'cash',
              status: 'completed',
              customer_name: null,
              customer_phone: null,
              user_id: 1,
              user_name: 'Test User',
              notes: null,
              items: [
                {
                  id: 'item-001',
                  sale_id: 'test-sale-001',
                  product_id: 1,
                  product_name: 'Test Product',
                  quantity: 2,
                  price: 75.0,
                  total: 150.0,
                },
              ],
            },
          ],
          returns: [],
          treasury_operations: [],
          user_shifts: [],
          products: [
            {
              id: 1,
              name: 'Test Product',
              barcode: '1234567890',
              price: 75.0,
              cost: 50.0,
              quantity: 100,
              category_name: 'Test Category',
              supplier_name: null,
              is_active: true,
            },
          ],
          categories: [
            { id: 1, name: 'Test Category', description: null, is_active: true },
          ],
          suppliers: [],
          customers: [],
        },
      },
    });
    assert(res.status === 200, 'Accepts sync with sample data');
    assert(res.data.counts.sales > 0, 'Reports synced sales count');
    assert(res.data.counts.products > 0, 'Reports synced products count');
    console.log('    📊 Sync counts:', JSON.stringify(res.data.counts));
  } catch (e) {
    assert(false, `Error: ${e.message}`);
  }

  return true;
}

async function testSyncStatus() {
  console.log('\n📋 Testing Sync Status (GET /sync/status)');

  try {
    const res = await fetchJSON('/sync/status?deviceId=test-device-001', {
      headers: { Authorization: `Bearer ${SYNC_SECRET}` },
    });
    assert(res.status === 200, 'Returns sync status');
    assert(res.data.deviceId === 'test-device-001', 'Returns correct deviceId');
    assert(typeof res.data.lastSyncAt === 'string', 'Returns lastSyncAt');
  } catch (e) {
    assert(false, `Error: ${e.message}`);
  }
}

async function testApiEndpoints() {
  console.log('\n🌐 Testing API Endpoints (GET /api/*)');

  const endpoints = [
    { path: '/api/sales', name: 'Sales list' },
    { path: '/api/returns', name: 'Returns list' },
    { path: '/api/treasury/summary', name: 'Treasury summary' },
    { path: '/api/shifts', name: 'Shifts list' },
    { path: '/api/inventory/summary', name: 'Inventory summary' },
    { path: '/api/customers', name: 'Customers list' },
    { path: '/api/reports/summary', name: 'Reports summary' },
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetchJSON(endpoint.path);
      assert(res.status === 200, `${endpoint.name} (${endpoint.path}) returns 200`);
    } catch (e) {
      assert(false, `${endpoint.name}: ${e.message}`);
    }
  }

  // Verify sales data was stored
  try {
    const res = await fetchJSON('/api/sales');
    assert(Array.isArray(res.data), 'Sales returns an array');
    if (res.data.length > 0) {
      const sale = res.data[0];
      assert(sale.total === 150, 'Stored sale has correct total');
      assert(sale.items && sale.items.length > 0, 'Stored sale has items');
    }
  } catch (e) {
    assert(false, `Error: ${e.message}`);
  }

  // Verify inventory data
  try {
    const res = await fetchJSON('/api/inventory/summary');
    assert(typeof res.data === 'object', 'Inventory summary returns object');
    if (res.data.products) {
      assert(res.data.products > 0, 'Reports product count');
    }
  } catch (e) {
    assert(false, `Error: ${e.message}`);
  }
}

async function testCors() {
  console.log('\n🔒 Testing CORS Configuration');

  try {
    const url = new URL('/api/sales', BASE_URL);
    const req = http.request(url, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    }, (res) => {
      const corsHeader = res.headers['access-control-allow-origin'];
      assert(corsHeader, 'CORS header present on OPTIONS request');
    });
    req.end();
  } catch (e) {
    assert(false, `Error: ${e.message}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  POS Cloud Sync — Integration Tests');
  console.log('═══════════════════════════════════════════════════');

  const serverReachable = await testSyncEndpoint();
  if (serverReachable) {
    await testSyncStatus();
    await testApiEndpoints();
    await testCors();
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});