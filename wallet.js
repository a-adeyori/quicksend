const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMDZhYjFmNi1jNTFkLTRmNzctOTMwZC02YjVhYmU5ODdhZTUiLCJlbWFpbCI6InlvcmlAdGVzdC5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc3NjEyOTE4MCwiZXhwIjoxNzc2MTMwMDgwfQ.ya7S-9PbUd5a3xIHcMAx7-pWaFiuziYeRWymJufujcc';

fetch('https://quicksend-production.up.railway.app/api/v1/wallet/create-address', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ACCESS_TOKEN}`
  },
  body: JSON.stringify({
    publicName: 'Adeyori Adekunle'
  })
}).then(r => {
  console.log('Status:', r.status);
  return r.json();
}).then(d => console.log(JSON.stringify(d, null, 2)));