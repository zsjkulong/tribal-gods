/**
 * Chapter 2 — The Speaking Stones. First stones, first raiders.
 *
 * Teaches: communing is a ritual, not a click — the leader kneels,
 * helpless, and any blow breaks it. Each stone is a small set piece:
 *   - the Bloom stone in the old wood has GUARDIANS — wood-wights that
 *     sleep until someone kneels. Bring the two spear-bearers (or Blast
 *     them first).
 *   - the Level stone across the river takes a long ritual, and the
 *     Unmoored see it: the moment she kneels, a boat beaches below the
 *     knoll and its crew run at her. Guard the leader or lose the ritual.
 * Then a garrisoned Watchtower and Blast hold the ford through the raids.
 * First minute: Kindle the wanderers on the near bank (two charges ready).
 *
 * The map: "Riverholm", a long island split by a cold river running from
 * the northern fells to the southern sea. The one ford sits mid-island.
 * The village is on the west bank by the old wood (and the Bloom stone);
 * the Level stone crowns a knoll on the east bank — the side the
 * Unmoored land on. Each raid comes over the ford.
 */

import { inside, Terrain, wanderers } from '../terrain-kit';
import { CampaignScenario, makeLevel, RAIDER_TRIBE } from './common';

export const LAYOUT = {
  home: { x: 36, z: 70 },
  bloom: { x: 24, z: 58 },
  level: { x: 88, z: 60 },
  ford: { x: 63, z: 64 },
  landing: { x: 106, z: 74 },
  /** Wanderers' camp on our bank: the first-minute Kindle. */
  camp: { x: 44, z: 80 },
  /** Where the boat that saw the ritual beaches. */
  cove: { x: 104, z: 58 },
  river: [
    { x: 66, z: 30 },
    { x: 60, z: 52 },
    { x: 64, z: 64 },
    { x: 69, z: 80 },
    { x: 62, z: 104 },
  ],
};

/**
 * Seconds to weather. Eight minutes, not ten: both stones fall by ~3 min for
 * a prompt player, and three raids 2 min apart keep the leader striking at
 * the ford to the end instead of waiting out an empty last stretch.
 */
const SURVIVE = 480;

const raid = (at: number, warriors: number, message: string) => ({
  when: { type: 'time' as const, at },
  message,
  actions: [{ type: 'spawn' as const, tribe: 'violet' as const, units: { warrior: warriors }, x: LAYOUT.landing.x, z: LAYOUT.landing.z, march: LAYOUT.ford }],
});

export const scenario: CampaignScenario = {
  id: 'c02_speaking_stones',
  chapter: 2,
  title: '会言之石',
  tagline: '两座记得过去的石阵。以及东海上扬起的帆。',
  teaches: '石阵、瞭望塔、第一次掠夺',
  async build() {
    const t = new Terrain(20202);
    const { home, bloom, level, ford, river } = LAYOUT;
    t.landFrom((x, z) => {
      const dx = (x - 64) / 50;
      const dz = (z - 66) / 31;
      return inside(Math.hypot(dx, dz) * 40 + t.wobble(x, z, 1) * 12, 40, 7);
    }, { base: 2.2, roll: 1.6 });
    // The northern fells the river runs out of.
    t.ridge([{ x: 30, z: 44 }, { x: 50, z: 36 }, { x: 78, z: 36 }, { x: 100, z: 46 }], 11, 9, 0.5);
    t.peak(level.x + 2, level.z - 2, 10, 3.2);
    t.smooth(1);
    t.channel(river, 6, -2.2, 2.5);
    t.road([{ x: ford.x - 8, z: ford.z - 1 }, { x: ford.x + 8, z: ford.z + 1 }], 5, 0.8);
    t.pad(home.x, home.z, 8, 2.4, 5);
    t.addGrove(bloom.x, bloom.z, 12, 0.8).addGrove(home.x + 8, home.z + 12, 8, 0.5).addGrove(84, 82, 10, 0.4);
    return makeLevel({
      name: '会言之石',
      desc: '战役二。河心岛、两座石阵、来自东方的掠夺者。',
      terrain: t,
      homes: { player: home, violet: LAYOUT.landing },
      monuments: [
        { x: bloom.x, z: bloom.z, spell: 'bloom', mode: 'teach', guards: { warrior: 2 } },
        { x: level.x, z: level.z, spell: 'flatten', mode: 'teach', communeSeconds: 25 },
      ],
      wildmen: wanderers(t.map, 21, 86, 78, 10, 5).concat(wanderers(t.map, 22, LAYOUT.camp.x, LAYOUT.camp.z, 3, 4)),
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: { spells: ['blast', 'convert'], buildings: ['hut', 'lumberyard', 'tower'], startUnits: { brave: 7, warrior: 4 }, startWood: 12 },
          },
          { id: 'violet', name: '无根族', ...RAIDER_TRIBE },
        ],
        objectives: [
          { objective: { type: 'claimMonument', index: 0 }, text: '在西岸石阵学会萌发' },
          { objective: { type: 'claimMonument', index: 1 }, text: '在河对岸的石阵学会平整' },
          { objective: { type: 'survive', seconds: SURVIVE }, text: '撑过掠夺狂潮（8分钟）' },
          { objective: { type: 'buildCount', kind: 'tower', count: 1 }, text: '在渡口建起一座瞭望塔', optional: true },
          { objective: { type: 'reachPopulation', count: 30 }, text: '让部族壮大到30人', optional: true },
          { objective: { type: 'convertWanderers', count: 4 }, text: '感化岸边的漂泊者', optional: true },
        ],
        events: [
          { when: { type: 'time', at: 2 }, message: '岸边宿着一群漂泊者，向南走几步就到。用感化让他们加入部落。', focus: LAYOUT.camp, actions: [] },
          { when: { type: 'time', at: 25 }, message: '老林里的石阵有东西守着。谁在那里跪下，谁就会唤醒它的守护者——带上长矛。', focus: LAYOUT.bloom, actions: [] },
          {
            when: { type: 'commune', index: 1, tribe: 'player' },
            message: '山丘下泊来一条船——无根族看到了这场仪式！保护首领：只要挨一下，仪式就断了。',
            focus: LAYOUT.cove,
            actions: [{ type: 'spawn', tribe: 'violet', units: { warrior: 2 }, x: LAYOUT.cove.x, z: LAYOUT.cove.z, march: LAYOUT.level, hold: 40 }],
          },
          // The first raid waits for the knoll: it comes 20 s after the Level stone is learned, or at 3:20
          // at the latest. At a fixed 2:40 it landed on top of a slower player's knoll ritual, drew the
          // escort off after it, and the boat crew cut the kneeling leader down.
          { ...raid(0, 2, '东海滩上出现了帆影——无根族正朝渡口扑来。'), when: { type: 'any', of: [{ type: 'objective', index: 1 }, { type: 'time', at: 180 }] }, delay: 20 },
          raid(290, 3, '更多的无根族船只。他们闻到了你炉膛里的烟火味。'),
          raid(410, 4, '迄今为止最大的一条船。守住渡口！'),
          { when: { type: 'time', at: SURVIVE }, actions: [{ type: 'message', text: '掠夺者转身退回大海。河心屿是你们的了。' }] },
        ],
        briefing: {
          title: '会言之石',
          body:
            '河心屿上的石阵比任何部族都要古老，古老的歌谣说，哪位首领与石阵相伴而坐，离去时便会知晓一道法术。' +
            '一座矗立在我们岸边的老林中；另一座则冠于冷河对岸的山丘之上。' +
            '我们不是头一批发现这座岛的船。无根族的岛屿比我们先沉没，他们劫掠每一座升起炊烟的海岸——而此地唯一的渡口就是那条水道。',
          tips: [
            '在石阵前，你的首领会跪拜片刻以学会它的法术——但跪拜之中的首领毫无防备，一击便会打断仪式。',
            '你的持矛战士站在瞭望塔里战斗最为得力——命令他们进去，守在渡口附近。',
            '冲击可以把掠夺者掀飞出去；被抛进河里，他们就会淹死。',
          ],
        },
      },
    });
  },
};