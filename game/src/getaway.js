// Midnight Getaway — Act II, Getaway.
// A police chase across a night city grid. Wanted stars come from the alarm
// the thief carried out of the vault; win by reaching the green safehouse,
// or by staying out of sight of every police car for five seconds.

import {
  CITY, CITY_STREETS_X, CITY_STREETS_Y, STREET_HALF, SAFEHOUSE, CAR_START,
  GETAWAY_SECONDS, LOSE_TAIL_SECONDS, LOSE_TAIL_RANGE, BUST_RISE, BUST_FALL,
  POLICE_TOP_SPEED, PLAYER_TOP_SPEED,
} from './config.js';
import { clamp, angleDifference, pushCircleOutOfRect, circleHitsRect } from './geometry.js';

// Building blocks: everything between the streets is solid.
export function cityBuildings() {
  const blocks = [];
  // Building columns run between the vertical street bands; rows between
  // the horizontal ones. Each block is inset a little from the street edge.
  const colLeft = [CITY.x, ...CITY_STREETS_X.map((x) => x + STREET_HALF)];
  const colRight = [...CITY_STREETS_X.map((x) => x - STREET_HALF), CITY.x + CITY.width];
  const rowTop = [CITY.y, ...CITY_STREETS_Y.map((y) => y + STREET_HALF)];
  const rowBottom = [...CITY_STREETS_Y.map((y) => y - STREET_HALF), CITY.y + CITY.height];
  for (let i = 0; i < colLeft.length; i += 1) {
    for (let j = 0; j < rowTop.length; j += 1) {
      const w = colRight[i] - colLeft[i] - 12;
      const h = rowBottom[j] - rowTop[j] - 12;
      if (w < 40 || h < 30) continue;
      blocks.push({ x: colLeft[i] + 6, y: rowTop[j] + 6, w, h });
    }
  }
  return blocks;
}

export function wantedStarsFromAlarm(alarm) {
  return Math.min(5, 1 + Math.floor(alarm / 25));
}

function spawnPolice(count, player) {
  const cars = [];
  const spots = [
    { x: 640, y: 200 }, { x: 200, y: 520 }, { x: 1080, y: 360 },
    { x: 420, y: 660 }, { x: 860, y: 200 }, { x: 1080, y: 660 },
  ];
  for (let i = 0; i < count; i += 1) {
    const spot = spots[i % spots.length];
    cars.push({
      x: spot.x, y: spot.y, r: 17,
      angle: Math.atan2(player.y - spot.y, player.x - spot.x),
      speed: 0,
      retargetIn: Math.random() * 0.3,
      targetAngle: 0,
    });
  }
  return cars;
}

export function createGetawayState(alarm, loot) {
  const stars = wantedStarsFromAlarm(alarm);
  return {
    player: { x: CAR_START.x, y: CAR_START.y, r: 17, angle: CAR_START.angle, speed: 0 },
    police: spawnPolice(stars, CAR_START),
    wanted: stars,
    alarm,
    loot,
    timeLeft: GETAWAY_SECONDS,
    bust: 0,
    hiddenFor: 0,
    elapsed: 0,
    won: false,
    winReason: '',
    busted: false,
    bustReason: '',
    stepCount: 0,
  };
}

function driveCar(car, dt, steer, throttle, topSpeed, buildings) {
  // Arcade handling: throttle accelerates along the nose, steering turns
  // harder the faster the car goes, and the street slows the car down.
  car.speed += throttle * 340 * dt;
  car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -120, topSpeed);
  car.angle += steer * (1.9 + Math.min(1, Math.abs(car.speed) / 220) * 1.1) * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  for (const block of buildings) pushCircleOutOfRect(car, block);
  car.x = clamp(car.x, CITY.x + car.r, CITY.x + CITY.width - car.r);
  car.y = clamp(car.y, CITY.y + car.r, CITY.y + CITY.height - car.r);
}

function nearestPoliceDistance(state) {
  let best = Infinity;
  for (const car of state.police) {
    best = Math.min(best, Math.hypot(car.x - state.player.x, car.y - state.player.y));
  }
  return best;
}

// One fixed step of Act II. `input.move` is the WASD vector.
export function stepGetaway(state, dt, input, sounds) {
  state.elapsed += dt;
  state.stepCount += 1;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  const buildings = cityBuildings();

  const steer = input.move.x;
  const throttle = -input.move.y; // up on the keyboard is forward
  const wasSpeed = Math.abs(state.player.speed);
  driveCar(state.player, dt, steer, throttle, PLAYER_TOP_SPEED, buildings);
  if (Math.abs(state.player.speed) > 240 && Math.abs(steer) > 0.4 && wasSpeed > 200 && sounds) {
    if (state.stepCount % 45 === 0) sounds.skid();
  }
  if (sounds) sounds.setEngineSpeed(Math.abs(state.player.speed) / PLAYER_TOP_SPEED);

  // Police: retarget toward the player on a short lag, so the chase feels
  // like pursuit rather than homing. They are a touch slower than you.
  for (const car of state.police) {
    car.retargetIn -= dt;
    if (car.retargetIn <= 0) {
      car.retargetIn = 0.35;
      car.targetAngle = Math.atan2(state.player.y - car.y, state.player.x - car.x);
    }
    const diff = angleDifference(car.targetAngle, car.angle);
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    car.speed += (POLICE_TOP_SPEED - car.speed) * Math.min(1, dt * 1.4);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    for (const block of buildings) pushCircleOutOfRect(car, block);
    car.x = clamp(car.x, CITY.x + car.r, CITY.x + CITY.width - car.r);
    car.y = clamp(car.y, CITY.y + car.r, CITY.y + CITY.height - car.r);
  }

  // Touching a police car fills the bust meter; distance drains it.
  let touching = false;
  for (const car of state.police) {
    if (circleHitsRect({ x: state.player.x, y: state.player.y, r: state.player.r + 4 }, { x: car.x - car.r, y: car.y - car.r, w: car.r * 2, h: car.r * 2 })) {
      touching = true;
    }
  }
  state.bust = clamp(state.bust + (touching ? BUST_RISE : -BUST_FALL) * dt, 0, 100);
  if (state.bust >= 100) {
    state.busted = true;
    state.bustReason = 'The police boxed you in';
  }

  // Lose the tail: no police car close for five seconds straight.
  if (nearestPoliceDistance(state) > LOSE_TAIL_RANGE) {
    state.hiddenFor += dt;
    if (state.hiddenFor >= LOSE_TAIL_SECONDS) {
      state.won = true;
      state.winReason = 'You lost the tail';
    }
  } else {
    state.hiddenFor = 0;
  }

  // Reach the green safehouse.
  const p = state.player;
  if (p.x > SAFEHOUSE.x && p.x < SAFEHOUSE.x + SAFEHOUSE.w
    && p.y > SAFEHOUSE.y && p.y < SAFEHOUSE.y + SAFEHOUSE.h) {
    state.won = true;
    state.winReason = 'Safehouse reached';
  }

  if (state.timeLeft <= 0 && !state.won) {
    state.busted = true;
    state.bustReason = 'Out of time — the net closed in';
  }
}
