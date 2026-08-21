const https = require('https');
const TOKEN = 'nfp_j2PmJyDKLoTkyuGfhSDtfBYTP48T4r5h6a7c';
const SITE_ID = '29a4b923-94c5-4805-b20c-f930d0818548';

function api(path) {
  return new Promise((resolve, reject) => {
    https.get({hostname:'api.netlify.com', path, headers:{'Authorization':'Bearer '+TOKEN}}, res=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    }).on('error',reject);
  });
}

async function main() {
  // Get latest deploy details
  const deploys = await api('/api/v1/sites/'+SITE_ID+'/deploys?per_page=1');
  const deploy = deploys[0];
  console.log('Deploy:', deploy.id, 'State:', deploy.state);
  console.log('URL:', deploy.ssl_url);
  
  if (deploy.available_functions) {
    deploy.available_functions.forEach(f => {
      console.log('Function:', f.n, 'Runtime:', f.r, 'State:', f.state, 'Size:', f.query_string_parameters);
    });
  }
  
  // Check function by making a request to the function path
  const testUrl = 'https://daegoncharts.netlify.app/.netlify/functions/server';
  console.log('\nTesting function at:', testUrl);
  const fnTest = await new Promise((resolve) => {
    https.get(testUrl, {timeout: 15000}, res => {
      let d = ''; res.on('data', c => d += c); 
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: d.substring(0, 500)}));
    }).on('error', e => resolve({error: e.message}));
  });
  console.log('Function test:', JSON.stringify(fnTest, null, 2));
}

main().catch(console.error);
