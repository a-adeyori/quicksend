fetch('https://quicksend-production.up.railway.app/api/v1/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      email: 'yori@test.com',
      password: 'testpassword123',
      firstName: 'Adeyori',
      lastName: 'Adekunle'
    })
  }).then(r => {
    console.log('Status:', r.status);
    return r.json();
  }).then(d => console.log(JSON.stringify(d, null, 2)));