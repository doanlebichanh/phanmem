async function main() {
  const baseUrl = 'http://localhost:3000';

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  const loginText = await loginRes.text();
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${loginText}`);

  const token = JSON.parse(loginText)?.token;
  if (!token) throw new Error('No token returned');

  const vehiclePayload = {
    plate_number: `50H${Math.floor(10000 + Math.random() * 89999)}`,
    vehicle_type: 'Đầu kéo',
    brand: 'FAW',
    model: '700',
    year: 2019,
    status: 'available'
  };

  const createRes = await fetch(`${baseUrl}/api/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(vehiclePayload)
  });

  const createText = await createRes.text();
  console.log(`POST /api/vehicles -> ${createRes.status}`);
  console.log(createText);

  if (!createRes.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
