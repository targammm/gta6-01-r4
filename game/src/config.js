// config.js — every tuning number, palette, mission and district definition for Solmar Bay.
export const GAME_NAME = 'SOLMAR BAY';
export const GAME_TAGLINE = 'Rico Vale is back in town — and the town owes him.';
export const HERO_NAME = 'Rico Vale';
export const SAVE_KEY = 'solmar-bay-save-v1';

export const WORLD = {
  half: 210,
  roadHalf: 7,
  sidewalk: 5.5,
  block: 60,
  roads: [-150, -90, -30, 30, 90, 150],
  beachZ: 178,
  seaZ: 205,
};

export const PALETTE = {
  sky: 0xffc98a,
  skyHorizon: 0xffe3b3,
  sun: 0xfff2cf,
  ground: 0x8a7f6a,
  road: 0x3c3f45,
  roadLine: 0xf5d76e,
  sidewalk: 0xb9b0a0,
  sand: 0xe8d193,
  sea: 0x2e7fa8,
  grass: 0x7d9b57,
  playerJacket: 0x159a8c,
  playerHat: 0xffcf3f,
  viper: 0x14151a,
  viperBand: 0xd92323,
  policeBody: 0xf4f6f8,
  policeTrim: 0x15181d,
  lightRed: 0xff2a2a,
  lightBlue: 0x2a6bff,
  beacon: 0xffd23f,
  carColors: [0xc23b2e, 0x2e6fc2, 0x3fae5a, 0xe8b93b, 0xe6e6e6, 0x22242a, 0x8e44ad, 0xe67e22],
  taxi: 0xffc61a,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.7,
  height: 1.8,
  maxHealth: 100,
  accelDamp: 12,
  punchDamage: 12,
  punchRange: 2.4,
  spawnX: 0,
  spawnZ: 40,
  spawnHeading: Math.PI,
};

export const DRIVING = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
  drag: 0.55,
  enterRadius: 3.4,
};

export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;
export const MAX_POLICE = 5;
export const SHOT_TRAFFIC_BOOST = 10;
export const SHOT_PED_BOOST = 14;

export const WANTED = {
  max: 5,
  decayDelay: 14,
  decayRate: 0.12,
  policeSpeeds: [0, 22, 25, 28, 31, 34],
  spawnDelays: [0, 9, 7, 5, 4, 3],
  gains: { steal: 1, hitPed: 1, hitPolice: 2, shoot: 1, kill: 2 },
};

export const COMBAT = {
  damage: 34,
  range: 60,
  fireRate: 0.22,
  enemyHealth: 100,
  enemyDamage: 7,
  enemyRange: 34,
  enemyFireRate: 1.4,
  enemySpeed: 4.2,
  enemyStrafe: 1.6,
  killXp: 25,
};

export const MISSIONS = [
  {
    name: 'PACKAGE RUN',
    reward: 400,
    xp: 100,
    intro: 'Mara needs a package moved from the Marina to Downtown. Quietly.',
    steps: [
      { kind: 'goto', x: 150, z: 150, radius: 7, text: 'Pick up the package at the Marina' },
      { kind: 'goto', x: -30, z: -90, radius: 7, text: "Deliver the package to Mara's drop in Downtown" },
    ],
  },
  {
    name: 'HEAT ESCAPE',
    reward: 600,
    xp: 150,
    intro: 'The drop was watched. The whole Solmar Bay PD is rolling — lose them.',
    steps: [
      { kind: 'escape', text: 'Lose the cops — get your wanted level to zero' },
      { kind: 'goto', x: -150, z: 150, radius: 8, text: 'Reach the hideout under Coral Bridge' },
    ],
  },
  {
    name: 'HARBOR SHOWDOWN',
    reward: 1000,
    xp: 250,
    intro: 'The Vipers took the harbour cut. Take it back.',
    steps: [
      { kind: 'goto', x: 150, z: -150, radius: 9, text: 'Reach the harbour crate' },
      { kind: 'fight', x: 150, z: -150, text: 'Clear the harbour — defeat all 3 Vipers' },
      { kind: 'goto', x: 150, z: -150, radius: 6, text: 'Take the harbour cut' },
    ],
  },
];

export const DISTRICTS = [
  { name: 'MARINA', x0: 60, x1: 210, z0: 60, z1: 210, tint: 0x9fc8e8, minH: 10, maxH: 30 },
  { name: 'DOWNTOWN', x0: -90, x1: 90, z0: -150, z1: 30, tint: 0xf2dfba, minH: 26, maxH: 62 },
  { name: 'HARBOR', x0: 60, x1: 210, z0: -210, z1: -60, tint: 0xaebdc9, minH: 10, maxH: 20 },
  { name: 'CORAL HILLS', x0: -210, x1: -60, z0: 60, z1: 210, tint: 0xf5c396, minH: 10, maxH: 30 },
];

export const CONTROLS = [
  'WASD / Arrows — move · Mouse — look',
  'E — enter / exit car · Shift — sprint',
  'F or Click — shoot · V — punch · Space — jump / brake',
  'P — pause · M — mute · R — restart mission',
];

export function createDefaultSave() {
  return { money: 0, xp: 0, missionsDone: 0, bestMoney: 0, playTime: 0 };
}
