/**
 * Chapter 6 — The Barefoot Road. No buildings at all.
 *
 * Teaches: the leader and a war band are the whole tribe. No village, no
 * mana from homes — only the band's own bodies feed the spells, so Kindling
 * wanderers is how you charge faster. Stone Ward and Blast keep the band
 * alive; a gift stone in a side valley lends Lightning. If the leader
 * dies there is no return: the pilgrimage fails.
 *
 * The map: "the Long Gorge" — one winding valley between walls of rock,
 * from a western landing beach to the Cairn of First Fire at the far
 * eastern end. The Ashmark keep a watch along it: spearmen on the valley
 * floor, garrisoned towers on the bends. A side valley branches south to
 * the Lightning stone and a wanderers' camp.
 */

import { dist, inside, lineDist, Terrain, wanderers } from '../terrain-kit';
import { CampaignScenario, makeLevel } from './common';

export const LAYOUT = {
  landing: { x: 16, z: 72 },
  cairn: { x: 108, z: 57 },
  gorge: [
    { x: 8, z: 72 },
    { x: 30, z: 66 },
    { x: 48, z: 76 },
    { x: 68, z: 60 },
    { x: 88, z: 68 },
    { x: 104, z: 58 },
    { x: 112, z: 56 },
  ],
  side: [
    { x: 48, z: 76 },
    { x: 44, z: 92 },
    { x: 50, z: 104 },
  ],
  lightning: { x: 50, z: 104 },
  watchHome: { x: 100, z: 60 },
};

export const scenario: CampaignScenario = {
  id: 'c06_barefoot_road',
  chapter: 6,
  title: '赤足之路',
  tagline: '没有屋顶，没有田亩。只有一位首领、一支战团，和一条漫长的峡谷。',
  teaches: '不建任何建筑：一支战团、庇护、以感化换取灵能',
  async build() {
    const t = new Terrain(60606);
    const { gorge, side, cairn, landing, lightning } = LAYOUT;
    // Everything near the gorge is land; the rest is sea.
    t.landFrom((x, z) => inside(Math.min(lineDist(x, z, gorge), lineDist(x, z, side) + 3) + t.wobble(x, z, 1) * 6, 18, 6), { base: 3, roll: 1.2 });
    // Walls: high, steep rock everywhere off the valley floor, falling
    // straight into the sea (no beach to sneak round the outside on).
    t.apply((x, z, h) => {
      const d = Math.min(lineDist(x, z, gorge), lineDist(x, z, side));
      if (d > 9 && h < 2.5) return -2.5;
      if (h <= 0.5) return h;
      const wall = (1 - inside(d + t.wobble(x, z, 5) * 1.5, 6.5, 3)) * (11 + t.n(x, z, 6) * 6);
      return h + wall;
    });
    t.smooth(1);
    t.road(gorge, 7, 3);
    t.road(side, 6, 3);
    t.pad(landing.x, landing.z, 5, 2.2, 4).pad(cairn.x, cairn.z, 4, 4, 4).pad(lightning.x, lightning.z, 4, 3, 3);
    // The landing beach: let the gorge mouth run down to the sea.
    t.apply((x, z, h) => (dist(x, z, 6, 72) < 6 ? Math.min(h, 1.2 + dist(x, z, 6, 72) * 0.2) : h));
    t.addGrove(48, 96, 6, 0.5).addGrove(30, 68, 4, 0.4).addGrove(84, 66, 4, 0.3);
    const W = LAYOUT.watchHome;
    return makeLevel({
      name: '赤足之路',
      desc: '战役六。不建任何建筑：把首领活着带过长峡。',
      terrain: t,
      homes: { player: landing, red: W },
      civs: { red: 'north' },
      monuments: [
        { x: lightning.x, z: lightning.z, spell: 'lightning', mode: 'gift', charges: 3, cooldown: 600 },
        { x: cairn.x, z: cairn.z, spell: 'emberfall', mode: 'teach', communeSeconds: 25 },
      ],
      buildings: [
        { tribe: 'red', kind: 'tower', x: 68, z: 55, garrison: { warrior: 1, firewarrior: 1 } },
        { tribe: 'red', kind: 'tower', x: 89, z: 73, garrison: { warrior: 2 } },
        { tribe: 'red', kind: 'tower', x: 101, z: 64, garrison: { firewarrior: 2 } },
      ],
      units: [
        { tribe: 'red', kind: 'warrior', x: 38, z: 70, count: 2 },
        { tribe: 'red', kind: 'warrior', x: 60, z: 66, count: 3 },
        { tribe: 'red', kind: 'warrior', x: 80, z: 64, count: 3 },
        { tribe: 'red', kind: 'firewarrior', x: 84, z: 66, count: 1 },
        { tribe: 'red', kind: 'warrior', x: 97, z: 61, count: 4 },
        { tribe: 'red', kind: 'warden', x: 105, z: 57, count: 1 },
      ],
      wildmen: wanderers(t.map, 61, 46, 98, 6, 6),
      treeDensity: 0.012,
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert', 'ward'],
              buildings: [],
              startUnits: { brave: 0, warrior: 6, firewarrior: 2 },
            },
          },
          { id: 'red', name: '灰痕族', ai: false, loadout: { spells: [], buildings: [], startUnits: { shaman: 0, brave: 0 } } },
        ],
        objectives: [
          { objective: { type: 'claimMonument', index: 1 }, text: '把首领带到初火之石冢' },
          { objective: { type: 'destroyTribe', tribe: 'red' }, text: '不留下任何一个灰痕族的岗哨', optional: true },
          { objective: { type: 'claimMonument', index: 0 }, text: '从侧谷的石阵取得闪电', optional: true },
        ],
        fail: [{ type: 'leaderDies' }],
        events: [
          { when: { type: 'time', at: 2 }, message: '两名灰痕族的长矛把守峡谷口。给战团套上庇护，然后用冲击把他们轰下大路。', focus: { x: 38, z: 70 }, actions: [] },
          {
            when: { type: 'commune', index: 1, tribe: 'player' },
            message: '峡谷尽头响起了号角——灰痕族的驻军正朝跪拜的首领扑来。挡住他们！',
            focus: { x: 112, z: 56 },
            actions: [{ type: 'spawn', tribe: 'red', units: { warrior: 3, firewarrior: 1 }, x: 116, z: 56, march: LAYOUT.cairn }],
          },
        ],
        briefing: {
          title: '赤足之路',
          body:
            '初火之石冢立在长峡的那一头，无论谁与它相伴而坐，都能学会召引燃烧之石自天而降。' +
            '峡谷里没有可建的地面，也没有时间去试。我们的首领先行上路，带着八名持矛者与掷火者，走上一条灰痕族注视的山谷。' +
            '若她在路上倒下，便没有石环能让她归来。小心行走。',
          tips: [
            '没有民居就等于没有多少灵能：每多一名追随者，都会多出一点涓流。感化侧谷里的漂泊者，可以充得更快。',
            '开战前给战团套上石之庇护，能让他们承受的伤害减半。让首领待在长矛之后。',
            '掷火者的射程比塔上守军的长矛更远——在塔的射程外停下脚步，让他们干活。',
          ],
        },
      },
    });
  },
};