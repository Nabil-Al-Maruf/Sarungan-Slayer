const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const jwt = process.argv[2];
  if (!jwt) {
    console.error('Usage: node deploy-pages.cjs <jwt>');
    process.exit(1);
  }

  function getMime(p) {
    if (p.endsWith('.html')) return 'text/html';
    if (p.endsWith('.js')) return 'application/javascript';
    if (p.endsWith('.css')) return 'text/css';
    if (p.endsWith('.json')) return 'application/json';
    return 'application/octet-stream';
  }

  function walk(dir, base = '') {
    let res = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const rel = path.join(base, ent.name).replace(/\\/g, '/');
      if (ent.isDirectory()) {
        res.push(...walk(full, rel));
      } else {
        res.push({ path: '/' + rel, file: full, mime: getMime(ent.name) });
      }
    }
    return res;
  }

  const files = walk('dist');

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
