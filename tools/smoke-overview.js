async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  const baseUrl = 'http://localhost:3000';

  const login = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  if (login.status !== 200) {
    throw new Error(`Login failed: ${login.status} ${login.text}`);
  }

  const token = JSON.parse(login.text)?.token;
  if (!token) throw new Error('No token returned');

  const headers = { Authorization: `Bearer ${token}` };

  const endpoints = [
    '/api/reports/overview',
    '/api/orders',
    '/api/customers',
    '/api/vehicles',
    '/api/drivers',
    '/api/alerts/vehicle-expiry'
  ];

  for (const ep of endpoints) {
    const r = await fetchJson(`${baseUrl}${ep}`, { headers });
    console.log(`${ep} -> ${r.status}`);
    console.log(r.text.slice(0, 500));
    console.log('---');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
