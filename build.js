// LENTANDO - Progress At Your Pace
// Copyright (c) 2026 Frank Force

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const BUILD_DIR = 'dist';

const JS_FILES = ['code.js', 'firebase-sync.js', 'zzfx.js', 'sw.js'];

const STATIC_FILES = [
  'index.html',
  'manifest.json',
  'privacy.html',
  'terms.html',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
  'social.jpg',
];

function bumpCacheVersion() {
  console.log('🔼 Bumping service worker cache version...\n');
  
  const swPath = 'sw.js';
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Match pattern like: const CACHE_NAME = 'lentando-v213';
  const versionMatch = swContent.match(/const CACHE_NAME = 'lentando-v(\d+)';/);
  
  if (!versionMatch) {
    console.error('  ❌ ERROR: Could not find cache version in sw.js!');
    process.exit(1);
  }
  
  const oldVersion = parseInt(versionMatch[1], 10);
  const newVersion = oldVersion + 1;
  
  swContent = swContent.replace(
    /const CACHE_NAME = 'lentando-v\d+';/,
    `const CACHE_NAME = 'lentando-v${newVersion}';`
  );
  
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`  ✓ Cache version: v${oldVersion} → v${newVersion}\n`);
}

function preBuildChecks() {
  console.log('🔍 Running pre-build checks...\n');
  
  let hasErrors = false;
  
  // Check 1: Verify debugMode is false
  const codeContent = fs.readFileSync('code.js', 'utf8');
  if (codeContent.match(/const debugMode = true/)) {
    console.error('  ❌ ERROR: debugMode is enabled in code.js!');
    hasErrors = true;
  } else {
    console.log('  ✓ debugMode is disabled in code.js');
  }
  
  // Check 2: Verify SW_DEBUG is false
  const swContent = fs.readFileSync('sw.js', 'utf8');
  if (swContent.match(/const SW_DEBUG = true/)) {
    console.error('  ❌ ERROR: SW_DEBUG is enabled in sw.js!');
    hasErrors = true;
  } else {
    console.log('  ✓ SW_DEBUG is disabled in sw.js');
  }
  
  // Check 3: Verify all required files exist
  const allFiles = [...JS_FILES, ...STATIC_FILES];
  const missingFiles = allFiles.filter(file => !fs.existsSync(file));
  if (missingFiles.length > 0) {
    console.error('  ❌ ERROR: Missing files:', missingFiles.join(', '));
    hasErrors = true;
  } else {
    console.log('  ✓ All required files present');
  }
  
  console.log('');
  
  if (hasErrors) {
    console.error('❌ Pre-build checks failed! Fix errors above before building.\n');
    process.exit(1);
  }
  
  console.log('✅ Pre-build checks passed!\n');
}

(async () => {
  bumpCacheVersion();
  preBuildChecks();
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
  }
  fs.mkdirSync(BUILD_DIR);

  let copied = 0;

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

  const totalBytes = [...STATIC_FILES, ...JS_FILES].reduce((sum, file) => {
    const dest = path.join(BUILD_DIR, file);
    return sum + (fs.existsSync(dest) ? fs.statSync(dest).size : 0);
  }, 0);
  const totalKB = (totalBytes / 1024).toFixed(1);

  console.log(`\n✅ Build complete! ${copied} files → /${BUILD_DIR}/ (${totalKB} KB total)`);
})();
