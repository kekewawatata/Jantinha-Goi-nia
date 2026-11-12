const https = require('https');

https.get('https://salmon-magpie-797971.hostingersite.com/adm/dashboard/', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HAS_30_DIAS:', body.includes('30 dias'));
    console.log('HAS_SEMANAL:', body.includes('semanal') || body.includes('Semanal'));
    console.log('CHUNKS:');
    const matches = body.match(/_next\/static\/chunks\/[a-zA-Z0-9_\-\.]+/g) || [];
    for (const m of new Set(matches)) {
      console.log('  ', m);
    }
  });
}).on('error', err => {
  console.error('ERROR:', err.message);
});
