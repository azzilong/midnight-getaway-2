// Midnight Getaway — level constants and tuning.
// Everything the vault room and the getaway city are built from lives here,
// so the two acts share one source of truth for sizes, speeds and costs.

export const VIEW = { width: 1280, height: 720 };
export const HUD_HEIGHT = 64;
export const HINT_HEIGHT = 30;

// The vault room: outer walls plus two interior walls with door gaps,
// so the thief can pick a left, middle or right route to the safe.
export const ROOM = { x: 48, y: 96, width: 1184, height: 608 };

export const VAULT_WALLS = [
  // Outer shell (top, bottom, left, right).
  { x: 48, y: 96, w: 1184, h: 12 },
  { x: 48, y: 692, w: 1184, h: 12 },
  { x: 48, y: 96, w: 12, h: 608 },
  { x: 1220, y: 96, w: 12, h: 608 },
  // Interior wall A (x = 430): gap is the middle door, y 380..500.
  { x: 430, y: 96, w: 12, h: 284 },
  { x: 430, y: 500, w: 12, h: 204 },
  // Interior wall B (x = 820): gap is the high door, y 300..420.
  { x: 820, y: 96, w: 12, h: 204 },
  { x: 820, y: 420, w: 12, h: 284 },
];

// Teal cover blocks: they stop movement and block every line of sight.
export const COVER_BLOCKS = [
  { x: 150, y: 280, w: 110, h: 46 },
  { x: 170, y: 540, w: 120, h: 46 },
  { x: 560, y: 160, w: 120, h: 46 },
  { x: 600, y: 470, w: 60, h: 120 },
  { x: 980, y: 300, w: 120, h: 46 },
  { x: 1020, y: 520, w: 120, h: 46 },
  { x: 700, y: 620, w: 90, h: 40 },
];

// The gold safe: crack it to take the loot.
export const VAULT = { x: 1100, y: 140, w: 92, h: 72, loot: 50000, crackSeconds: 2.5 };

// The exit door, bottom right: locked until the safe is cracked.
export const EXIT_DOOR = { x: 1150, y: 640, w: 70, h: 64 };

export const THIEF_START = { x: 120, y: 620 };
export const THIEF_RADIUS = 14;
export const THIEF_SPEED = 235;

// One guard: name, colour, patrol waypoints, patrol speed, vision range.
export const GUARD_DEFS = [
  {
    name: 'MARCO', color: '#ff6b5e',
    waypoints: [{ x: 180, y: 400 }, { x: 380, y: 400 }],
    speed: 62, visionRange: 195, visionHalfAngle: 0.58,
  },
  {
    name: 'ROSA', color: '#ff9f43',
    waypoints: [{ x: 1010, y: 430 }, { x: 1010, y: 620 }],
    speed: 56, visionRange: 185, visionHalfAngle: 0.58,
  },
  {
    name: 'VINCE', color: '#f368e0',
    waypoints: [{ x: 900, y: 230 }, { x: 1150, y: 230 }],
    speed: 72, visionRange: 200, visionHalfAngle: 0.58,
  },
];

export const GUARD_RADIUS = 15;
export const GUARD_CHASE_SPEED = 155;
export const SUSPICION_RISE = 150; // per second while the thief is seen
export const SUSPICION_FALL = 26; // per second while hidden
export const CHASE_UNTIL = 40; // suspicion below this ends a chase

// Security cameras: wall-mounted, sweeping cones.
export const CAMERA_DEFS = [
  { x: 170, y: 112, minAngle: 0.35, maxAngle: 2.1, sweepSeconds: 5.2, range: 245 },
  { x: 1100, y: 112, minAngle: 1.05, maxAngle: 2.8, sweepSeconds: 6.4, range: 245 },
];
export const CAMERA_HALF_ANGLE = 0.5;
export const CAMERA_ALARM_RATE = 14; // alarm per second while a camera sees the thief
export const CHASE_ALARM_RATE = 5; // alarm per second while any guard chases

// Tools: each use costs alarm, because noise draws attention.
export const TOOLS = {
  smoke: { uses: 2, alarmCost: 8, radius: 95, seconds: 5 },
  jammer: { uses: 1, alarmCost: 15, seconds: 8 },
};

// Getaway city: a grid of streets with building blocks between them.
export const CITY = { x: 48, y: 96, width: 1184, height: 608 };
export const CITY_STREETS_X = [200, 420, 640, 860, 1080];
export const CITY_STREETS_Y = [200, 360, 520, 660];
export const STREET_HALF = 34;
export const SAFEHOUSE = { x: 980, y: 110, w: 190, h: 130 };
export const CAR_START = { x: 180, y: 620, angle: -Math.PI / 2 };
export const GETAWAY_SECONDS = 90;
export const LOSE_TAIL_SECONDS = 5;
export const LOSE_TAIL_RANGE = 300;
export const BUST_RISE = 46; // bust meter per second while a police car touches you
export const BUST_FALL = 22;
export const POLICE_TOP_SPEED = 335;
export const PLAYER_TOP_SPEED = 385;

export const SCORE = {
  timeBonusPerSecond: 100,
  alarmPenaltyPerPoint: 40,
};

export const BEST_KEY = 'midnight-getaway-best';
