// Midnight Getaway — bootstrap, game loop and phase machine.
// Title → Act I The Vault → Act II Getaway → Won / Busted, with score,
// best score in localStorage, and the deterministic ?shot= scenes used for
// the entry's screenshots (the same code renders them as real play does).

import { VIEW, BEST_KEY, SCORE, GETAWAY_SECONDS } from './config.js';
import { SoundBank } from './audio.js';
import { Keyboard } from './input.js';
import { createVaultState, stepVault } from './vault.js';
import { createGetawayState, stepGetaway } from './getaway.js';
import { render } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const sounds = new SoundBank();
const keys = new Keyboard();
keys.onFirstGesture = () => sounds.unlock();

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private mode or no storage: the score still shows, it just is not kept.
  }
}

export function createGame() {
  const game = {
    phase: 'title', // title | vault | getaway | won | busted
    endedIn: 'vault',
    vault: null,
    getaway: null,
    loot: 0,
    alarm: 0,
    wanted: 1,
    smokeUses: 2,
    jammerUses: 1,
    timeLeft: GETAWAY_SECONDS,
    score: 0,
    timeBonus: 0,
    alarmPenalty: 0,
    winReason: '',
    bustReason: '',
    best: readBest(),
    newBest: false,
    frozen: false, // set by ?shot= scenes: render once, never advance
  };
  game.phaseLabel = () => {
    if (game.phase === 'title') return 'PRESS ENTER TO START';
    if (game.phase === 'vault') return 'PHASE I — THE VAULT';
    if (game.phase === 'getaway') return 'PHASE II — GETAWAY';
    if (game.phase === 'won') return 'WIN';
    return 'BUSTED';
  };
  return game;
}

const game = createGame();

function startRun() {
  game.vault = createVaultState();
  game.getaway = null;
  game.loot = 0;
  game.alarm = 0;
  game.wanted = 1;
  game.smokeUses = 2;
  game.jammerUses = 1;
  game.timeLeft = GETAWAY_SECONDS;
  game.score = 0;
  game.timeBonus = 0;
  game.alarmPenalty = 0;
  game.winReason = '';
  game.bustReason = '';
  game.newBest = false;
  game.phase = 'vault';
  sounds.stopSiren();
  sounds.stopEngine();
  sounds.click();
}

function finishRun(won, reason) {
  const timeLeft = game.getaway ? Math.max(0, Math.ceil(game.getaway.timeLeft)) : 0;
  game.timeBonus = won ? timeLeft * SCORE.timeBonusPerSecond : 0;
  game.alarmPenalty = Math.round(game.alarm * SCORE.alarmPenaltyPerPoint);
  game.score = Math.max(0, game.loot + game.timeBonus - game.alarmPenalty);
  game.newBest = game.score > game.best && game.score > 0;
  if (game.newBest) {
    game.best = game.score;
    saveBest(game.score);
  }
  if (won) {
    game.phase = 'won';
    game.winReason = reason;
    sounds.winJingle();
  } else {
    game.phase = 'busted';
    game.bustReason = reason;
    sounds.busted();
  }
  sounds.stopSiren();
  sounds.stopEngine();
}

function step(dt) {
  if (game.phase === 'vault') {
    const input = {
      move: keys.moveVector(),
      crack: keys.down('KeyE'),
      smoke: keys.wasPressed('KeyQ'),
      jammer: keys.wasPressed('KeyF'),
    };
    stepVault(game.vault, dt, input, sounds);
    game.loot = game.vault.loot;
    game.alarm = Math.round(game.vault.alarm);
    game.smokeUses = game.vault.smokeUses;
    game.jammerUses = game.vault.jammerUses;
    if (game.vault.busted) {
      game.endedIn = 'vault';
      finishRun(false, game.vault.bustReason);
      return;
    }
    if (game.vault.exited) {
      game.getaway = createGetawayState(game.vault.alarm, game.vault.loot);
      game.wanted = game.getaway.wanted;
      game.phase = 'getaway';
      sounds.startSiren();
      sounds.startEngine();
      return;
    }
  } else if (game.phase === 'getaway') {
    const input = { move: keys.moveVector() };
    stepGetaway(game.getaway, dt, input, sounds);
    game.alarm = Math.round(game.getaway.alarm);
    game.timeLeft = game.getaway.timeLeft;
    if (game.getaway.won) {
      game.endedIn = 'getaway';
      finishRun(true, game.getaway.winReason);
      return;
    }
    if (game.getaway.busted) {
      game.endedIn = 'getaway';
      finishRun(false, game.getaway.bustReason);
      return;
    }
  }
}

function handleGlobalKeys() {
  if (keys.wasPressed('KeyM')) {
    sounds.toggleMute();
  }
  if (keys.wasPressed('KeyR') && game.phase !== 'title') {
    startRun();
    return;
  }
  if (game.phase === 'title' && (keys.wasPressed('Enter') || keys.wasPressed('Space'))) {
    startRun();
    return;
  }
  if ((game.phase === 'won' || game.phase === 'busted') && keys.wasPressed('Enter')) {
    startRun();
  }
}

canvas.addEventListener('click', () => {
  sounds.unlock();
  if (game.phase === 'title') startRun();
  else if (game.phase === 'won' || game.phase === 'busted') startRun();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;
  if (!game.frozen) {
    handleGlobalKeys();
    if (game.phase === 'vault' || game.phase === 'getaway') step(dt);
    render(ctx, game);
    keys.endFrame();
  }
  requestAnimationFrame(frame);
}

// Deterministic screenshot scenes: ?shot=cover|stealth|getaway|end.
// The scene is built from the game's own state and rendered by the same
// renderer as live play, then frozen so the frame never changes.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const ok = applyShot(game, shotName, sounds);
  if (ok) {
    game.frozen = true;
    render(ctx, game);
    window.__mgShot = shotName;
  }
}

window.MG_DEBUG = {
  game,
  startRun,
  // Advance the simulation by a fixed number of 1/60 s steps, synchronously.
  // Headless Chrome on this machine presents canvas frames through software
  // GL at ~2 fps, so wall-clock waits cannot drive the game; this hook steps
  // the same step() the animation loop calls, reading the live key state,
  // and renders once at the end. It exists for the playtest, not for play.
  advance(seconds) {
    const steps = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < steps; i += 1) {
      handleGlobalKeys();
      if (game.phase === 'vault' || game.phase === 'getaway') step(1 / 60);
      keys.endFrame();
    }
    render(ctx, game);
    return true;
  },
  // Test hooks: teleport the thief / car and set the alarm, so the
  // playtest can reach every scenario without playing for minutes.
  teleportThief(x, y) {
    if (game.vault) {
      game.vault.thief.x = x;
      game.vault.thief.y = y;
    }
  },
  setAlarm(value) {
    if (game.vault) game.vault.alarm = value;
    game.alarm = value;
  },
  teleportCar(x, y) {
    if (game.getaway) {
      game.getaway.player.x = x;
      game.getaway.player.y = y;
      game.getaway.player.speed = 0;
    }
  },
  state() {
    return {
      phase: game.phase,
      loot: game.loot,
      alarm: game.alarm,
      wanted: game.wanted,
      timeLeft: game.timeLeft,
      score: game.score,
      thief: game.vault ? { x: game.vault.thief.x, y: game.vault.thief.y } : null,
      guards: game.vault ? game.vault.guards.map((g) => ({
        name: g.name, x: Math.round(g.x), y: Math.round(g.y),
        suspicion: Math.round(g.suspicion), chasing: g.chasing,
      })) : null,
      cameras: game.vault ? game.vault.cameras.map((c) => ({
        angle: +c.angle.toFixed(2), seesThief: c.seesThief,
      })) : null,
      crack: game.vault ? +game.vault.crackProgress.toFixed(2) : null,
      exitOpen: game.vault ? game.vault.exitOpen : null,
      police: game.getaway ? game.getaway.police.map((p) => ({
        x: Math.round(p.x), y: Math.round(p.y),
      })) : null,
      bust: game.getaway ? Math.round(game.getaway.bust) : null,
      hiddenFor: game.getaway ? +game.getaway.hiddenFor.toFixed(2) : null,
    };
  },
};

requestAnimationFrame(frame);
window.__mgReady = true;
