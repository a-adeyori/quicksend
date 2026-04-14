// test.js — DO NOT COMMIT
async function main() {
  // Step 1: Register
  const regRes = await fetch('https://quicksend-production.up.railway.app/api/v1/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      email: 'test' + Date.now() + '@test.com',
      password: 'testpassword123',
      firstName: 'Yori',
      lastName: 'Adeyori'
    })
  });
  const reg = await regRes.json();
  console.log('Register status:', regRes.status);
  console.log('User:', reg.user);

  const token = reg.accessToken;

  // Step 2: Create wallet
  const walletRes = await fetch('https://quicksend-production.up.railway.app/api/v1/wallet/create-address', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ publicName: 'Yori Adeyori' })
  });
  const wallet = await walletRes.json();
  console.log('Wallet status:', walletRes.status);
  console.log('Wallet:', wallet);
}

main();