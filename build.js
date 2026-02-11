const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const BUILD_DIR = 'dist';

// JS files to minify
const JS_FILES = ['code.js', 'firebase-sync.js', 'zzfx.js', 'sw.js'];

// Other files to copy as-is
const STATIC_FILES = [
  'index.html',
  'manifest.json',
  'privacy.html',
  'terms.html',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
  'sitemap.xml',
];

(async () => {
  // Clean and create build directory
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
  }
  fs.mkdirSync(BUILD_DIR);

  let copied = 0;

  // Copy static files as-is
  for (const file of STATIC_FILES) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(BUILD_DIR, file));
      const size = (fs.statSync(file).size / 1024).toFixed(1);
      console.log(`  ✓ ${file} (${size} KB)`);
      copied++;
    } else {
      console.warn(`  ⚠ Not found: ${file}`);
    }
  }

  // Minify JS files
  for (const file of JS_FILES) {
    if (fs.existsSync(file)) {
      const original = fs.readFileSync(file, 'utf8');
      const originalKB = (Buffer.byteLength(original) / 1024).toFixed(1);
      const isModule = file === 'firebase-sync.js' || file === 'zzfx.js';
      const result = await minify(original, {
        compress: { passes: 2 },
        mangle: true,
        module: isModule
      });
      fs.writeFileSync(path.join(BUILD_DIR, file), result.code);
      const minKB = (Buffer.byteLength(result.code) / 1024).toFixed(1);
      console.log(`  ✓ ${file} (${originalKB} KB → ${minKB} KB)`);
      copied++;
    } else {
      console.warn(`  ⚠ Not found: ${file}`);
    }
  }

  // Show total size
  const totalBytes = [...STATIC_FILES, ...JS_FILES].reduce((sum, file) => {
    const dest = path.join(BUILD_DIR, file);
    return sum + (fs.existsSync(dest) ? fs.statSync(dest).size : 0);
  }, 0);
  const totalKB = (totalBytes / 1024).toFixed(1);

  console.log(`\n✅ Build complete! ${copied} files → /${BUILD_DIR}/ (${totalKB} KB total)`);
})();
