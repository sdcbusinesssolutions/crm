// Test script to verify bulk endpoint
// Run with: node test-bulk-endpoint.js

const testBulkEndpoint = async () => {
    console.log('🧪 Testing bulk endpoint...\n');

    // Test 1: Check if server is running
    console.log('Test 1: Checking if server is running...');
    try {
        const res1 = await fetch('http://localhost:5000/api');
        const data1 = await res1.json();
        console.log('✅ Server is running:', data1.message);
    } catch (err) {
        console.log('❌ Server is NOT running!');
        console.log('   Please start the server: cd server && npm start');
        return;
    }

    // Test 2: Check if bulk-test endpoint is accessible
    console.log('\nTest 2: Checking bulk-test endpoint...');
    try {
        const res2 = await fetch('http://localhost:5000/api/contacts/bulk-test');
        if (res2.status === 401) {
            console.log('✅ Endpoint exists (401 means auth required - this is correct)');
        } else {
            const data2 = await res2.json();
            console.log('✅ Endpoint accessible:', data2);
        }
    } catch (err) {
        console.log('❌ Bulk-test endpoint failed:', err.message);
    }

    // Test 3: Try bulk endpoint without auth (should get 401)
    console.log('\nTest 3: Testing bulk endpoint (should require auth)...');
    try {
        const res3 = await fetch('http://localhost:5000/api/contacts/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ name: 'Test', phone: '123' }])
        });

        if (res3.status === 401) {
            console.log('✅ Bulk endpoint exists and requires authentication (correct!)');
        } else if (res3.status === 404) {
            console.log('❌ Bulk endpoint NOT FOUND (404)');
            console.log('   This is the problem! Route is not registered.');
        } else {
            console.log('⚠️  Unexpected status:', res3.status);
        }
    } catch (err) {
        console.log('❌ Bulk endpoint test failed:', err.message);
    }

    console.log('\n📊 Test complete!');
    console.log('\nNext steps:');
    console.log('1. If all tests passed → Issue is with authentication');
    console.log('2. If bulk endpoint is 404 → Restart server and try again');
    console.log('3. If server not running → Start it with: cd server && npm start');
};

testBulkEndpoint();
