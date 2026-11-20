// config.js — every tuning number, palette entry, mission definition and
// district definition for SOLMAR BAY lives in this one file, so the rest of
// the game can stay declarative and the numbers are easy to audit.

export const GAME_NAME = 'SOLMAR BAY';
export const GAME_TAGLINE = 'Rico Vale is back in town — and the town owes him.';
export const HERO_NAME = 'Rico Vale';
export const SAVE_KEY = 'solmar-bay-save-v1';

export const WORLD = {
  half: 210, // the city is 420 x 420 m, centred on the origin
  roadHalf: 7, // half the width of one avenue
  sidewalk: 5.5, // sidewalk width on each side of an avenue
  block: 60, // pitch between neighbouring avenues
  roads: [-150, -90, -30, 30, 90, 150],
  beachZ: 178, // sand starts here, on the south edge
  seaZ: 205, // open water starts here
  step: 1 / 60, // fixed simulation step, seconds
};

export const PALETTE = {
  sky: 0xffb877,
  fog: 0xffc79a,
  sun: 0xfff2d8,
  ground: 0x8f8262,
  sidewalk: 0xb9b0a0,
  asphalt: 0x3c4148,
  sand: 0xe6c98c,
  sea: 0x2e7fc2,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.7,
  height: 1.8,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 2.4,
  spawn: { x: 0, z: 40, heading: Math.PI },
};

export const DRIVING = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 34, // about 122 km/h
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
  drag: 0.55,
  enterRadius: 3.4,
};

export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;
export const MAX_POLICE = 5;

// Extra actors spawned around a screenshot's final position (shot staging).
export const SHOT_TRAFFIC_BOOST = 10;
export const SHOT_PED_BOOST = 14;

export const WANTED = {
  max: 5,
  steal: 1,
  hitPed: 1,
  hitPolice: 2,
  shoot: 1,
  kill: 2,
  decayDelay: 14, // seconds of calm before the level starts to fall
  decayRate: 0.12, // stars per second while cooling down
  decayFloor: 0.4, // below this the level snaps to zero
  policeSpeed: [0, 22, 25, 28, 31, 34], // cruiser target speed per level
  spawnDelay: [0, 9, 7, 5, 4, 3], // seconds between extra cruisers per level
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 60,
  fireRate: 0.22,
  enemyHealth: 100,
  enemyDamage: 7,
  enemyRange: 34,
  enemyFireRate: 1.4,
  enemySpeed: 4.2,
  killXp: 25,
};

// The chained story: three jobs for the fixer Mara, $2,000 and 500 XP total.
// Step kinds: goto (reach the radius), escape (wanted back to zero),
// fight (defeat every spawned Viper).
export const MISSIONS = [
  {
    name: 'PACKAGE RUN',
    reward: 400,
    xp: 100,
    story: 'Mara needs a package moved from the Marina to Downtown — no questions asked.',
    steps: [
      { kind: 'goto', x: 150, z: 150, radius: 7, label: "Pick up Mara's package at the Marina" },
      { kind: 'goto', x: -30, z: -90, radius: 7, label: 'Deliver the package to Downtown' },
    ],
  },
  {
    name: 'HEAT ESCAPE',
    reward: 600,
    xp: 150,
    story: 'The drop was watched. The whole Solmar Bay PD is on you — lose them, then hide.',
    steps: [
      { kind: 'escape', label: 'Lose the cops — get your wanted level to zero' },
      { kind: 'goto', x: -150, z: 150, radius: 8, label: 'Reach the hideout under Coral Bridge' },
    ],
  },
  {
    name: 'HARBOR SHOWDOWN',
    reward: 1000,
    xp: 250,
    story: 'The Vipers took a cut of the harbour. Take it back.',
    steps: [
      { kind: 'goto', x: 150, z: -150, radius: 9, label: 'Reach the harbour crate' },
      { kind: 'fight', x: 150, z: -150, label: 'Clear the harbour — defeat all 3 Vipers' },
      { kind: 'goto', x: 150, z: -150, radius: 6, label: 'Take the harbour cut' },
    ],
  },
];

// District tints and tower heights. Downtown is tall and cream, the Harbor
// low and grey-blue, the Marina pale blue, Coral Hills warm orange.
export const DISTRICTS = [
  { name: 'MARINA', minX: 60, maxX: 210, minZ: 60, maxZ: 210, tint: 0xbfd9e8, minH: 10, maxH: 30 },
  { name: 'DOWNTOWN', minX: -90, maxX: 90, minZ: -150, maxZ: 30, tint: 0xe8d9b0, minH: 26, maxH: 62 },
  { name: 'HARBOR', minX: 60, maxX: 210, minZ: -210, maxZ: -60, tint: 0xaebdc9, minH: 10, maxH: 20 },
  { name: 'CORAL HILLS', minX: -210, maxX: -60, minZ: 60, maxZ: 210, tint: 0xf2c49b, minH: 10, maxH: 30 },
];
export const DEFAULT_DISTRICT = { name: 'SOLMAR', tint: 0xd8d3c3, minH: 10, maxH: 30 };

export const CONTROLS = [
  ['WASD / Arrows', 'Move'],
  ['Mouse', 'Look'],
  ['E', 'Enter / exit car'],
  ['F / Click', 'Shoot'],
  ['V', 'Punch'],
  ['Space', 'Jump / brake'],
  ['Shift', 'Sprint'],
  ['P', 'Pause'],
  ['R', 'Restart mission'],
  ['M', 'Mute'],
];

export function createDefaultSave() {
  return { money: 0, xp: 0, missionsDone: 0, bestMoney: 0, playTime: 0 };
}
