/**
 * Chapter 1 — Landfall. The boats are ashore; the sea is not done with us.
 *
 * A power-fantasy opening that teaches the basics by having the leader
 * reshape the world from the first seconds:
 *
 *   1. KIN ON THE SANDBAR. The last boat grounded on a sandbar across a
 *      channel. The leader holds a gifted Causeway: raise a road out of the
 *      sea and they walk across (stranded units join when a route reaches
 *      home). Meanwhile wanderers on the north meadow → Kindle (2 ready).
 *   2. THE LEVELLING SONG. The rescued kin carry the Level chant (taught +
 *      two gifted casts). The only ground near the landing is a rumpled,
 *      boulder-strewn slope: Level it twice, then raise four Dwellings
 *      (builders auto-work; sites level their own footprints).
 *   3. SAILS. With the roofs up, the narrator points at the Black Strand:
 *      Unmoored boats, landing in 40 seconds. The stone above the strand
 *      wakes and lends three Lightnings; Blast throws raiders into the sea.
 *   4. THE HOST. Their first boats beaten, the great fleet comes. It lands
 *      on the Black Strand and MASSES there (spawn `hold`) for a minute and
 *      a half before it marches. The headland stone wakes: kneel there (the
 *      host's scouts may come for you) and it lends ONE Volcano. Wake the
 *      mountain under the host — the strand becomes a mountain for good.
 *
 * Nobody is soft-locked: a Causeway that missed is lent again while the kin
 * wait; Level and Kindle are taught and recharge; both stones lend again
 * after a cooldown; a host that marches before the Volcano lands can still
 * be broken with Lightning, Blast and the villagers, who fight back.
 *
 * Fail: ten villagers dead (a scripted `killed` → `defeat`). Optional:
 * lose nobody, Kindle every wanderer, bury the host with the Volcano,
 * win inside twelve minutes.
 *
 * The map: "the Hook" — a rounded island; the landing (home) on its west
 * shore facing the sandbar across a narrow channel; the north meadow with
 * wanderers; a rumpled slope east of the landing; the Black Strand, a broad
 * beach in the south-east, watched by a stone on a headland.
 */

import { hash2 } from '../../core/noise';
import type { ScenarioEvent } from '../../sim/catalog';
import { smoothstep } from '../../core/util';
import { dist, inside, lineDist, Terrain, wanderers } from '../terrain-kit';
import { CampaignScenario, makeLevel, RAIDER_TRIBE } from './common';

export const LAYOUT = {
  home: { x: 46, z: 66 },
  /** The kin's sandbar, across the channel to the west. */
  sandbar: { x: 25, z: 64 },
  /** Where the leader stands to raise the Causeway (west shore). */
  shore: { x: 39, z: 65 },
  meadow: { x: 50, z: 47 },
  meadow2: { x: 73, z: 47 },
  /** The hillside east of the landing — the building ground, once Levelled. */
  slope: { x: 57, z: 70 },
  slopeRadius: 15,
  /** Stone above the strand: Lightning (gift). */
  lightning: { x: 55, z: 82 },
  /** The Black Strand: where raiders come ashore and the host masses. */
  landing: { x: 81, z: 101 },
  strand: { x: 74, z: 93 },
  /** The headland stone: one Volcano (gift). */
  headland: { x: 87, z: 85 },
};

const KIN = { brave: 4, warrior: 2 };
/** The crater walls: they start WALL_IN tiles from home, climb WALL_SLOPE per tile for WALL_W tiles, then fall away as steeply. */
const WALL_IN = 3.5;
const WALL_W = 4;
const WALL_SLOPE = 2.4;
/** How steeply the floor falls to the sea through the gap (per tile). */
const SHINGLE = 1.8;
const WAVE = 4;
export const HUTS = 4;
/** The great fleet: big enough to read as a host on the strand, small enough to be broken without the Volcano by a player who missed it. */
const HOST = { warrior: 10, firewarrior: 2 };
export const HOST_HOLD = 95;
/** Seconds from the first raid's end to the host coming ashore (the fleet is on the horizon meanwhile). */
const FLEET_DELAY = 60;
/** A spent Causeway that left the kin stranded is lent again after this long. */
const CAUSEWAY_AGAIN = 30;
/** The headland stone lends its Volcano again after this long (a missed or wasted cast is not the end). */
const VOLCANO_AGAIN = 100;

/** Objective indices (events refer to them). */
const O = { kin: 0, kindle: 1, level: 2, huts: 3, raid: 4, stone: 5, host: 6 };

export const scenario: CampaignScenario = {
  id: 'c01_landfall',
  chapter: 1,
  title: '登陆',
  tagline: '自海中筑起一条路。然后，一座山。',
  teaches: '石道、感化、平整、民居、冲击与闪电、一则大术',
  async build() {
    const t = new Terrain(10101);
    const { home, sandbar, meadow, meadow2, slope, lightning, strand, headland, landing } = LAYOUT;
    t.landFrom((x, z) => {
      const main = inside(Math.hypot((x - 64) / 27, (z - 72) / 31) * 30 + t.wobble(x, z, 1) * 3, 30, 5);
      const cape = inside(lineDist(x, z, [{ x: 80, z: 82 }, { x: 90, z: 85 }]) + t.wobble(x, z, 2) * 1.2, 5, 3);
      const bar = inside(dist(x, z, sandbar.x, sandbar.z) + t.wobble(x, z, 3) * 1.2, 5, 2.5);
      return Math.max(main, cape, bar);
    }, { base: 2.6, roll: 0.9 });
    // The cove: the landing sits at the bottom of an old crater whose west
    // wall the sea broke long ago. The walls rise steadily all round — easy
    // to climb, nowhere flat enough for a Dwelling — until Level cuts shelves
    // into them. (Cone profile: a constant slope has no flat spots, unlike a
    // rounded hill's crown and foot.)
    t.apply((x, z, h) => {
      if (h < 0.3) return h;
      const d = dist(x, z, home.x, home.z);
      const c = Math.cos(Math.atan2(z - home.z, x - home.x)); // −1 = due west, the sea gap
      const f = smoothstep(-0.97, -0.82, c);
      const up = Math.min(Math.max(0, d - WALL_IN), WALL_W) - Math.max(0, d - WALL_IN - WALL_W);
      const wall = Math.max(0, up) * WALL_SLOPE;
      const stony = (hash2(x, z, 5151) - 0.5) * 0.8;
      const walled = h + (wall + (wall > 0 ? stony : 0)) * f;
      // Through the gap the cove floor drops straight to the water: a steep shingle, no building ground.
      const shingle = Math.min(walled, 2.8 - SHINGLE * Math.max(0, d - WALL_IN));
      return walled + (shingle - walled) * (1 - f);
    });
    t.pad(home.x, home.z, 3, 2.8, 1.5);
    // The sandbar: low and flat — the tide is at its edges.
    t.pad(sandbar.x, sandbar.z, 3, 0.9, 2);
    // The Black Strand: a broad flat beach.
    t.pad(strand.x, strand.z, 6, 1.0, 4).pad(landing.x, landing.z, 3, 0.7, 3);
    // The headland: a high shelf above the strand, its stone on top.
    t.mesa(headland.x, headland.z, 3.5, 4.2, 2.5);
    t.pad(headland.x, headland.z, 2, 4.4, 2);
    t.addGrove(home.x - 6, home.z - 9, 6, 0.8).addGrove(home.x - 3, home.z + 11, 6, 0.8)
      .addGrove(slope.x + 8, slope.z - 12, 7, 0.6).addGrove(meadow2.x + 6, meadow2.z + 8, 6, 0.5);
    const raid = (n: number) => ({ type: 'spawn' as const, tribe: 'violet' as const, units: { warrior: n }, x: landing.x, z: landing.z, march: home });
    const events: ScenarioEvent[] = [
      { when: { type: 'time', at: 2 }, message: '沙洲上的族人！最后一条船在对岸水道搁浅了。为他们筑起一条石道。', focus: sandbar, actions: [] },
      { when: { type: 'time', at: 20 }, message: '北边草甸上有漂泊者。用感化让他们加入部落。', focus: meadow, actions: [] },
      // Recovery: a Causeway that missed (or was spent elsewhere) leaves the kin
      // stranded for good — so while they still wait and no Causeway is in
      // hand, the tide-song lends another.
      {
        when: { type: 'all', of: [{ type: 'not', of: { type: 'objective', index: O.kin } }, { type: 'noCasts', spell: 'landbridge' }] },
        repeat: { every: CAUSEWAY_AGAIN, times: 8, while: true },
        message: '族人仍在对岸水道边等候。潮汐之歌再予你一条石道——从岸边直指沙洲。',
        focus: sandbar,
        actions: [{ type: 'gift', tribe: 'player', spell: 'landbridge', charges: 1 }],
      },
      {
        when: { type: 'objective', index: O.kin },
        message: '族人们回来了——他们还记得平整的吟唱。在山坡上开出平台，让村落得以拔地而起。',
        focus: slope,
        actions: [{ type: 'teach', tribe: 'player', spell: 'flatten' }, { type: 'gift', tribe: 'player', spell: 'flatten', charges: 2 }],
      },
      { when: { type: 'objective', index: O.level }, message: '好一片平地。在上面放置民居——村民们会自己动手建造。', focus: slope, actions: [] },
      // The first sails: a visible countdown, and the strand stone wakes.
      {
        when: { type: 'objective', index: O.huts },
        message: '黑沙滩外有船帆！无根族的掠夺者，四十五次心跳后上岸。沙滩上方的石阵苏醒了：在那里跪下，换取闪电。',
        focus: strand,
        actions: [{ type: 'openStone', index: 0 }],
      },
      { when: { type: 'objective', index: O.huts }, delay: 45, message: '他们的船正冲向黑沙滩！用冲击轰击刚上岸的敌人。', focus: landing, actions: [raid(WAVE)] },
      // The host.
      {
        when: { type: 'objective', index: O.raid },
        delay: 8,
        message: '海平线上满是船帆——无根族的整支舰队。海角石阵正燃着那座山的火焰：在那里跪下，它会借你一次火山。',
        focus: headland,
        actions: [{ type: 'openStone', index: 1 }],
      },
      {
        when: { type: 'objective', index: O.raid },
        delay: FLEET_DELAY,
        message: '大部队正在黑沙滩登陆。他们会在列阵之后才进军——把火山唤到他们脚下！',
        focus: strand,
        actions: [{ type: 'spawn', tribe: 'violet', units: HOST, x: landing.x, z: landing.z, march: strand, hold: HOST_HOLD }],
      },
      {
        // The host was not buried: it is about to march. The strand stone wakes again so the
        // village is not left to spears alone (a missed or late Volcano is not the end).
        when: { type: 'objective', index: O.raid },
        delay: FLEET_DELAY + HOST_HOLD - 15,
        unless: { type: 'spellCast', spell: 'volcano', x: strand.x, z: strand.z, radius: 9 },
        message: '沙滩上响起了战鼓——大部队即将向村落进军！两座石阵再次苏醒：沙洲上方的闪电，与岬角上的火山。',
        focus: strand,
        actions: [{ type: 'openStone', index: 0 }, { type: 'openStone', index: 1 }],
      },
      { when: { type: 'spellCast', spell: 'volcano', x: strand.x, z: strand.z, radius: 9 }, delay: 3, message: '黑沙滩如今已是一座山。让无根族去讲给他们的孩子听吧。', focus: strand, actions: [] },
      // Fail: too many of us fall.
      { when: { type: 'killed', tribe: 'player', count: 10, kind: 'brave' }, actions: [{ type: 'defeat', reason: '十名族人倒在了沙滩上。灯民只得回到船上，再次远航。' }] },
    ];
    return makeLevel({
      name: '登陆',
      desc: '战役一。沙洲上的族人、待平整的山坡，还有海平线上无根族的舰队。',
      terrain: t,
      homes: { player: home, violet: landing },
      monuments: [
        { x: lightning.x, z: lightning.z, spell: 'lightning', mode: 'gift', charges: 3, cooldown: 75, asleep: true },
        { x: headland.x, z: headland.z, spell: 'volcano', mode: 'gift', charges: 1, cooldown: VOLCANO_AGAIN, asleep: true, communeSeconds: 14 },
      ],
      units: [
        { tribe: 'player', joins: 'player', kind: 'brave', x: sandbar.x, z: sandbar.z, count: KIN.brave },
        { tribe: 'player', joins: 'player', kind: 'warrior', x: sandbar.x + 1, z: sandbar.z + 1, count: KIN.warrior },
      ],
      wildmen: wanderers(t.map, 11, meadow.x, meadow.z, 3, 5).concat(wanderers(t.map, 12, meadow2.x, meadow2.z, 3, 3)),
      treeDensity: 0.015,
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert'],
              gifts: { landbridge: 1 },
              buildings: ['hut', 'lumberyard'],
              startUnits: { brave: 6 },
              startWood: 15,
            },
          },
          { id: 'violet', name: '无根族', ...RAIDER_TRIBE },
        ],
        objectives: [
          { objective: { type: 'rescueStranded', count: KIN.brave + KIN.warrior }, text: '为沙洲上的族人筑起一条石道' },
          { objective: { type: 'convertWanderers', count: 3 }, text: '感化北边草甸上的漂泊者' },
          { objective: { type: 'castSpell', spell: 'flatten', count: 2, x: slope.x, z: slope.z, radius: LAYOUT.slopeRadius }, text: '平整山坡（两次）', after: O.kin },
          { objective: { type: 'buildCount', kind: 'hut', count: HUTS }, text: `建起${HUTS}座民居`, after: O.level },
          { objective: { type: 'killUnits', tribe: 'violet', count: WAVE - 1 }, text: '将沙洲上的掠夺者赶下海', after: O.huts },
          { objective: { type: 'claimMonument', index: 1 }, text: '在海角石阵前跪下', after: O.raid },
          { objective: { type: 'killUnits', tribe: 'violet', count: 9 }, text: '击溃无根族的大部队', after: O.raid },
          { objective: { type: 'castSpell', spell: 'volcano', x: strand.x, z: strand.z, radius: 9 }, text: '用一座火山埋葬来袭的大军', optional: true, after: O.raid },
          { objective: { type: 'loseAtMost', count: 0, kind: 'brave' }, text: '不损失任何村民', optional: true },
          { objective: { type: 'convertWanderers', count: 8 }, text: '感化海钩上的每一名漂泊者', optional: true },
          { objective: { type: 'winWithin', seconds: 720 }, text: '在12分钟内获胜', optional: true },
        ],
        events,
        briefing: {
          title: '登陆',
          body:
            '长潮吞没了旧日海岸，船只把灯民带到了这钩形土地上。' +
            '最后一条船在对岸水道搁浅，海水正在它四周上涨。' +
            '你是他们的首领，大地会听从你的号令：从海中筑起一条路，为屋舍开出一片地——并保持警惕，因为无根族掠夺每一座升起炊烟的海岸。',
          tips: [
            '选中你的首领，选择一个法术（或按它的快捷键），然后点击目标位置。石道会从她脚下延伸到你指定的地点。',
            '在立石前跪下，以获取它提供的力量——但跪拜中的首领毫无防备，任何一击都会打断仪式。',
            '如果十名村民倒下，登陆便告失败。别让掠夺者靠近村落。',
          ],
        },
      },
    });
  },
};