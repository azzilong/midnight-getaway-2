// Shared Chrome DevTools helper for Midnight Getaway's dev tools.
// Launches the local Chromium headless with the Hatch WebGL policy flags,
// attaches to the page over CDP with Node's built-in WebSocket, and offers
// small helpers: evaluate JS, press keys, screenshot, collect page errors.

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const CHROME = '/opt/meta-chromium/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function webglAllowFile() {
  // The Hatch WebGL policy needs an allow-list file whose first line is the
  // magic string; ~/workspace/makefun/webgl-domains.txt carries it.
  const allowFile = '/tmp/hatch-webgl-allowed-domains.txt';
  if (!existsSync(allowFile)) {
    const source = '/home/hatch/workspace/makefun/webgl-domains.txt';
    const text = existsSync(source) ? readFileSync(source, 'utf8') : 'hatch-webgl-all-origins-v1\n';
    writeFileSync(allowFile, text);
  }
  return allowFile;
}

export async function launchChrome(url, port) {
  const allowFile = webglAllowFile();
  const sha = createHash('sha256').update(readFileSync(allowFile)).digest('hex');
  const userDataDir = `/tmp/chrome-mg-${port}-${Date.now()}`;
  mkdirSync(userDataDir, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage', '--disable-features=LocalNetworkAccessChecks',
    '--allow-file-access-from-files',
    `--user-data-dir=${userDataDir}`,
    `--hatch-webgl-allowed-domains-file=${allowFile}`,
    `--hatch-webgl-allowed-domains-sha256=${sha}`,
    `--remote-debugging-port=${port}`,
    '--window-size=1280,720',
    '--mute-audio',
    url,
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  if (!wsUrl) {
    chrome.kill();
    throw new Error('chrome devtools did not come up');
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  const pageErrors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(msg.params.exceptionDetails?.exception?.description || JSON.stringify(msg.params.exceptionDetails));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, (msg) => (msg.error ? rej(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : res(msg.result)));
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });

  return {
    chrome,
    consoleErrors,
    pageErrors,
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) {
        throw new Error(`evaluate failed: ${JSON.stringify(result.exceptionDetails)}`);
      }
      return result.result.value;
    },
    async key(code, key, vk, holdMs = 80) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk });
      if (holdMs > 0) await sleep(holdMs);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk });
    },
    async keyDown(code, key, vk) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk });
    },
    async keyUp(code, key, vk) {
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk });
    },
    async waitFor(expression, timeoutMs = 15000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try {
          if (await this.evaluate(expression)) return true;
        } catch {
          // Page still loading.
        }
        await sleep(200);
      }
      throw new Error(`timed out waiting for: ${expression}`);
    },
    async screenshot(path, quality = 82) {
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality });
      writeFileSync(path, Buffer.from(shot.data, 'base64'));
    },
    async close() {
      try { ws.close(); } catch { /* already closed */ }
      chrome.kill();
      await sleep(300);
    },
  };
}

export { sleep };
