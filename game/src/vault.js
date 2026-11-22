// Midnight Getaway — Act I, The Vault.
// The thief crosses the vault room: patrols with vision cones, sweeping
// cameras, a safe to crack and an exit that only opens once the loot is taken.

import {
  VAULT_WALLS, COVER_BLOCKS, VAULT, EXIT_DOOR, THIEF_START, THIEF_RADIUS,
  THIEF_SPEED, GUARD_DEFS, GUARD_RADIUS, GUARD_CHASE_SPEED, SUSPICION_RISE,
  SUSPICION_FALL, CHASE_UNTIL, CAMERA_DEFS, CAMERA_HALF_ANGLE,
  CAMERA_ALARM_RATE, CHASE_ALARM_RATE, TOOLS, ROOM,
} from './config.js';
import {
  clamp, angleDifference, pushCircleOutOfRect, segmentBlockedByRects,
  segmentHitsCircle,
} from './geometry.js';

export function sightBlockers() {
  return [...VAULT_WALLS, ...COVER_BLOCKS];
}

export function createGuard(def) {
  const first = def.waypoints[0];
  return {
    name: def.name,
    color: def.color,
    waypoints: def.waypoints,
    speed: def.speed,
    visionRange: def.visionRange,
    visionHalfAngle: def.visionHalfAngle,
    x: first.x,
    y: first.y,
    waypointIndex: 1,
    angle: 0,
    suspicion: 0,
    chasing: false,
    seesThief: false,
  };
}

export function createCamera(def) {
  return {
    x: def.x, y: def.y,
    minAngle: def.minAngle, maxAngle: def.maxAngle,
    sweepSeconds: def.sweepSeconds, range: def.range,
    phase: Math.random() * Math.PI * 2,
    angle: (def.minAngle + def.maxAngle) / 2,
    seesThief: false,
    jammedUntil: 0,
  };
}

export function createVaultState() {
  return {
    thief: { x: THIEF_START.x, y: THIEF_START.y, r: THIEF_RADIUS, angle: -Math.PI / 2 },
    guards: GUARD_DEFS.map(createGuard),
    cameras: CAMERA_DEFS.map(createCamera),
    alarm: 0,
    loot: 0,
    crackProgress: 0,
    crackDone: false,
    exitOpen: false,
    smokeUses: TOOLS.smoke.uses,
    jammerUses: TOOLS.jammer.uses,
    smokes: [], // { x, y, radius, until }
    jammedUntil: 0,
    elapsed: 0,
    busted: false,
    bustReason: '',
    exited: false,
    stepCount: 0,
  };
}

// Can this watcher see the thief right now? Walls, cover and smoke all block.
function canSee(watcherX, watcherY, angle, range, halfAngle, state) {
  const thief = state.thief;
  const dx = thief.x - watcherX;
  const dy = thief.y - watcherY;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (Math.abs(angleDifference(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  if (segmentBlockedByRects(watcherX, watcherY, thief.x, thief.y, sightBlockers())) return false;
  for (const smoke of state.smokes) {
    if (segmentHitsCircle(watcherX, watcherY, thief.x, thief.y, smoke.x, smoke.y, smoke.radius)) return false;
  }
  return true;
}

function moveThief(state, dt, move) {
  const thief = state.thief;
  if (move.x !== 0 || move.y !== 0) {
    thief.angle = Math.atan2(move.y, move.x);
  }
  thief.x += move.x * THIEF_SPEED * dt;
  thief.y += move.y * THIEF_SPEED * dt;
  const solids = sightBlockers();
  for (const rect of solids) pushCircleOutOfRect(thief, rect);
  thief.x = clamp(thief.x, ROOM.x + thief.r, ROOM.x + ROOM.width - thief.r);
  thief.y = clamp(thief.y, ROOM.y + thief.r, ROOM.y + ROOM.height - thief.r);
}

function stepGuard(guard, state, dt) {
  const thief = state.thief;
  guard.seesThief = canSee(guard.x, guard.y, guard.angle, guard.visionRange, guard.visionHalfAngle, state);
  if (guard.seesThief) {
    guard.suspicion = Math.min(100, guard.suspicion + SUSPICION_RISE * dt);
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_FALL * dt);
  }
  if (guard.suspicion >= 100) guard.chasing = true;
  if (guard.chasing && guard.suspicion <= CHASE_UNTIL) guard.chasing = false;

  if (guard.chasing) {
    const dx = thief.x - guard.x;
    const dy = thief.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      guard.angle = Math.atan2(dy, dx);
      guard.x += (dx / dist) * GUARD_CHASE_SPEED * dt;
      guard.y += (dy / dist) * GUARD_CHASE_SPEED * dt;
    }
    const body = { x: guard.x, y: guard.y, r: GUARD_RADIUS };
    for (const rect of sightBlockers()) pushCircleOutOfRect(body, rect);
    guard.x = body.x;
    guard.y = body.y;
  } else {
    // Patrol: walk to the next waypoint, then turn around.
    const target = guard.waypoints[guard.waypointIndex];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    } else {
      guard.angle = Math.atan2(dy, dx);
      guard.x += (dx / dist) * guard.speed * dt;
      guard.y += (dy / dist) * guard.speed * dt;
    }
  }

  // Caught: a guard who can see you at arm's length grabs you — a patrol
  // must not be able to walk straight through the thief — and two bodies
  // overlapping at all is a catch even from behind.
  const catchDist = Math.hypot(thief.x - guard.x, thief.y - guard.y);
  if ((guard.seesThief && catchDist < GUARD_RADIUS + THIEF_RADIUS + 2) || catchDist < 18) {
    state.busted = true;
    state.bustReason = `${guard.name} caught you`;
  }
}

function stepCamera(camera, state, dt) {
  const mid = (camera.minAngle + camera.maxAngle) / 2;
  const amp = (camera.maxAngle - camera.minAngle) / 2;
  camera.phase += (Math.PI * 2 / camera.sweepSeconds) * dt;
  camera.angle = mid + Math.sin(camera.phase) * amp;
  const jammed = state.elapsed < state.jammedUntil;
  camera.seesThief = !jammed && canSee(
    camera.x, camera.y, camera.angle, camera.range, CAMERA_HALF_ANGLE, state,
  );
  if (camera.seesThief) {
    state.alarm = Math.min(100, state.alarm + CAMERA_ALARM_RATE * dt);
  }
}

function vaultCentre() {
  return { x: VAULT.x + VAULT.w / 2, y: VAULT.y + VAULT.h / 2 };
}

export function nearVault(state) {
  const centre = vaultCentre();
  return Math.hypot(state.thief.x - centre.x, state.thief.y - centre.y) < 105;
}

export function nearExit(state) {
  const door = EXIT_DOOR;
  const cx = door.x + door.w / 2;
  const cy = door.y + door.h / 2;
  return Math.hypot(state.thief.x - cx, state.thief.y - cy) < 75;
}

// One fixed step of Act I. `input` carries the frame's keys and the sound bank.
export function stepVault(state, dt, input, sounds) {
  state.elapsed += dt;
  state.stepCount += 1;
  state.smokes = state.smokes.filter((smoke) => state.elapsed < smoke.until);

  moveThief(state, dt, input.move);

  let anyChasing = false;
  for (const guard of state.guards) {
    const wasChasing = guard.chasing;
    stepGuard(guard, state, dt);
    if (guard.chasing) anyChasing = true;
    if (guard.chasing && !wasChasing && sounds) sounds.spotted();
  }
  for (const camera of state.cameras) stepCamera(camera, state, dt);
  if (anyChasing) state.alarm = Math.min(100, state.alarm + CHASE_ALARM_RATE * dt);
  if (state.alarm >= 100) {
    for (const guard of state.guards) guard.chasing = true;
  }

  // Smoke bomb: a cloud that hides the thief, at the price of alarm.
  if (input.smoke && state.smokeUses > 0) {
    state.smokeUses -= 1;
    state.smokes.push({
      x: state.thief.x, y: state.thief.y,
      radius: TOOLS.smoke.radius, until: state.elapsed + TOOLS.smoke.seconds,
    });
    state.alarm = Math.min(100, state.alarm + TOOLS.smoke.alarmCost);
    if (sounds) sounds.smokePop();
  }

  // Camera jammer: every camera goes dark for a while, at the price of alarm.
  if (input.jammer && state.jammerUses > 0) {
    state.jammerUses -= 1;
    state.jammedUntil = state.elapsed + TOOLS.jammer.seconds;
    state.alarm = Math.min(100, state.alarm + TOOLS.jammer.alarmCost);
    if (sounds) sounds.jammerZap();
  }

  // Cracking the safe: hold E beside it for the full crack time.
  if (!state.crackDone && nearVault(state) && input.crack) {
    state.crackProgress += dt / VAULT.crackSeconds;
    if (state.stepCount % 12 === 0 && sounds) sounds.crackTick();
    if (state.crackProgress >= 1) {
      state.crackDone = true;
      state.loot = VAULT.loot;
      state.exitOpen = true;
      state.alarm = Math.min(100, state.alarm + 5);
      if (sounds) sounds.vaultOpen();
    }
  } else if (!state.crackDone) {
    state.crackProgress = Math.max(0, state.crackProgress - dt * 0.5);
  }

  if (state.exitOpen && nearExit(state)) state.exited = true;
}
