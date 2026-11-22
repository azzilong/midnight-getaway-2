// End-to-end playtest for Midnight Getaway, driven through Chrome DevTools.
// Plays the real game with real key events, and advances the simulation with
// the MG_DEBUG.advance hook (fixed 1/60 s steps of the same step functions
// the animation loop calls), because headless Chrome on this machine presents
// canvas frames through software GL at ~2 fps and wall-clock waits cannot
// drive the game. Teleports (also via MG_DEBUG) put the thief/car in each
// scenario directly, so a full run takes seconds instead of minutes.
// Exits non-zero if any check fails or the page reports an error.
//
// Usage: node tools/playtest.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { launchChrome, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const url = `file://${join(repo, 'game', 'index.html')}`;

const KEYS = {
  Enter: ['Enter', 'Enter', 13],
  KeyW: ['KeyW', 'w', 87],
  KeyA: ['KeyA', 'a', 65],
  KeyS: ['KeyS', 's', 83],
  KeyD: ['KeyD', 'd', 68],
  KeyE: ['KeyE', 'e', 69],
  KeyQ: ['KeyQ', 'q', 81],
  KeyF: ['KeyF', 'f', 70],
  KeyR: ['KeyR', 'r', 82],
};

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const session = await launchChrome(url, 9342);
try {
  await session.waitFor('window.__mgReady === true');
  await sleep(500);
  const state = () => session.evaluate('window.MG_DEBUG.state()');
  const advance = (seconds) => session.evaluate(`window.MG_DEBUG.advance(${seconds})`);
  // Park every guard far from the vault and calm them, so one mechanic can
  // be tested without another one interrupting it.
  const parkGuards = () => session.evaluate(`(() => {
    const spots = [{ x: 180, y: 400 }, { x: 200, y: 600 }, { x: 200, y: 200 }];
    window.MG_DEBUG.game.vault.guards.forEach((g, i) => {
      g.x = spots[i].x; g.y = spots[i].y;
      g.suspicion = 0; g.chasing = false; g.angle = 0;
    });
  })()`);

  // 1. Boot: title screen, no page errors.
  let s = await state();
  check('boot to title screen', s.phase === 'title', `phase=${s.phase}`);

  // 2. Start with Enter.
  await session.key(...KEYS.Enter);
  await advance(0.3);
  s = await state();
  check('Enter starts the vault', s.phase === 'vault', `phase=${s.phase}`);

  // 3. Move right with D.
  const x0 = s.thief.x;
  await session.keyDown(...KEYS.KeyD);
  await advance(0.6);
  await session.keyUp(...KEYS.KeyD);
  s = await state();
  check('thief moves right', s.thief.x > x0 + 80, `x ${x0} -> ${Math.round(s.thief.x)}`);

  // 4. Wall collision: shove the thief into the left outer wall.
  await session.evaluate('window.MG_DEBUG.teleportThief(70, 620)');
  await session.keyDown(...KEYS.KeyA);
  await advance(0.5);
  await session.keyUp(...KEYS.KeyA);
  s = await state();
  check('outer wall blocks movement', s.thief.x >= 60 && s.thief.x < 80, `x=${Math.round(s.thief.x)}`);

  // 5. Guard vision: stand in Marco's cone, close up, facing him.
  await session.evaluate(`(() => {
    const g = window.MG_DEBUG.game.vault.guards[0];
    g.x = 200; g.y = 400; g.angle = 0; g.waypointIndex = 1; g.suspicion = 0; g.chasing = false;
    window.MG_DEBUG.teleportThief(350, 400);
  })()`);
  await advance(0.5);
  s = await state();
  check('guard vision raises suspicion', s.guards[0].suspicion > 50,
    `MARCO suspicion=${s.guards[0].suspicion} chasing=${s.guards[0].chasing}`);
  await parkGuards();

  // 6. Smoke bomb: costs a use and raises the alarm.
  const alarmBefore = s.alarm;
  await session.key(...KEYS.KeyQ);
  await advance(0.3);
  s = await state();
  const smokeUses = await session.evaluate('window.MG_DEBUG.game.vault.smokeUses');
  check('smoke bomb fires and costs alarm',
    s.alarm >= alarmBefore + 7 && smokeUses === 1,
    `alarm ${alarmBefore} -> ${s.alarm}, uses left ${smokeUses}`);

  // 7. Jammer: costs a use and raises the alarm.
  const alarmBeforeJam = s.alarm;
  await session.key(...KEYS.KeyF);
  await advance(0.3);
  s = await state();
  const jammerUses = await session.evaluate('window.MG_DEBUG.game.vault.jammerUses');
  check('jammer fires and costs alarm',
    s.alarm >= alarmBeforeJam + 14 && jammerUses === 0,
    `alarm ${alarmBeforeJam} -> ${s.alarm}, uses left ${jammerUses}`);

  // 8. Crack the vault: hold E beside the safe until the loot lands.
  await session.evaluate('window.MG_DEBUG.teleportThief(1120, 240)');
  await session.keyDown(...KEYS.KeyE);
  await advance(3.0);
  await session.keyUp(...KEYS.KeyE);
  s = await state();
  check('crack vault to $50,000', s.loot === 50000 && s.exitOpen === true,
    `loot=${s.loot} exitOpen=${s.exitOpen}`);

  // 9. Exit to the getaway: wanted stars follow the alarm.
  await session.evaluate('window.MG_DEBUG.teleportThief(1185, 672)');
  await advance(0.3);
  s = await state();
  check('exit opens Act II getaway', s.phase === 'getaway' && s.wanted >= 1,
    `phase=${s.phase} wanted=${s.wanted} police=${s.police ? s.police.length : 0}`);
  check('police count matches wanted stars', s.police && s.police.length === s.wanted,
    `police=${s.police ? s.police.length : 0} wanted=${s.wanted}`);

  // 10. Driving: hold W, the car gains speed and moves.
  const carBefore = await session.evaluate('({ x: window.MG_DEBUG.game.getaway.player.x, y: window.MG_DEBUG.game.getaway.player.y })');
  await session.keyDown(...KEYS.KeyW);
  await advance(1.2);
  await session.keyUp(...KEYS.KeyW);
  const carAfter = await session.evaluate('({ x: window.MG_DEBUG.game.getaway.player.x, y: window.MG_DEBUG.game.getaway.player.y, speed: window.MG_DEBUG.game.getaway.player.speed })');
  check('car drives forward', Math.abs(carAfter.speed) > 50 && Math.hypot(carAfter.x - carBefore.x, carAfter.y - carBefore.y) > 60,
    `speed=${Math.round(carAfter.speed)} moved=${Math.round(Math.hypot(carAfter.x - carBefore.x, carAfter.y - carBefore.y))}`);

  // 11. Win via the safehouse.
  await session.evaluate('window.MG_DEBUG.teleportCar(1075, 175)');
  await advance(0.3);
  s = await state();
  check('safehouse wins the run', s.phase === 'won' && s.score > 0,
    `phase=${s.phase} score=${s.score}`);

  // 12. Restart with R.
  await session.key(...KEYS.KeyR);
  await advance(0.3);
  s = await state();
  check('R restarts to a fresh vault', s.phase === 'vault' && s.loot === 0, `phase=${s.phase} loot=${s.loot}`);

  // 13. Win via losing the tail: reach the getaway, keep the police far away.
  await parkGuards();
  await session.evaluate('window.MG_DEBUG.teleportThief(1120, 240)');
  await session.keyDown(...KEYS.KeyE);
  await advance(3.0);
  await session.keyUp(...KEYS.KeyE);
  await session.evaluate('window.MG_DEBUG.teleportThief(1185, 672)');
  await advance(0.3);
  s = await state();
  check('second getaway reached', s.phase === 'getaway', `phase=${s.phase}`);
  for (let i = 0; i < 6; i += 1) {
    await session.evaluate(`(() => {
      const g = window.MG_DEBUG.game.getaway;
      g.player.x = 200; g.player.y = 620; g.player.speed = 0;
      for (const p of g.police) { p.x = 1100; p.y = 150; p.speed = 0; }
    })()`);
    await advance(1.05);
  }
  s = await state();
  check('losing the tail for 5s wins', s.phase === 'won', `phase=${s.phase} hiddenFor=${s.hiddenFor}`);

  // 14. Caught by a guard means busted.
  await session.key(...KEYS.KeyR);
  await advance(0.3);
  await session.evaluate(`(() => {
    const g = window.MG_DEBUG.game.vault.guards[0];
    g.x = 200; g.y = 400; g.angle = 0; g.waypointIndex = 1; g.suspicion = 0; g.chasing = false;
    window.MG_DEBUG.teleportThief(230, 400);
  })()`);
  await advance(1.2);
  s = await state();
  check('guard touch busts the run', s.phase === 'busted', `phase=${s.phase}`);

  // 15. Restart after a bust works too.
  await session.key(...KEYS.KeyR);
  await advance(0.3);
  s = await state();
  check('R restarts after a bust', s.phase === 'vault', `phase=${s.phase}`);

  // 16. No page errors or console errors at any point.
  check('zero page errors', session.pageErrors.length === 0, session.pageErrors.join(' | '));
  check('zero console errors', session.consoleErrors.length === 0, session.consoleErrors.join(' | '));
} finally {
  await session.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log('FAILED:', failed.map((r) => r.name).join(', '));
  process.exit(1);
}
