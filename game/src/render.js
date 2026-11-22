// Midnight Getaway — everything drawn on the 1280x720 canvas: the vault
// room, the getaway city, the HUD and the title / end screens.

import {
  VIEW, HUD_HEIGHT, ROOM, VAULT_WALLS, COVER_BLOCKS, VAULT, EXIT_DOOR,
  GUARD_RADIUS, CITY, CITY_STREETS_X, CITY_STREETS_Y, STREET_HALF,
  SAFEHOUSE, GETAWAY_SECONDS, LOSE_TAIL_SECONDS,
} from './config.js';
import { cityBuildings } from './getaway.js';

const INK = '#e8ecf8';
const DIM = '#8b93b8';
const GOLD = '#f5b942';
const TEAL = '#2f8f7a';
const RED = '#ff5a4e';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawWalls(ctx) {
  for (const wall of VAULT_WALLS) {
    ctx.fillStyle = '#4a5578';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = '#6b789e';
    ctx.fillRect(wall.x, wall.y, wall.w, 3);
  }
}

function drawCover(ctx) {
  for (const block of COVER_BLOCKS) {
    roundRect(ctx, block.x, block.y, block.w, block.h, 7);
    ctx.fillStyle = TEAL;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(block.x + 4, block.y + 4, block.w - 8, 5);
  }
}

function drawGuard(ctx, guard) {
  const alert = guard.chasing || guard.suspicion > 55;
  drawCone(
    ctx, guard.x, guard.y, guard.angle, guard.visionRange, guard.visionHalfAngle,
    alert ? 'rgba(255,70,60,0.30)' : 'rgba(255,70,60,0.16)',
    alert ? 'rgba(255,90,80,0.7)' : 'rgba(255,90,80,0.35)',
  );
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = guard.color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#141a2e';
  ctx.stroke();
  // Nose: which way the guard is looking.
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.angle) * (GUARD_RADIUS + 9), guard.y + Math.sin(guard.angle) * (GUARD_RADIUS + 9));
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Suspicion ring.
  if (guard.suspicion > 2) {
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD_RADIUS + 7, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
    ctx.strokeStyle = guard.suspicion > 55 ? '#ff3b30' : '#ffd166';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(guard.name, guard.x, guard.y + GUARD_RADIUS + 17);
  if (guard.chasing) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ff6b5e';
    ctx.fillText('!', guard.x, guard.y - GUARD_RADIUS - 8);
  }
}

function drawCamera(ctx, camera, jammed) {
  const colour = jammed ? '#5a6a8a' : '#f5c542';
  drawCone(
    ctx, camera.x, camera.y, camera.angle, camera.range, 0.5,
    jammed ? 'rgba(120,130,160,0.10)' : 'rgba(245,197,66,0.20)',
    jammed ? 'rgba(120,130,160,0.4)' : 'rgba(245,197,66,0.55)',
  );
  ctx.beginPath();
  ctx.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#141a2e';
  ctx.stroke();
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = DIM;
  ctx.fillText(jammed ? 'JAMMED' : 'CAM', camera.x + 14, camera.y + 4);
  ctx.textAlign = 'center';
}

function drawThief(ctx, thief, crackProgress) {
  ctx.beginPath();
  ctx.arc(thief.x, thief.y, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f6ff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#f5b942';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(thief.x, thief.y);
  ctx.lineTo(thief.x + Math.cos(thief.angle) * 20, thief.y + Math.sin(thief.angle) * 20);
  ctx.strokeStyle = '#141a2e';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Crack progress ring while the safe is being worked.
  if (crackProgress > 0.01) {
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, 22, -Math.PI / 2, -Math.PI / 2 + crackProgress * Math.PI * 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawVaultRoom(ctx, state) {
  // Floor: dark checker so movement reads at a glance.
  const tile = 56;
  for (let y = ROOM.y; y < ROOM.y + ROOM.height; y += tile) {
    for (let x = ROOM.x; x < ROOM.x + ROOM.width; x += tile) {
      const odd = ((x - ROOM.x) / tile + (y - ROOM.y) / tile) % 2 === 0;
      ctx.fillStyle = odd ? '#1a2138' : '#171d33';
      ctx.fillRect(x, y, tile, tile);
    }
  }
  drawWalls(ctx);
  drawCover(ctx);

  // The gold safe.
  roundRect(ctx, VAULT.x, VAULT.y, VAULT.w, VAULT.h, 9);
  ctx.fillStyle = state.crackDone ? '#8a6d1f' : GOLD;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a5c14';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(VAULT.x + VAULT.w / 2, VAULT.y + VAULT.h / 2, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#141a2e';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(VAULT.x + VAULT.w / 2, VAULT.y + VAULT.h / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.fillText(state.crackDone ? 'VAULT — CRACKED' : 'VAULT — $50,000', VAULT.x + VAULT.w / 2, VAULT.y - 10);

  // Exit door, bottom right.
  roundRect(ctx, EXIT_DOOR.x, EXIT_DOOR.y, EXIT_DOOR.w, EXIT_DOOR.h, 6);
  ctx.fillStyle = state.exitOpen ? '#2fbf71' : '#3a4364';
  ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = state.exitOpen ? '#062b16' : DIM;
  ctx.fillText('EXIT', EXIT_DOOR.x + EXIT_DOOR.w / 2, EXIT_DOOR.y + EXIT_DOOR.h / 2 + 5);

  const jammed = state.elapsed < state.jammedUntil;
  for (const camera of state.cameras) drawCamera(ctx, camera, jammed);
  for (const guard of state.guards) drawGuard(ctx, guard);

  // Smoke clouds.
  for (const smoke of state.smokes) {
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,210,230,0.30)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(smoke.x - 18, smoke.y + 10, smoke.radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,210,230,0.22)';
    ctx.fill();
  }

  drawThief(ctx, state.thief, state.crackProgress);

  // Route labels, so the three ways through read instantly.
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(139,147,184,0.8)';
  ctx.fillText('LEFT ROUTE', 240, 130);
  ctx.fillText('MIDDLE ROUTE', 625, 640);
  ctx.fillText('RIGHT ROUTE', 1020, 680);
}

function drawCar(ctx, x, y, angle, body, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  roundRect(ctx, -19, -10, 38, 20, 5);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0c1020';
  ctx.stroke();
  ctx.fillStyle = 'rgba(12,16,32,0.55)';
  ctx.fillRect(-6, -8, 12, 16);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(15, -8, 3, 5);
  ctx.fillRect(15, 3, 3, 5);
  ctx.restore();
  if (label) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x, y - 16);
  }
}

function drawCity(ctx, state) {
  ctx.fillStyle = '#171d33';
  ctx.fillRect(CITY.x, CITY.y, CITY.width, CITY.height);
  // Streets.
  ctx.fillStyle = '#232a45';
  for (const x of CITY_STREETS_X) ctx.fillRect(x - STREET_HALF, CITY.y, STREET_HALF * 2, CITY.height);
  for (const y of CITY_STREETS_Y) ctx.fillRect(CITY.x, y - STREET_HALF, CITY.width, STREET_HALF * 2);
  // Lane dashes.
  ctx.strokeStyle = 'rgba(139,147,184,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 18]);
  for (const x of CITY_STREETS_X) {
    ctx.beginPath();
    ctx.moveTo(x, CITY.y);
    ctx.lineTo(x, CITY.y + CITY.height);
    ctx.stroke();
  }
  for (const y of CITY_STREETS_Y) {
    ctx.beginPath();
    ctx.moveTo(CITY.x, y);
    ctx.lineTo(CITY.x + CITY.width, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings.
  for (const block of cityBuildings()) {
    roundRect(ctx, block.x, block.y, block.w, block.h, 8);
    ctx.fillStyle = '#2b3352';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(block.x + 4, block.y + 4, block.w - 8, 6);
  }
  // Safehouse, top right.
  const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 4);
  roundRect(ctx, SAFEHOUSE.x, SAFEHOUSE.y, SAFEHOUSE.w, SAFEHOUSE.h, 12);
  ctx.fillStyle = `rgba(47,191,113,${0.75 * pulse})`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7be3a8';
  ctx.stroke();
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#062b16';
  ctx.fillText('SAFEHOUSE', SAFEHOUSE.x + SAFEHOUSE.w / 2, SAFEHOUSE.y + 58);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('ESCAPE HERE', SAFEHOUSE.x + SAFEHOUSE.w / 2, SAFEHOUSE.y + 82);

  for (const car of state.police) drawCar(ctx, car.x, car.y, car.angle, '#3b6fe0', 'POLICE');
  drawCar(ctx, state.player.x, state.player.y, state.player.angle, GOLD, null);

  // Speed + lose-the-tail readout, bottom left, above the hint bar.
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.round(Math.abs(state.player.speed) * 0.55)} km/h`, 24, VIEW.height - 40);
  if (state.hiddenFor > 0.1) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#7be3a8';
    ctx.fillText(`LOSING THE TAIL… ${Math.max(0, LOSE_TAIL_SECONDS - state.hiddenFor).toFixed(1)}s`, 24, VIEW.height - 64);
  }
  // Bust meter, bottom centre.
  if (state.bust > 1) {
    const bw = 260;
    const bx = VIEW.width / 2 - bw / 2;
    const by = VIEW.height - 26;
    ctx.fillStyle = '#141a2e';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 16);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(bx, by, (bw * state.bust) / 100, 12);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.fillText('BUST METER', VIEW.width / 2, by - 6);
  }
}

function drawStars(ctx, x, y, count) {
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < count ? GOLD : '#3a4364';
    ctx.fillText('★', x + i * 24, y);
  }
}

export function drawHud(ctx, game) {
  ctx.fillStyle = '#10142a';
  ctx.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
  ctx.fillStyle = '#2a3358';
  ctx.fillRect(0, HUD_HEIGHT - 2, VIEW.width, 2);

  ctx.textAlign = 'left';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText('MIDNIGHT GETAWAY', 20, 28);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = DIM;
  ctx.fillText(game.phaseLabel(), 20, 50);

  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText(`LOOT  $${game.loot.toLocaleString('en-US')}`, 330, 30);

  // Alarm meter.
  const ax = 560;
  const aw = 210;
  ctx.fillStyle = '#232a45';
  roundRect(ctx, ax, 14, aw, 18, 9);
  ctx.fill();
  const alarmFrac = game.alarm / 100;
  ctx.fillStyle = alarmFrac > 0.66 ? '#ff3b30' : alarmFrac > 0.33 ? '#ff9f43' : GOLD;
  if (alarmFrac > 0.01) {
    roundRect(ctx, ax, 14, Math.max(10, aw * alarmFrac), 18, 9);
    ctx.fill();
  }
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.fillText(`ALARM ${Math.round(game.alarm)}%`, ax + aw / 2, 48);

  ctx.textAlign = 'left';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = DIM;
  ctx.fillText('WANTED', 800, 22);
  drawStars(ctx, 800, 46, game.wanted);

  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText(`Q  SMOKE ×${game.smokeUses}`, 950, 26);
  ctx.fillText(`F  JAMMER ×${game.jammerUses}`, 950, 48);

  // Timer, top right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = game.timeLeft <= 10 && game.timeLeft > 0 ? '#ff6b5e' : INK;
  const t = Math.max(0, Math.ceil(game.timeLeft));
  ctx.fillText(game.phase === 'getaway' ? `⏱ ${t}s` : '00:00', 1256, 32);
  ctx.textAlign = 'left';
}

function drawHintBar(ctx, text) {
  ctx.fillStyle = 'rgba(10,13,28,0.85)';
  ctx.fillRect(0, VIEW.height - HUD_HEIGHT + 34, VIEW.width, 30);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.fillText(text, VIEW.width / 2, VIEW.height - 12);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, best) {
  ctx.fillStyle = '#10142a';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Decorative vault-room silhouette behind the title.
  ctx.fillStyle = '#171d33';
  ctx.fillRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
  drawWalls(ctx);
  drawCover(ctx);
  drawCone(ctx, 170, 112, 1.1, 245, 0.5, 'rgba(245,197,66,0.16)', 'rgba(245,197,66,0.4)');
  drawCone(ctx, 620, 400, 0.4, 195, 0.58, 'rgba(255,70,60,0.16)', 'rgba(255,90,80,0.35)');
  roundRect(ctx, VAULT.x, VAULT.y, VAULT.w, VAULT.h, 9);
  ctx.fillStyle = GOLD;
  ctx.fill();

  ctx.fillStyle = 'rgba(10,13,28,0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.textAlign = 'center';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText('MIDNIGHT GETAWAY', VIEW.width / 2, 210);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText('One thief. One vault. One gold safe. Then outrun the law.', VIEW.width / 2, 256);

  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#c6cde6';
  const lines = [
    'ACT I — THE VAULT: cross the room past Marco, Rosa and Vince. Read their vision cones.',
    'Cameras sweep the room — smoke (Q) hides you, the jammer (F) blinds them. Both raise the alarm.',
    'Hold E beside the safe to crack it for $50,000, then slip out the EXIT door.',
    'ACT II — GETAWAY: drive the city grid. Wanted stars follow your alarm. Reach the green',
    'safehouse — or stay unseen for 5 seconds to lose the tail. 90 seconds on the clock.',
    '',
    'WASD / arrows to move and drive · E crack · Q smoke · F jammer · M mute · R restart',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 320 + i * 28));

  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText('— PRESS ENTER OR CLICK TO START —', VIEW.width / 2, 540);
  if (best > 0) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(`BEST SCORE  $${best.toLocaleString('en-US')}`, VIEW.width / 2, 580);
  }
  ctx.textAlign = 'left';
}

export function drawEnd(ctx, game) {
  // Dim the scene behind the result.
  ctx.fillStyle = 'rgba(10,13,28,0.82)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  const won = game.phase === 'won';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillStyle = won ? '#2fbf71' : '#ff5a4e';
  ctx.fillText(won ? 'CLEAN GETAWAY' : 'BUSTED', VIEW.width / 2, 250);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText(
    won ? game.winReason + '. The loot is yours. The law is still looking.'
      : game.bustReason + '.',
    VIEW.width / 2, 300,
  );
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText(`LOOT  $${game.loot.toLocaleString('en-US')}`, VIEW.width / 2, 370);
  ctx.fillStyle = INK;
  ctx.fillText(
    `TIME BONUS  $${game.timeBonus.toLocaleString('en-US')}    ALARM PENALTY  −$${game.alarmPenalty.toLocaleString('en-US')}`,
    VIEW.width / 2, 408,
  );
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`SCORE  $${game.score.toLocaleString('en-US')}`, VIEW.width / 2, 470);
  if (game.newBest) {
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText('★ NEW BEST SCORE ★', VIEW.width / 2, 512);
  }
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText('— PRESS R OR CLICK TO RUN IT AGAIN —', VIEW.width / 2, 580);
  ctx.textAlign = 'left';
}

export function render(ctx, game) {
  // Paint the page background instead of clearRect: under software GL a
  // full clear of a 1280x720 canvas costs ~130 ms a frame, a fill ~2 ms,
  // and the HUD and the scene paint over every pixel anyway.
  ctx.fillStyle = '#10142a';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (game.phase === 'title') {
    drawTitle(ctx, game.best);
    return;
  }
  drawHud(ctx, game);
  if (game.phase === 'vault') {
    drawVaultRoom(ctx, game.vault);
    let hint = 'REACH THE VAULT — CRACK IT WITH E';
    if (game.vault.crackDone) hint = 'LOOT SECURED — SLIP OUT THE EXIT DOOR';
    else if (game.vault.guards.some((g) => g.chasing)) hint = 'SPOTTED — BREAK LINE OF SIGHT!';
    else if (game.vault.cameras.some((c) => c.seesThief)) hint = 'CAMERA ON YOU — MOVE OR JAM IT (F)';
    drawHintBar(ctx, hint);
    if (game.vault.crackProgress > 0.01 && !game.vault.crackDone) {
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = GOLD;
      ctx.fillText(`CRACKING… ${Math.round(game.vault.crackProgress * 100)}%`, VIEW.width / 2, ROOM.y + 40);
      ctx.textAlign = 'left';
    }
  } else if (game.phase === 'getaway') {
    drawCity(ctx, game.getaway);
    drawHintBar(ctx, 'REACH THE GREEN SAFEHOUSE — OR LOSE THE TAIL');
  } else {
    // End screens keep the last scene underneath.
    if (game.endedIn === 'vault') drawVaultRoom(ctx, game.vault);
    else drawCity(ctx, game.getaway);
    drawEnd(ctx, game);
  }
}
