// Copies non-TS overlay assets (HTML, CSS) into dist/ next to the compiled JS,
// so Electron can load them with the same relative paths in dev and packaged builds.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'overlay');
const DST = path.join(__dirname, '..', 'dist', 'overlay');

fs.mkdirSync(DST, { recursive: true });
for (const file of fs.readdirSync(SRC)) {
  if (file.endsWith('.html') || file.endsWith('.css')) {
    fs.copyFileSync(path.join(SRC, file), path.join(DST, file));
  }
}
console.log('Copied overlay assets to', DST);
