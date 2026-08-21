const http = require('http');
const req = http.get('http://localhost:3000/', {timeout: 60000}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Length:', d.length);
    if (res.statusCode !== 200) console.log(d.substring(0, 500));
  });
});
req.on('error', e => console.log('Error:', e.message));
req.setTimeout(60000, () => { console.log('Timeout'); req.destroy(); });
