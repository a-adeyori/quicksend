fetch('https://rafiki-backend-production-8629.up.railway.app/graphql', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      query: 'mutation { createAsset(input: { code: "USD", scale: 2 }) { asset { id code scale } } }'
    })
  }).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));