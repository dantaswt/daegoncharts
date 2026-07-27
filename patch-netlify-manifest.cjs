const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '.netlify', 'functions', 'manifest.json');

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (manifest.functions) {
    manifest.functions.forEach(fn => {
      if (fn.runtimeVersion && fn.runtimeVersion.includes('24')) {
        fn.runtimeVersion = fn.runtimeVersion.replace(/nodejs\d+/, 'nodejs20');
        console.log(`Patched runtimeVersion to: ${fn.runtimeVersion}`);
      }
    });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log('Manifest patched successfully.');
} else {
  console.log('Manifest not found, skipping patch.');
}
