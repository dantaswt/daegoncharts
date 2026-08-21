const https = require('https');

const TOKEN = 'nfp_j2PmJyDKLoTkyuGfhSDtfBYTP48T4r5h6a7c';
const SITE_ID = '29a4b923-94c5-4805-b20c-f930d0818548';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.netlify.com',
      path: `/api/v1${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(text)); } catch { resolve(text); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Update site build settings
  const site = await api('PATCH', `/sites/${SITE_ID}`, {
    build_settings: {
      command: 'npx vite build',
      publish: 'dist',
      environment: {
        NODE_VERSION: '20'
      }
    }
  });
  console.log('Build command:', site.build_settings?.command);
  console.log('Publish dir:', site.build_settings?.dir);
  console.log('NODE_VERSION:', site.build_settings?.environment?.NODE_VERSION);
  console.log('Repo:', JSON.stringify(site.repo));

  // Get latest deploy
  const deploys = await api('GET', `/sites/${SITE_ID}/deploys?per_page=1`);
  const fn = deploys[0].available_functions?.[0];
  if (fn) {
    console.log('\nCurrent function runtime:', fn.r);
  }
}

main().catch(console.error);
