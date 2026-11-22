// Midnight Getaway — deterministic screenshot scenes (?shot=...).
// Each scene builds a real game state from the same constructors live play
// uses, places every actor at a chosen spot a real game can reach, and lets
// the normal renderer draw exactly one frame of it. Nothing here is a mock:
// the frame is the game's own render of a reachable state.

import { createVaultState } from './vault.js';
import { createGetawayState } from './getaway.js';

function placeGuard(state, name, x, y, angle, suspicion, chasing = false) {
  const guard = state.guards.find((g) => g.name === name);
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.suspicion = suspicion;
  guard.chasing = chasing;
}

function placeCamera(state, index, angle) {
  const camera = state.cameras[index];
  camera.angle = angle;
  camera.phase = 0;
}

// The cover: the whole vault room in one frame — thief mid-crossing, Marco
// onto him, every guard cone and camera cone visible, the gold safe and the
// alarm meter all in shot.
function coverScene(game) {
  const vault = createVaultState();
  vault.thief.x = 385;
  vault.thief.y = 475;
  vault.thief.angle = Math.PI / 2;
  vault.alarm = 47;
  placeGuard(vault, 'MARCO', 455, 395, Math.atan2(475 - 395, 385 - 455), 82);
  placeGuard(vault, 'ROSA', 880, 480, Math.PI / 2, 12);
  placeGuard(vault, 'VINCE', 1010, 300, Math.atan2(150 - 300, 1150 - 1010), 0);
  placeCamera(vault, 0, 1.05);
  placeCamera(vault, 1, 2.25);
  game.vault = vault;
  game.getaway = null;
  game.loot = 0;
  game.alarm = 47;
  game.wanted = 1;
  game.smokeUses = 2;
  game.jammerUses = 1;
  game.phase = 'vault';
}

// Stealth: the thief tucked behind teal cover, cones sweeping past him,
// alarm low — the quiet half of the heist.
function stealthScene(game) {
  const vault = createVaultState();
  vault.thief.x = 215;
  vault.thief.y = 348;
  vault.thief.angle = Math.PI;
  vault.alarm = 10;
  placeGuard(vault, 'MARCO', 300, 400, 0, 0);
  placeGuard(vault, 'ROSA', 1010, 560, Math.PI / 2, 0);
  placeGuard(vault, 'VINCE', 950, 230, Math.PI, 5);
  placeCamera(vault, 0, 0.6);
  placeCamera(vault, 1, 1.5);
  game.vault = vault;
  game.getaway = null;
  game.loot = 0;
  game.alarm = 10;
  game.wanted = 1;
  game.smokeUses = 2;
  game.jammerUses = 1;
  game.phase = 'vault';
}

// Getaway: the gold car mid-chase, three police cars closing in, the green
// safehouse waiting top right, 62 seconds on the clock.
function getawayScene(game) {
  const getaway = createGetawayState(55, 50000);
  getaway.player.x = 640;
  getaway.player.y = 360;
  getaway.player.angle = -Math.PI / 2;
  getaway.player.speed = 150;
  getaway.timeLeft = 62;
  getaway.elapsed = 28;
  const spots = [
    { x: 520, y: 510, angle: -Math.PI / 2 },
    { x: 760, y: 360, angle: Math.PI },
    { x: 640, y: 520, angle: -Math.PI / 2 },
  ];
  getaway.police.forEach((car, i) => {
    car.x = spots[i].x;
    car.y = spots[i].y;
    car.angle = spots[i].angle;
    car.speed = 300;
  });
  game.vault = null;
  game.getaway = getaway;
  game.loot = 50000;
  game.alarm = 55;
  game.wanted = 3;
  game.smokeUses = 2;
  game.jammerUses = 1;
  game.timeLeft = 62;
  game.phase = 'getaway';
}

// End: the win screen over the city, car parked in the safehouse, score
// breakdown showing loot, time bonus and alarm penalty.
function endScene(game) {
  const getaway = createGetawayState(55, 50000);
  getaway.player.x = 1075;
  getaway.player.y = 212;
  getaway.player.angle = 0;
  getaway.player.speed = 0;
  getaway.timeLeft = 51;
  getaway.elapsed = 39;
  game.vault = null;
  game.getaway = getaway;
  game.loot = 50000;
  game.alarm = 55;
  game.wanted = 3;
  game.smokeUses = 2;
  game.jammerUses = 1;
  game.timeLeft = 51;
  game.timeBonus = 5100;
  game.alarmPenalty = 2000;
  game.score = 53100;
  game.winReason = 'Safehouse reached';
  game.newBest = true;
  game.endedIn = 'getaway';
  game.phase = 'won';
}

const SCENES = { cover: coverScene, stealth: stealthScene, getaway: getawayScene, end: endScene };

export function applyShot(game, name, sounds) {
  const scene = SCENES[name];
  if (!scene) return false;
  scene(game);
  if (sounds) {
    sounds.stopSiren();
    sounds.stopEngine();
  }
  return true;
}
