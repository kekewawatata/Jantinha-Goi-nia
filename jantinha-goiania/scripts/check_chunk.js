const https = require('https');

https.get('https://salmon-magpie-797971.hostingersite.com/_next/static/chunks/2md7t6w_qcrxk.js', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS CHUNK:', res.statusCode);
    console.log('LENGTH:', body.length);
    console.log('HAS_SEMANAL:', body.includes('semanal') || body.includes('Semanal'));
    console.log('HAS_ANUAL:', body.includes('anual') || body.includes('Anual'));
    console.log('HAS_30_DIAS:', body.includes('30 dias'));
  });
}).on('error', err => {
  console.error('ERROR:', err.message);
});
