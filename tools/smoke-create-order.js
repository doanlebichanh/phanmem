const API_BASE = 'http://localhost:3000/api';
const CREDENTIALS = { username: 'admin', password: 'admin123' };

async function testCreateOrder() {
  try {
    // Login first
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDENTIALS)
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    console.log('✓ Logged in');

    // Get customers
    const customersRes = await fetch(`${API_BASE}/customers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const customers = await customersRes.json();
    console.log(`✓ Found ${customers.length} customers`);

    if (customers.length === 0) {
      console.log('✗ No customers to test with');
      return;
    }

    // Try to create an order
    const orderData = {
      customer_id: customers[0].id,
      order_date: '2026-01-08',
      pickup_location: 'Test Origin',
      delivery_location: 'Test Destination',
      cargo_description: 'Test Cargo',
      price: 10000000,
      status: 'pending'
    };

    console.log('→ Creating order:', JSON.stringify(orderData, null, 2));

    const orderRes = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const responseText = await orderRes.text();
    console.log(`← Response status: ${orderRes.status}`);
    console.log(`← Response body: ${responseText}`);

    if (orderRes.ok) {
      console.log('✓ Order created successfully');
    } else {
      console.log('✗ Order creation failed');
    }
  } catch (error) {
    console.error('✗ Test error:', error);
  }
}

testCreateOrder();
