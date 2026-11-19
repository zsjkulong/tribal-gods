/**
 * sim/catalog.ts — THE CONTRACT. Every unit, building, spell and tribe the
 * game knows about, as plain data, plus the query surface the UI reads.
 *
 * Three groups of code meet here and nowhere else:
 *   - the SIM (world-state.ts, spells.ts, ai.ts) implements the behaviour
 *     these rows describe, and implements `SimQueries` below;
 *   - the RENDERER (assets/models, render/) builds one model per `kind`
 *     and one effect per `EFFECT_EVENTS` entry;
 *   - the UI (ui/) draws panels straight from these rows and `SimQueries`
 *     — it never hard-codes a cost, a name, or a list of spells.
 *
 * Adding content = adding a row here, then teaching each group about it.
 * Numbers are starting points for balance; structure is what's binding.
 *
 * Tribal Gods is its own game: names, roster, spell book and scenarios are
 * ours. It shares a genre with the late-90s god games, not their content.
 */

// ---------------------------------------------------------------------------
// Tribes
// ---------------------------------------------------------------------------

/** Tribes with an economy. `player` is always the human. Up to four per world. */
export const TRIBE_IDS = ['player', 'red', 'gold', 'violet'] as const;
export type TribeId = (typeof TRIBE_IDS)[number];
/** `wild` = unaligned wanderers (recruitable). */
export type Tribe = TribeId | 'wild';

/** What a tribe is called when its scenario doesn't name it. */
const FALLBACK_TRIBE_NAMES: Record<TribeId, string> = {
  player: '你的部落',
  red: '赤色部落',
  gold: '金色部落',
  violet: '紫色部落',
};
export function tribeName(rules: ScenarioRules, id: TribeId): string {
  const named = rules.tribes.find((t) => t.id === id)?.name;
  return named ?? FALLBACK_TRIBE_NAMES[id];
}

export const TRIBE_COLORS: Record<Tribe, number> = {
  player: 0x2f7fe6,
  red: 0xd9483b,
  gold: 0xe2a72e,
  violet: 0x9a5fd6,
  wild: 0x8a8273,
};

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export type UnitKind = 'brave' | 'warrior' | 'firewarrior' | 'warden' | 'chanter' | 'shaman' | 'wildman';

export interface UnitDef {
  kind: UnitKind;
  /** Display name. (Ids are historical; names are what players see.) */
  name: string;
  blurb: string;
  hp: number;
  dmg: number;
  /** Attack reach in tiles (<=1.5 is melee). */
  range: number;
  cooldown: number;
  /** Auto-engage radius in tiles. 0 = never picks a fight. */
  sight: number;
  /** Tiles per second. */
  speed: number;
  /** Fraction of incoming damage ignored (0..1). */
  armor: number;
  /** Building that trains it (undefined = born or summoned, not trained). */
  trainedAt?: BuildingKind;
  trainWood: number;
  trainSeconds: number;
  /** Rendered height in world units (a tile is 2 wide). People are BIG now. */
  height: number;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  brave: {
    kind: 'brave', name: '村民',
    blurb: '砍木、搬运、建造、生儿育女、祈祷。部落本身。',
    hp: 12, dmg: 1.2, range: 1.1, cooldown: 1.4, sight: 0, speed: 1.8, armor: 0,
    trainWood: 0, trainSeconds: 0, height: 2.3,
  },
  warrior: {
    kind: 'warrior', name: '战士',
    blurb: '长矛与皮盾。够得着的仗，它不会输。',
    hp: 30, dmg: 4, range: 1.3, cooldown: 1.1, sight: 9, speed: 1.9, armor: 0.1,
    trainedAt: 'warriorHut', trainWood: 2, trainSeconds: 5, height: 2.5,
  },
  firewarrior: {
    kind: 'firewarrior', name: '掷火者',
    blurb: '远程投掷燃烧的沥青，点燃建筑。身板脆弱。',
    hp: 15, dmg: 5, range: 6.5, cooldown: 1.7, sight: 10, speed: 1.7, armor: 0,
    trainedAt: 'fireHut', trainWood: 3, trainSeconds: 6, height: 2.4,
  },
  warden: {
    kind: 'warden', name: '守卫者',
    blurb: '巨盾与石槌。缓慢、几乎杀不死，专拆建筑。任何法术都只能让它打个趔趄。',
    hp: 60, dmg: 3, range: 1.3, cooldown: 1.6, sight: 7, speed: 1.3, armor: 0.35,
    trainedAt: 'wardenHall', trainWood: 5, trainSeconds: 9, height: 2.8,
  },
  chanter: {
    kind: 'chanter', name: '咏唱者',
    blurb: '手无寸铁。听到咏唱的敌人会罢手，假以时日便倒戈。另一名咏唱者会破解此术。',
    hp: 14, dmg: 0, range: 5, cooldown: 0, sight: 8, speed: 1.6, armor: 0,
    trainedAt: 'chantHall', trainWood: 4, trainSeconds: 8, height: 2.4,
  },
  shaman: {
    kind: 'shaman', name: '首领',
    blurb: '你在世间的唯一化身。可施放一切法术。只要部落尚存，死后便会回到家园图腾处。',
    hp: 45, dmg: 0, range: 0, cooldown: 0, sight: 0, speed: 2.2, armor: 0,
    trainWood: 0, trainSeconds: 0, height: 3.0,
  },
  wildman: {
    kind: 'wildman', name: '漂泊者',
    blurb: '不属于任何部落。暂时如此。',
    hp: 10, dmg: 0, range: 0, cooldown: 0, sight: 0, speed: 1.3, armor: 0,
    trainWood: 0, trainSeconds: 0, height: 2.2,
  },
};

/** Chanter tuning: seconds of uninterrupted chant before a listener defects. */
export const CHANT = { pacifyRadius: 5, convertSeconds: 9, maxListeners: 4 };

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export type BuildingKind =
  | 'hut' | 'warriorHut' | 'fireHut' | 'wardenHall' | 'chantHall' | 'tower' | 'shrine' | 'lumberyard';

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  blurb: string;
  wood: number;
  /** Builder-seconds to raise. */
  buildSeconds: number;
  hp: number;
  /** Footprint is size×size tiles (odd). Buildings are BIG now. */
  size: 3 | 5;
  /** Buildings that must already stand (complete) before this can be placed. */
  requires: BuildingKind[];
  trains?: UnitKind;
  /** Rendered height in world units, for camera/UI framing. */
  height: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  hut: {
    kind: 'hut', name: '民居',
    blurb: '家园养育村民，也滋养你的法力。住满的民居会长大——两次——成为更大的样子。',
    wood: 5, buildSeconds: 30, hp: 40, size: 3, requires: [], height: 4.5,
  },
  lumberyard: {
    kind: 'lumberyard', name: '伐木场',
    blurb: '存放木材的第二个去处。在附近劳作的村民伐木快三分之一，砍完还会补种。',
    wood: 6, buildSeconds: 25, hp: 35, size: 3, requires: ['hut'], height: 3.5,
  },
  warriorHut: {
    kind: 'warriorHut', name: '战团木屋',
    blurb: '将村民训练成战士。',
    wood: 8, buildSeconds: 35, hp: 55, size: 3, requires: ['hut'], trains: 'warrior', height: 5,
  },
  fireHut: {
    kind: 'fireHut', name: '余烬木屋',
    blurb: '将村民训练成掷火者。',
    wood: 10, buildSeconds: 38, hp: 50, size: 3, requires: ['warriorHut'], trains: 'firewarrior', height: 5,
  },
  tower: {
    kind: 'tower', name: '瞭望塔',
    blurb: '最多驻守两名战士；登得高，看得远，出手也更狠。',
    wood: 6, buildSeconds: 22, hp: 60, size: 3, requires: ['hut'], height: 7,
  },
  shrine: {
    kind: 'shrine', name: '祭坛',
    blurb: '被派来此处的村民祈祷而非劳作。每一名祈祷者都让正在蓄能的法术更快成形。',
    wood: 12, buildSeconds: 45, hp: 60, size: 5, requires: ['hut'], height: 6,
  },
  wardenHall: {
    kind: 'wardenHall', name: '守卫者大厅',
    blurb: '将村民训练成守卫者。',
    wood: 14, buildSeconds: 50, hp: 80, size: 5, requires: ['warriorHut'], trains: 'warden', height: 6,
  },
  chantHall: {
    kind: 'chantHall', name: '咏唱大厅',
    blurb: '将村民训练成咏唱者。',
    wood: 12, buildSeconds: 45, hp: 50, size: 3, requires: ['shrine'], trains: 'chanter', height: 5.5,
  },
};

/** Panel order for the build menu. */
export const BUILD_ORDER: BuildingKind[] = [
  'hut', 'lumberyard', 'tower', 'warriorHut', 'fireHut', 'shrine', 'chantHall', 'wardenHall',
];

/**
 * Dwellings have three tiers. A dwelling that has been FULL for
 * `growSeconds` grows a tier if the tribe can pay `growWood` (villagers haul
 * it). Tier is 0..2; capacity and breeding improve with each.
 */
export const DWELLING_TIERS = [
  { name: '小民居', capacity: 3, breedSeconds: 24, growWood: 0, growSeconds: 0 },
  { name: '民居', capacity: 4, breedSeconds: 20, growWood: 4, growSeconds: 40 },
  { name: '大民居', capacity: 6, breedSeconds: 16, growWood: 7, growSeconds: 70 },
] as const;

export const ECONOMY = {
  popBase: 6,
  /** Population cap contributed by a dwelling = its capacity × this. */
  popPerBed: 1.4,
  popHardCap: 160,
  towerGarrison: 2,
  shrineWorshippers: 6,
  /** Each praying villager adds this fraction to spell charge speed. */
  shrinePrayerBonus: 0.12,
  /** Training buildings hold a queue this long. */
  trainQueueMax: 8,
};

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------

export type SpellId =
  | 'blast' | 'convert' | 'lightning' | 'swamp' | 'landbridge' | 'flatten' | 'earthquake' | 'volcano'
  | 'ward' | 'warsong' | 'cyclone' | 'emberfall' | 'sink' | 'bloom';

export type SpellTier = 1 | 2 | 3;
/** How the UI should aim it. `line` = from the leader toward the cursor. */
export type SpellAim = 'point' | 'area' | 'line';

/**
 * THE CHARGE MODEL (replaces "spend mana from a pool at cast time").
 * Mana trickles in from your people. It is poured, automatically and
 * evenly, into every known spell that is switched to charge and not full.
 * A spell that has soaked up `chargeMana` gains one charge, up to
 * `maxCharges`. Casting spends one charge — nothing else. So: small spells
 * come back in seconds, the big ones are a plan you make minutes ahead,
 * and switching spells off to feed one faster is a real decision.
 */
export interface SpellDef {
  id: SpellId;
  name: string;
  blurb: string;
  tier: SpellTier;
  /** Mana soaked up per charge. */
  chargeMana: number;
  maxCharges: number;
  /** Leader must be within this many tiles of the target. */
  range: number;
  /** Effect radius in tiles (for the aiming reticle). 0 for single-target. */
  radius: number;
  /** Seconds the leader stands casting. */
  castSeconds: number;
  /** Seconds the effect lasts in the world (0 = instant). */
  duration: number;
  aim: SpellAim;
  /** Can be aimed at water / unwalkable ground. */
  anywhere: boolean;
  /** Known from the start of a default skirmish. */
  starter: boolean;
}

/** Display order = panel order, grouped by tier. */
export const SPELLS: SpellDef[] = [
  // --- Tier 1: the everyday toolkit -----------------------------------------
  { id: 'blast', name: '冲击', tier: 1, chargeMana: 14, maxCharges: 4, range: 14, radius: 4.5, castSeconds: 0.7, duration: 0, aim: 'area', anywhere: true, starter: true,
    blurb: '炸出一个大坑，把附近的家伙全掀翻。' },
  { id: 'convert', name: '感化', tier: 1, chargeMana: 12, maxCharges: 3, range: 12, radius: 5, castSeconds: 0.9, duration: 0, aim: 'area', anywhere: false, starter: true,
    blurb: '圈中的漂泊者加入你的部落。' },
  { id: 'flatten', name: '平整', tier: 1, chargeMana: 22, maxCharges: 3, range: 14, radius: 5, castSeconds: 0.9, duration: 2.5, aim: 'area', anywhere: true, starter: false,
    blurb: '将地面抹平。腾出建造之地，也毁掉依坡而设的防线。' },
  { id: 'bloom', name: '萌发', tier: 1, chargeMana: 24, maxCharges: 2, range: 12, radius: 6, castSeconds: 1.0, duration: 6, aim: 'area', anywhere: false, starter: false,
    blurb: '被砍倒的树立即重生，新芽萌出；圈内的子民同时得到救治。' },
  { id: 'ward', name: '石之庇护', tier: 1, chargeMana: 26, maxCharges: 2, range: 12, radius: 6, castSeconds: 0.8, duration: 22, aim: 'area', anywhere: false, starter: false,
    blurb: '圈内的子民与建筑，一段时间内只承受一半伤害。' },
  // --- Tier 2: decide a battle ----------------------------------------------
  { id: 'lightning', name: '闪电', tier: 2, chargeMana: 34, maxCharges: 3, range: 16, radius: 1.5, castSeconds: 0.8, duration: 0, aim: 'point', anywhere: true, starter: false,
    blurb: '一道雷霆。击中即灭，跳向另外两个目标，并点燃木料。' },
  { id: 'warsong', name: '战歌', tier: 2, chargeMana: 36, maxCharges: 2, range: 10, radius: 7, castSeconds: 1.0, duration: 25, aim: 'area', anywhere: false, starter: false,
    blurb: '圈内的战士移动与出击都快三分之一。' },
  { id: 'swamp', name: '泥沼', tier: 2, chargeMana: 38, maxCharges: 2, range: 14, radius: 4, castSeconds: 1.0, duration: 45, aim: 'area', anywhere: false, starter: false,
    blurb: '吞噬一切踏入者的地面——你自己的子民也不例外。' },
  { id: 'landbridge', name: '石道', tier: 2, chargeMana: 40, maxCharges: 2, range: 22, radius: 2.5, castSeconds: 1.2, duration: 4, aim: 'line', anywhere: true, starter: false,
    blurb: '从首领脚下到标记处升起一条陆路，横跨水面与深谷。' },
  { id: 'cyclone', name: '龙卷', tier: 2, chargeMana: 55, maxCharges: 2, range: 15, radius: 3, castSeconds: 1.2, duration: 14, aim: 'point', anywhere: true, starter: false,
    blurb: '游荡的漏斗旋风，把人卷上天、摔下来，再掀飞屋脊。' },
  // --- Tier 3: reshape the planet -------------------------------------------
  { id: 'emberfall', name: '落烬', tier: 3, chargeMana: 80, maxCharges: 1, range: 16, radius: 8, castSeconds: 1.6, duration: 9, aim: 'area', anywhere: true, starter: false,
    blurb: '燃烧的碎石如雨般洒落圈内。森林与村庄纷纷点燃。' },
  { id: 'sink', name: '回澜', tier: 3, chargeMana: 90, maxCharges: 1, range: 14, radius: 7, castSeconds: 1.6, duration: 10, aim: 'area', anywhere: true, starter: false,
    blurb: '圈中的陆地缓缓沉入海面之下，永不回头。' },
  { id: 'earthquake', name: '地裂', tier: 3, chargeMana: 100, maxCharges: 1, range: 16, radius: 9, castSeconds: 1.6, duration: 5, aim: 'line', anywhere: true, starter: false,
    blurb: '沿线撕开一道断层。其上的建筑尽数倒塌。' },
  { id: 'volcano', name: '火山', tier: 3, chargeMana: 160, maxCharges: 1, range: 16, radius: 9, castSeconds: 2.2, duration: 14, aim: 'area', anywhere: true, starter: false,
    blurb: '在原本空无一物处，升起一座火焰之山。永存不移。' },
];

export const spellDef = (id: SpellId): SpellDef => SPELLS.find((s) => s.id === id)!;

/**
 * Monuments (standing stones). Two flavours:
 *   `teach`  — the first leader to commune here learns the spell for the
 *              rest of the scenario;
 *   `gift`   — whoever communes gets `charges` free casts of the spell,
 *              known or not; the stone then sleeps for `cooldown` seconds.
 */
export interface MonumentDef {
  x: number;
  z: number;
  spell: SpellId;
  mode: 'teach' | 'gift';
  charges?: number;
  cooldown?: number;
  /** The stone sleeps (nobody can commune) until this many seconds into the scenario. */
  opensAt?: number;
  /** The stone sleeps until a scripted `openStone` action wakes it. */
  asleep?: boolean;
  /** Seconds of uninterrupted ritual to commune (default by tier: see COMMUNE). */
  communeSeconds?: number;
  /**
   * Guardians: fighters that belong to no tribe, stand around the stone and
   * do nothing — until someone starts a commune here (or hurts one). Then
   * they fight every tribe in reach, the communer first.
   */
  guards?: Partial<Record<UnitKind, number>>;
}

/**
 * THE RITUAL. Communing is not a click: the leader kneels at the stone for
 * `seconds[tier]` (gift stones take `giftFactor` of that), takes
 * `vulnerability`× damage while she does, and any hurt or shove breaks it.
 * A broken ritual keeps its progress but it drains away at `decayPerSecond`
 * of the full ritual per second, so a guarded leader can resume. While a
 * fighter hostile to the communer stands inside `ring` tiles of the stone
 * the ritual pauses (contested). One tribe at a stone at a time.
 */
export const COMMUNE = {
  seconds: { 1: 10, 2: 20, 3: 35 } as Record<SpellTier, number>,
  giftFactor: 0.6,
  vulnerability: 1.5,
  decayPerSecond: 1 / 60,
  ring: 6,
};

/** Seconds of ritual a stone asks for. */
export function communeSecondsFor(m: Pick<MonumentDef, 'spell' | 'mode' | 'communeSeconds'>): number {
  if (m.communeSeconds !== undefined) return m.communeSeconds;
  const base = COMMUNE.seconds[spellDef(m.spell).tier];
  return Math.round(m.mode === 'gift' ? base * COMMUNE.giftFactor : base);
}

// ---------------------------------------------------------------------------
// Scenarios & objectives
// ---------------------------------------------------------------------------

export type Objective =
  | { type: 'destroyTribe'; tribe: TribeId }
  | { type: 'destroyAll' }
  | { type: 'survive'; seconds: number }
  | { type: 'reachPopulation'; count: number }
  | { type: 'claimMonument'; index: number }
  | { type: 'buildCount'; kind: BuildingKind; count: number }
  | { type: 'leaderReach'; x: number; z: number; radius: number }
  | { type: 'holdPoint'; x: number; z: number; radius: number; seconds: number }
  /** The spell holds at least `charges` (default 1) real charges at once. */
  | { type: 'chargeSpell'; spell: SpellId; charges?: number }
  /**
   * The leader casts `spell` `count` times (default 1), landing inside the
   * circle if one is given. Counting starts when the objective becomes active.
   */
  | { type: 'castSpell'; spell: SpellId; count?: number; x?: number; z?: number; radius?: number }
  /** Kindle `count` wanderers into the tribe (counted from activation). */
  | { type: 'convertWanderers'; count: number }
  /** `count` of `tribe`'s people die (counted from activation). */
  | { type: 'killUnits'; tribe: TribeId; count: number }
  /** `count` stranded people (units with `joins`) reach the tribe (counted from activation). */
  | { type: 'rescueStranded'; count: number }
  /**
   * HELD objectives (meant to be optional): true until broken, and only
   * scored at victory. `failed` latches when broken.
   *   loseAtMost — no more than `count` of your people (of `kind`, if given) die;
   *   winWithin  — the scenario is won before `seconds`.
   */
  | { type: 'loseAtMost'; count: number; kind?: UnitKind }
  | { type: 'winWithin'; seconds: number };

export type FailCondition =
  | { type: 'tribeDestroyed' } // always implied
  | { type: 'leaderDies' } // no reincarnation in this scenario
  | { type: 'timeLimit'; seconds: number }
  | { type: 'buildingLost'; kind: BuildingKind }
  /** Another tribe communed at monument `index` before you did. */
  | { type: 'monumentTaken'; index: number };
// (Losing "too many people" is a scripted event: trigger `killed` on the player + action `defeat`.)

export interface ObjectiveState {
  objective: Objective;
  /** Player-facing sentence, e.g. "Reach 40 villagers". */
  text: string;
  done: boolean;
  /** 0..1 where it makes sense (population, survive, hold). */
  progress: number;
  optional: boolean;
  /**
   * False while the objective waits on an earlier one (`after`): the UI
   * hides it (or shows it greyed) and the sim doesn't evaluate it yet.
   */
  active: boolean;
  /** A held objective (loseAtMost, winWithin) that was broken — it can no longer be met. */
  failed: boolean;
}

/** What a tribe may use in a scenario. Omitted lists = everything. */
export interface Loadout {
  spells?: SpellId[]; // known at start
  buildings?: BuildingKind[]; // allowed to build
  startUnits?: Partial<Record<UnitKind, number>>;
  startWood?: number;
  /** Extra max charges on top of the catalog's maxCharges (campaign boons). */
  extraCharges?: Partial<Record<SpellId, number>>;
  /** Multiplier on a spell's chargeMana for this tribe (2 = charges half as fast). */
  chargeCost?: Partial<Record<SpellId, number>>;
  /** Free casts at the start, exactly as if a gift stone had given them. */
  gifts?: Partial<Record<SpellId, number>>;
  /** Complete buildings stood up around the home circle at the start. */
  startBuildings?: BuildingKind[];
  /**
   * Charges each known spell holds at t=0. Omitted spells start with the
   * default (START_CHARGES by tier: the first seconds are always playable).
   */
  startCharges?: Partial<Record<SpellId, number>>;
}

/** Charges a known spell holds at the start, by tier, unless the loadout says otherwise. */
export const START_CHARGES: Record<SpellTier, number> = { 1: 2, 2: 1, 3: 0 };

/**
 * How an AI god behaves (all optional; omitted = the standard rival).
 * Personality changes decisions only — never the rules it plays by.
 */
export interface AiPersonality {
  /** Army size at which it starts raiding (default 5) / marches in force (default 11). */
  harassAt?: number;
  assaultAt?: number;
  /** Stops training past this many fighters (default 24). */
  maxArmy?: number;
  /** Stops raising Dwellings past this many (default by difficulty: 6 / 8 / 11). */
  maxDwellings?: number;
  /** No raids or assaults until attacked, `wakeAt` passes, or a `wake` event fires. */
  passive?: boolean;
  wakeAt?: number;
  /** False = a war band: never raises buildings or trains. Default true. */
  builds?: boolean;
  /** False = never falls back home when hurt (raiders). Default true. */
  defends?: boolean;
  /** Leader visits standing stones. Default true. */
  seeksStones?: boolean;
  /** Train only at halls that turn out these kinds, in this order of preference. */
  prefer?: UnitKind[];
  /** Always makes war on this tribe (while it lives) instead of the nearest rival. */
  target?: TribeId;
}

/** When a scripted scenario event fires. */
export type ScenarioTrigger =
  | { type: 'time'; at: number }
  /**
   * At least `count` (default 1) visible units of `tribe` (default the
   * player; 'wild' allowed), of `kind` if given, stand within the circle.
   */
  | { type: 'zone'; x: number; z: number; radius: number; tribe?: Tribe; count?: number; kind?: UnitKind }
  /** Objective `index` is done. */
  | { type: 'objective'; index: number }
  /** `tribe` (default the player) has cast `spell` (any, if omitted), landing in the circle if one is given. */
  | { type: 'spellCast'; spell?: SpellId; tribe?: TribeId; x?: number; z?: number; radius?: number }
  /** At least `count` stranded people have joined `tribe` (default the player). */
  | { type: 'joined'; count: number; tribe?: TribeId }
  /** At least `count` of `tribe`'s people (of `kind`, if given; leaders never count in the total) have died. */
  | { type: 'killed'; tribe: TribeId; count: number; kind?: UnitKind }
  /** A commune has begun at stone `index` (by `tribe`, if given). */
  | { type: 'commune'; index: number; tribe?: TribeId }
  /** `tribe` (default the player) holds no cast of `spell` right now: no gift left and no charge of a known spell. */
  | { type: 'noCasts'; spell: SpellId; tribe?: TribeId }
  /** Any of these. */
  | { type: 'any'; of: ScenarioTrigger[] }
  /** All of these. */
  | { type: 'all'; of: ScenarioTrigger[] }
  /** This one does not hold. */
  | { type: 'not'; of: ScenarioTrigger };

export type ScenarioAction =
  /**
   * Units appear near (x, z); with `march` they set off for it at once.
   * `hold`: they wait at the march point that many seconds (from spawning)
   * before their god may send them on — a host massing on a beach.
   * `joins`: a STRANDED group — they spawn belonging to no one ('wild') and
   * join `joins` the moment a walking route links them to its home.
   * `by`: 'sea' = they come in by boat (a `landing` event at once, the crews
   * ashore a few seconds later when the hulls ground — sim/scenario-events.ts
   * LANDING); 'land' = they appear at once. Omitted: by sea when the tribe is
   * a homeless war band marching from a shore, otherwise by land.
   */
  | {
    type: 'spawn'; tribe: Tribe; units: Partial<Record<UnitKind, number>>; x: number; z: number;
    march?: { x: number; z: number }; hold?: number; joins?: TribeId; by?: 'sea' | 'land';
  }
  /** `tribe` is now allied with exactly these tribes (both ways); everyone else is hostile to it. */
  | { type: 'allies'; tribe: TribeId; allies: TribeId[] }
  /** A passive AI wakes up. */
  | { type: 'wake'; tribe: TribeId }
  | { type: 'teach'; tribe: TribeId; spell: SpellId }
  | { type: 'gift'; tribe: TribeId; spell: SpellId; charges: number }
  /** The world itself casts a spell at (x, z) on `tribe`'s behalf — no leader needed. */
  | { type: 'strike'; spell: SpellId; x: number; z: number; tribe: TribeId }
  /** Wake a stone that was `asleep` (or a gift stone resting after a lending: ready again). */
  | { type: 'openStone'; index: number }
  /** The scenario is lost, for `reason` (a fail condition written as a story beat). */
  | { type: 'defeat'; reason: string }
  /** `focus`: where the narrator points (camera nudge / minimap ping). */
  | { type: 'message'; text: string; focus?: { x: number; z: number } };

export interface ScenarioEvent {
  when: ScenarioTrigger;
  /** Seconds between the trigger first holding and the event firing (a visible countdown). */
  delay?: number;
  /** If this holds when the event would fire, it is spent without firing (the story moved past it). */
  unless?: ScenarioTrigger;
  /**
   * Fire again every `every` seconds after the first, `times` times in all
   * (default once). `while`: instead, it fires each time its trigger has
   * HELD for a whole `every` seconds (the first time too), up to `times` —
   * a recovery that lends another cast only while one is needed, never
   * the moment one is spent. (`delay` is ignored.)
   */
  repeat?: { every: number; times: number; while?: boolean };
  actions: ScenarioAction[];
  /** Shown to the player when it fires (world.messages). */
  message?: string;
  /** Where `message` points (copied onto the world.messages entry). */
  focus?: { x: number; z: number };
}

/** A narrator line. `focus` = the spot it is about: the UI may pan there / ping the minimap. */
export interface WorldMessage {
  at: number;
  text: string;
  focus?: { x: number; z: number };
}

export interface ScenarioRules {
  /** `name` is what the story calls the people ("the Ashmark"); omitted = "the Red tribe". */
  tribes: Array<{ id: TribeId; name?: string; ai: boolean; loadout?: Loadout; allies?: TribeId[]; personality?: AiPersonality }>;
  /** `after`: index of an objective that must be done before this one appears (a story in steps). */
  objectives: Array<{ objective: Objective; text: string; optional?: boolean; after?: number }>;
  fail?: FailCondition[];
  /** Shown before play: a title, a few sentences, and tips. */
  briefing: { title: string; body: string; tips: string[] };
  /** Scripted happenings: raids, betrayals, the sea rising. See sim/scenario-events.ts. */
  events?: ScenarioEvent[];
}

// ---------------------------------------------------------------------------
// What the UI may ask the sim (World implements this)
// ---------------------------------------------------------------------------

export interface SpellState {
  known: boolean;
  charges: number;
  max: number;
  /** 0..1 toward the next charge. */
  progress: number;
  /** Whether mana is being poured into it. */
  charging: boolean;
  /** Free casts from a `gift` monument (spent before real charges). */
  gifted: number;
  /** Estimated seconds to the next charge at the current mana income (Infinity if not charging). */
  eta: number;
  /** Mana per charge for THIS tribe (catalog chargeMana × scenario/boon chargeCost). */
  chargeMana: number;
  /** Charges above the catalog's maxCharges from the scenario/boons (already in `max`). */
  bonusCharges: number;
}

export interface BuildState {
  /** Allowed by the scenario loadout. */
  allowed: boolean;
  /** `requires` satisfied. */
  unlocked: boolean;
  affordable: boolean;
  /** Short reason when it can't be placed now, e.g. "Needs a War Lodge". */
  reason: string | null;
}

export interface TribeSummary {
  wood: number;
  /** Mana per second flowing into spells right now. */
  manaRate: number;
  population: number;
  popCap: number;
  housed: number;
  idleVillagers: number;
  counts: Record<UnitKind, number>;
  praying: number;
  leaderAlive: boolean;
  /** Seconds until the leader returns (0 if alive). */
  leaderRespawn: number;
}

export interface SimQueries {
  spellState(tribe: TribeId, id: SpellId): SpellState;
  setSpellCharging(tribe: TribeId, id: SpellId, on: boolean): void;
  buildState(tribe: TribeId, kind: BuildingKind): BuildState;
  tribeSummary(tribe: TribeId): TribeSummary;
  /** Queue `count` trainees at a training building (negative cancels). Returns the new queue length. */
  queueTraining(buildingId: number, count: number): number;
  /** Where freshly trained units gather. */
  setRally(buildingId: number, x: number, z: number): void;
  /**
   * Send villagers to pray at a shrine / fighters to man a tower. Says who
   * went in and who was turned away (wrong kind, full, no path to the door).
   */
  orderGarrison(unitIds: number[], buildingId: number): { accepted: number[]; refused: number[] };
  /** Would orderGarrison put at least one of these inside right now? (The cursor asks this.) */
  canGarrison(unitIds: number[], buildingId: number): boolean;
  ejectGarrison(buildingId: number): void;
  /** Tear down your own building (refunds half the wood). */
  demolish(buildingId: number): void;
  objectives: ObjectiveState[];
  /** Seconds of sim time since the scenario began. */
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Events the sim emits for the renderer + audio (world.events[].type)
// ---------------------------------------------------------------------------

export const EFFECT_EVENTS = [
  // already emitted and drawn today (render/effects.ts) — keep these names
  'explosion', 'convert', 'lightning', 'swamp', 'quakeStart', 'volcanoStart', 'plume', 'rumbleSmall',
  'shake', 'splash', 'fireball', 'hit', 'death', 'castFlash', 'denied', 'unlock',
  // new
  'wardCast', 'warsongCast', 'cycloneTouch', 'emberStrike', 'sinkRumble', 'bloomCast',
  'chantStart', 'defect', 'dwellingGrow', 'trained', 'built', 'collapse', 'fireStart',
  'giftClaimed', 'objectiveDone', 'leaderDown', 'leaderReturn',
  // the opening + the ritual (fb-opening)
  /** Boats are running in to the beach at (x, z) (magnitude = how many aboard); the crews step ashore LANDING.seconds later. */
  'landing',
  /** A stranded person joined their tribe (tribe = who they joined). */
  'rescued',
  /** A commune began (tribe = communer, magnitude = the spell's tier). Rivals hear it. */
  'communeStart',
  /** A commune broke off before it finished (tribe = communer, magnitude = progress 0..1). */
  'communeInterrupted',
  /** A building site's footprint is being levelled (magnitude = size). */
  'siteLevel',
] as const;
export type EffectEvent = (typeof EFFECT_EVENTS)[number];