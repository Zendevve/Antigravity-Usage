import * as fs from 'fs';
import * as path from 'path';

const DIST_DIR = path.resolve(__dirname, '../dist');
const TARGET_FILE = path.join(DIST_DIR, 'extension.js');
// Strict 1MB limit for the MVP bundle since it is mostly a telemetry streamer.
// Zod + RxJS alone unbundled is quite large.
const MAX_BUNDLE_SIZE_BYTES = 1024 * 1024;

function checkBundleSize() {
  if (!fs.existsSync(TARGET_FILE)) {
    console.error(`Error: Bundle file not found at ${TARGET_FILE}. Run build first.`);
    process.exit(1);
  }

  const stats = fs.statSync(TARGET_FILE);
  const sizeInMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`Bundle Size: ${sizeInMb} MB (${stats.size} bytes)`);

  if (stats.size > MAX_BUNDLE_SIZE_BYTES) {
    console.error(`❌ Bundle size exceeds maximum limit of 1.0 MB.`);
    process.exit(1);
  } else {
    console.log(`✅ Bundle size is within the acceptable limit.`);
    process.exit(0);
  }
}

checkBundleSize();
