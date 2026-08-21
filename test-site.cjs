const https = require('https');

function fetch(url, start, maxRedirects = 5) {
  return new Promise((resolve) => {
    https.get(url, {timeout: 30000}, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
          const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
          console.log(`  ${res.statusCode} -> ${loc}`);
          fetch(loc, start, maxRedirects - 1).then(resolve);
        } else {
          resolve({status: res.statusCode, time: Date.now()-start, length: d.length, body: d.substring(0, 300)});
        }
      });
    }).on('error', e => resolve({error: e.message, time: Date.now()-start}));
  });
}

async function main() {
  const start = Date.now();
  console.log('Testing https://daegoncharts-83e37bdf-main-sable.vercel.app/ ...');
  const r = await fetch('https://daegoncharts-83e37bdf-main-sable.vercel.app/', start);
  console.log('Status:', r.status, '| Time:', r.time, 'ms | Length:', r.length);
  if (r.body) console.log('Body:', r.body);
  if (r.error) console.log('Error:', r.error);
}
main();
