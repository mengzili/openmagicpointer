// Copies non-TS renderer assets (HTML, CSS) into dist/ next to the compiled
// JS, so Electron can load them with the same relative paths in dev and
// packaged builds.
const fs = require('fs');
const path = require('path');

const ROOT_SRC = path.join(__dirname, '..', 'src');
const ROOT_DST = path.join(__dirname, '..', 'dist');

for (const dir of ['overlay', 'setup']) {
  const src = path.join(ROOT_SRC, dir);
  const dst = path.join(ROOT_DST, dir);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(dst, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    if (file.endsWith('.html') || file.endsWith('.css')) {
      fs.copyFileSync(path.join(src, file), path.join(dst, file));
    }
  }
  console.log('Copied', dir, 'assets to', dst);
}
