const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const jwt = process.argv[2];
  if (!jwt) {
    console.error('Usage: node deploy-pages.cjs <jwt>');
    process.exit(1);
  }

  const files = [
    { path: '/index.html', file: 'dist/index.html', mime: 'text/html' },
    { path: '/assets/index-C9Dv7p-K.js', file: 'dist/assets/index-C9Dv7p-K.js', mime: 'application/javascript' },
    { path: '/assets/index-DNNsTEIG.css', file: 'dist/assets/index-DNNsTEIG.css', mime: 'text/css' }
  ];

  const manifest = {};
  const uploadPayload = [];
  const allHashes = [];

  for (const item of files) {
    const content = fs.readFileSync(item.file);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    manifest[item.path] = hash;
    allHashes.push(hash);
    uploadPayload.push({
      key: hash,
      value: content.toString('base64'),
      metadata: { contentType: item.mime },
      base64: true
    });
  }

  console.log('Manifest:', manifest);

  // 1. Check missing
  console.log('Checking missing assets...');
  const checkRes = await fetch('https://api.cloudflare.com/client/v4/pages/assets/check-missing', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwt,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ hashes: allHashes })
  });
  const checkJson = await checkRes.json();
  console.log('Check missing result:', checkJson);

  const missing = checkJson.result || [];
  if (missing.length > 0) {
    console.log(`Uploading ${missing.length} missing assets...`);
    const toUpload = uploadPayload.filter(item => missing.includes(item.key));
    const uploadRes = await fetch('https://api.cloudflare.com/client/v4/pages/assets/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + jwt,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toUpload)
    });
    const uploadJson = await uploadRes.json();
    console.log('Upload result:', uploadJson);
  } else {
    console.log('All assets already exist in store.');
  }

  // 2. Upsert hashes
  console.log('Upserting hashes...');
  const upsertRes = await fetch('https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwt,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ hashes: allHashes })
  });
  console.log('Upsert result:', await upsertRes.json());
  console.log('READY_FOR_DEPLOYMENT', JSON.stringify(manifest));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
