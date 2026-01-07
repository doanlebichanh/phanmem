async function main() {
  const baseUrl = 'http://localhost:3000';

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed: ${loginRes.status} ${text}`);
  }

  const loginJson = await loginRes.json();
  const token = loginJson?.token;
  if (!token) throw new Error('Login succeeded but no token returned');

  const ordersRes = await fetch(`${baseUrl}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const ordersText = await ordersRes.text();
  console.log(`GET /api/orders -> ${ordersRes.status}`);
  console.log(ordersText);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
