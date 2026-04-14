async function main() {
  const ts = Date.now();

  const reg1 = await fetch('https://quicksend-production.up.railway.app/api/v1/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      email: `s${ts}@test.com`,
      username: `s${ts}`,
      password: 'testpassword123',
      firstName: 'Sender',
      lastName: 'User'
    })
  }).then(r => r.json());
  console.log('Sender:', reg1.user?.username);

  const reg2 = await fetch('https://quicksend-production.up.railway.app/api/v1/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      email: `r${ts}@test.com`,
      username: `r${ts}`,
      password: 'testpassword123',
      firstName: 'Receiver',
      lastName: 'User'
    })
  }).then(r => r.json());
  console.log('Receiver:', reg2.user?.username);

  const deposit = await fetch('https://quicksend-production.up.railway.app/api/v1/wallet/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${reg1.accessToken}` },
    body: JSON.stringify({ amountDollars: 50 })
  }).then(r => r.json());
  console.log('Deposit:', deposit);

  // Search for receiver before sending
  const searchRes = await fetch(
    `https://quicksend-production.up.railway.app/api/v1/users/search?q=${reg2.user?.username}`,
    { headers: { 'Authorization': `Bearer ${reg1.accessToken}` } }
  ).then(r => r.json());
  console.log('Search for receiver:', JSON.stringify(searchRes, null, 2));

  const payRes = await fetch('https://quicksend-production.up.railway.app/api/v1/payments/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${reg1.accessToken}` },
    body: JSON.stringify({
      recipientUsername: reg2.user?.username,
      amountDollars: 10,
      note: 'Test payment'
    })
  });
  console.log('Payment status:', payRes.status);
  const payment = await payRes.json();
  console.log('Payment:', JSON.stringify(payment, null, 2));
}

main();