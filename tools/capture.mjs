// Capture one deterministic screenshot scene of Midnight Getaway.
// Usage: node tools/capture.mjs <cover|stealth|getaway|end> <out.jpg>
// Renders game/index.html?shot=<scene> over file:// (localhost HTTP is
// blocked by the local Chrome policy) and saves a 1280x720 JPEG.

import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { launchChrome, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const [scene, out] = process.argv.slice(2);
const SCENES = ['cover', 'stealth', 'getaway', 'end'];
if (!SCENES.includes(scene) || !out) {
  console.error('usage: node tools/capture.mjs <cover|stealth|getaway|end> <out.jpg>');
  process.exit(2);
}

const url = `file://${join(repo, 'game', 'index.html')}?shot=${scene}`;
const session = await launchChrome(url, 9341);
try {
  await session.waitFor(`window.__mgShot === '${scene}'`);
  await sleep(900); // let the frozen frame settle
  if (session.pageErrors.length > 0) {
    console.error('PAGE ERRORS:', session.pageErrors.join('\n'));
    process.exitCode = 1;
  }
  await session.screenshot(out, 82);
  const size = statSync(out).size;
  console.log(`${scene} -> ${out} (${size} bytes${size > 262144 ? ' — OVER 256 KiB!' : ''})`);
  if (size > 262144) process.exitCode = 1;
} finally {
  await session.close();
}
