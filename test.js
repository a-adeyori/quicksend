async function main() {
  // Register User 1
  const reg1 = await fetch('https://quicksend-production.up.railway.app/api/v1/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ email: `sender${Date.now()}@test.com`, password: 'testpassword123', firstName: 'Sender', lastName: 'User' })
  }).then(r => r.json());
  console.log('Sender wallet:', reg1.user.walletAddress);

  // Register User 2
  const reg2 = await fetch('https://quicksend-production.up.railway.app/api/v1/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ email: `receiver${Date.now()}@test.com`, password: 'testpassword123', firstName: 'Receiver', lastName: 'User' })
  }).then(r => r.json());
  console.log('Receiver wallet:', reg2.user.walletAddress);

  // Deposit funds to sender
  const deposit = await fetch('https://quicksend-production.up.railway.app/api/v1/wallet/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${reg1.accessToken}` },
    body: JSON.stringify({ amountDollars: 50 })
  }).then(r => r.json());
  console.log('Deposit:', deposit);

  // Send payment
  const payment = await fetch('https://quicksend-production.up.railway.app/api/v1/payments/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${reg1.accessToken}` },
    body: JSON.stringify({
      toWalletAddress: reg2.user.walletAddress,
      amountDollars: 10,
      note: 'Test payment'
    })
  }).then(r => r.json());
  console.log('Payment:', JSON.stringify(payment, null, 2));
}

main();