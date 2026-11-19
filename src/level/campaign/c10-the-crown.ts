/**
 * Chapter 10 — The Crown. Three rivals, everything unlocked, last tribe standing.
 *
 * Tests: everything. Every building, the full everyday spell book, the
 * planet-breakers on stones around the ring — and three gods with three
 * temperaments: the Ashmark attack early and often, the Saltborn build
 * slowly toward Wardens, the Unmoored send Chanters. The Volcano stone is
 * on the Crown in the middle of the lagoon, reachable only by Causeway.
 *
 * The map: the last ring of land above the Long Tide — an atoll-like ring
 * island around a still lagoon, with the Crown, a steep islet, at its
 * heart. Four peoples sit on the ring a quarter-turn apart; low hills on
 * the diagonals split the ring into four marches with passes inside and
 * outside each hill.
 */

import { dist, inside, polar, Terrain, wanderers } from '../terrain-kit';
import { CampaignScenario, makeLevel } from './common';

const C = { x: 64, z: 64 };
const RING_R = 33;

export const LAYOUT = {
  centre: C,
  home: polar(C.x, C.z, RING_R, 90),
  red: polar(C.x, C.z, RING_R, 180),
  gold: polar(C.x, C.z, RING_R, 270),
  violet: polar(C.x, C.z, RING_R, 0),
  stones: {
    crown: C,
    // Beside each diagonal hill, on the outer pass.
    emberfall: polar(C.x, C.z, RING_R + 7, 135),
    cyclone: polar(C.x, C.z, RING_R + 7, 45),
    sink: polar(C.x, C.z, RING_R + 7, 225),
    earthquake: polar(C.x, C.z, RING_R + 7, 315),
  },
};

export const scenario: CampaignScenario = {
  id: 'c10_the_crown',
  chapter: 10,
  title: '王冠',
  tagline: '潮水之上最后一圈陆地。四个部族。只有一个能留下。',
  teaches: '一切：成为最后存活的部族',
  async build() {
    const t = new Terrain(101010);
    const { home, red, gold, violet, stones } = LAYOUT;
    t.landFrom((x, z) => {
      const d = dist(x, z, C.x, C.z) + t.wobble(x, z, 1) * 9;
      const ring = inside(Math.abs(d - RING_R), 11, 5);
      const crown = inside(dist(x, z, C.x, C.z) + t.wobble(x, z, 2) * 2, 6, 3);
      return Math.max(ring, crown);
    }, { sea: -4, base: 2.3, roll: 1.4 });
    // Hills on the diagonals (with the stones beside them), passes inside and out.
    for (const a of [45, 135, 225, 315]) {
      const p = polar(C.x, C.z, RING_R, a);
      t.peak(p.x, p.z, 7, 8);
    }
    t.peak(C.x, C.z, 6, 6);
    t.smooth(1);
    t.pad(C.x, C.z, 2, 7.5, 2);
    for (const h of [home, red, gold, violet]) t.pad(h.x, h.z, 8, 2.5, 4);
    for (const p of [stones.emberfall, stones.cyclone, stones.sink, stones.earthquake]) t.pad(p.x, p.z, 2, 2.6, 3);
    for (const h of [home, red, gold, violet]) {
      const a = Math.atan2(h.z - C.z, h.x - C.x) * (180 / Math.PI);
      const g1 = polar(C.x, C.z, RING_R + 6, a + 14);
      const g2 = polar(C.x, C.z, RING_R - 6, a - 14);
      t.addGrove(g1.x, g1.z, 8, 0.7).addGrove(g2.x, g2.z, 7, 0.6);
    }
    const S = stones;
    return makeLevel({
      name: '王冠',
      desc: '战役十。一座环湖之岛，四个部族，王冠上的火山。',
      terrain: t,
      homes: { player: home, red, gold, violet },
      civs: { red: 'north', gold: 'dynasty', violet: 'north' },
      monuments: [
        { x: S.crown.x, z: S.crown.z, spell: 'volcano', mode: 'teach' },
        { x: S.emberfall.x, z: S.emberfall.z, spell: 'emberfall', mode: 'gift', charges: 1, cooldown: 240 },
        { x: S.cyclone.x, z: S.cyclone.z, spell: 'cyclone', mode: 'teach' },
        { x: S.sink.x, z: S.sink.z, spell: 'sink', mode: 'gift', charges: 1, cooldown: 300 },
        { x: S.earthquake.x, z: S.earthquake.z, spell: 'earthquake', mode: 'teach' },
      ],
      wildmen: wanderers(t.map, 101, S.emberfall.x, S.emberfall.z, 6, 3)
        .concat(wanderers(t.map, 102, S.cyclone.x, S.cyclone.z, 6, 3))
        .concat(wanderers(t.map, 103, S.sink.x, S.sink.z, 6, 3))
        .concat(wanderers(t.map, 104, S.earthquake.x, S.earthquake.z, 6, 3))
        .concat(wanderers(t.map, 105, home.x + 10, home.z - 3, 3, 4)),
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert', 'flatten', 'bloom', 'ward', 'lightning', 'warsong', 'swamp', 'landbridge'],
              startUnits: { brave: 10 },
              startWood: 14,
            },
          },
          {
            id: 'red', name: '灰痕族', ai: true,
            personality: { harassAt: 4, assaultAt: 9 },
            loadout: { spells: ['blast', 'convert', 'lightning', 'warsong'], startUnits: { brave: 9 } },
          },
          {
            id: 'gold', name: '盐裔', ai: true,
            personality: { harassAt: 7, assaultAt: 15, prefer: ['warden', 'firewarrior', 'warrior'] },
            loadout: { spells: ['blast', 'convert', 'ward', 'swamp'], startUnits: { brave: 9 } },
          },
          {
            id: 'violet', name: '无根族', ai: true,
            personality: { harassAt: 5, assaultAt: 11, prefer: ['chanter', 'warrior'] },
            loadout: { spells: ['blast', 'convert', 'lightning', 'bloom'], startUnits: { brave: 9 } },
          },
        ],
        objectives: [
          { objective: { type: 'destroyAll' }, text: '成为最后存活的部族' },
          { objective: { type: 'claimMonument', index: 0 }, text: '在王冠之巅学会火山', optional: true },
        ],
        events: [
          { when: { type: 'time', at: 2 }, message: '村子东岸有漂泊者。感化他们——环形诸石阵正在等待，也正被守卫着。', focus: { x: LAYOUT.home.x + 10, z: LAYOUT.home.z - 3 }, actions: [] },
          { when: { type: 'commune', index: 0 }, message: '有人跪在了王冠之上。谁完成那场仪式，谁就握住了山峦之火。', focus: LAYOUT.centre, actions: [] },
        ],
        briefing: {
          title: '王冠',
          body:
            '这是长潮尚未夺走的最后一圈陆地，每一个熬过来的部族都在这里：西边的灰痕族，北边的盐裔，东边的无根族。' +
            '宁静的环湖中央矗立着王冠，山峦之火的石阵在其之上。环岛四周，大地震动、风暴与暗流的石阵，正等待走向它们的人。' +
            '我们所学的一切尽可放手使用。过了这片海岸，就再无海岸。',
          tips: [
            '灰痕族会早早来攻。先造瞭望塔和战士，野心次之。',
            '只有石道能抵达王冠。从中心释放的火山，能覆盖环上任何一座城镇。',
            '三个对手彼此也在争斗。但凡能让他们斗下去，就让他们斗。',
          ],
        },
      },
    });
  },
};