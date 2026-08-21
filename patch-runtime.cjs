const fs = require('fs');
const path = '.netlify/functions/manifest.json';
const f = JSON.parse(fs.readFileSync(path, 'utf8'));
f.functions.forEach(fn => fn.runtimeVersion = 'nodejs20.x');
fs.writeFileSync(path, JSON.stringify(f));
console.log('Patched runtimeVersion to nodejs20.x');
