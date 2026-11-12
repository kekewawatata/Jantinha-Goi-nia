const https = require('https');

https.get('https://salmon-magpie-797971.hostingersite.com/adm/dashboard.html', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('dashboard.html includes 30 dias:', body.includes('30 dias'));
    const m = body.match(/chunks\/[^"']+\.js/g);
    console.log('chunks in dashboard.html:', m);
    process.exit(0);
  });
});
