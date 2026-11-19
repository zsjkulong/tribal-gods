/**
 * Chapter 4 — The Scattered Shallows. An island start; Causeway is a gift.
 *
 * Teaches: Causeway raises a road across water — but you don't know the
 * spell. A gift stone on your isle hands out two casts and then sleeps for
 * a long time. Two gaps stand between you and the Ashmark: every cast
 * matters (bridge in the wrong place and you wait). Also: the Ember Lodge.
 *
 * The map: three isles in a shallow sea. Ours in the west is small and
 * crowded with trees; the Holm in the middle holds a Stone Ward stone and
 * a band of wanderers; the Ashmark have the big eastern isle. A scatter
 * of skerries makes it look like a place, not a diagram — none of them
 * shortens a gap.
 */

import { dist, inside, Terrain, wanderers } from '../terrain-kit';
import { CampaignScenario, makeLevel } from './common';

export const LAYOUT = {
  home: { x: 22, z: 64 },
  causewayStone: { x: 30, z: 54 },
  holm: { x: 64, z: 62 },
  red: { x: 102, z: 64 },
  /** The intended bridges: shore to shore, each inside Causeway's reach. */
  bridges: [
    { from: { x: 37, z: 62 }, to: { x: 57, z: 62 } },
    { from: { x: 74, z: 62 }, to: { x: 90, z: 63 } },
  ],
};

const ISLES = [
  { x: 25, z: 64, r: 14 },
  { x: 64, z: 62, r: 11 },
  { x: 102, z: 64, r: 17 },
];
const SKERRIES = [
  { x: 46, z: 30, r: 3.5 }, { x: 84, z: 96, r: 4.5 }, { x: 60, z: 100, r: 3 },
  { x: 36, z: 94, r: 3 }, { x: 86, z: 28, r: 4 }, { x: 64, z: 22, r: 2.5 },
];

export const scenario: CampaignScenario = {
  id: 'c04_scattered_shallows',
  chapter: 4,
  title: '星罗浅滩',
  tagline: '三座岛屿、两道水堑，还有一座借你两条石桥的石阵。',
  teaches: '以赠礼习得石道、余烬木屋、精打细算每一道法术',
  async build() {
    const t = new Terrain(40404);
    const { home, causewayStone, holm, red } = LAYOUT;
    t.landFrom((x, z) => {
      let m = 0;
      for (const i of ISLES) m = Math.max(m, inside(dist(x, z, i.x, i.z) + t.wobble(x, z, 1) * 5, i.r, 5));
      for (const s of SKERRIES) m = Math.max(m, inside(dist(x, z, s.x, s.z) + t.wobble(x, z, 2) * 2, s.r, 3));
      return m;
    }, { sea: -3.2, base: 2.2, roll: 1.4 });
    t.peak(red.x + 8, red.z + 9, 8, 4).peak(holm.x + 3, holm.z - 5, 5, 2.5).peak(home.x - 7, home.z - 6, 6, 3);
    t.smooth(1);
    t.pad(home.x, home.z, 6, 2.4, 4).pad(red.x, red.z, 8, 2.5, 5).pad(holm.x, holm.z, 3, 2.6, 4);
    t.addGrove(home.x - 2, home.z + 9, 7, 0.9).addGrove(red.x - 4, red.z - 11, 10, 0.7).addGrove(holm.x, holm.z + 6, 5, 0.5);
    return makeLevel({
      name: '星罗浅滩',
      desc: '战役四。三座岛屿。石道是一份赠礼——两次施放，然后长眠。',
      terrain: t,
      homes: { player: home, red },
      civs: { red: 'north' },
      monuments: [
        { x: causewayStone.x, z: causewayStone.z, spell: 'landbridge', mode: 'gift', charges: 2, cooldown: 240 },
        { x: holm.x, z: holm.z, spell: 'ward', mode: 'teach' },
      ],
      wildmen: wanderers(t.map, 41, holm.x, holm.z, 8, 6),
      treeDensity: 0.03,
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert', 'bloom', 'flatten'],
              buildings: ['hut', 'lumberyard', 'warriorHut', 'fireHut', 'tower'],
              startUnits: { brave: 8 },
              startWood: 12,
            },
          },
          {
            id: 'red', name: '灰痕族', ai: true,
            personality: { passive: true, wakeAt: 540, harassAt: 6, assaultAt: 10, maxArmy: 10, maxDwellings: 6 },
            loadout: {
              spells: ['blast', 'convert', 'lightning'],
              buildings: ['hut', 'lumberyard', 'warriorHut', 'fireHut'],
            },
          },
        ],
        objectives: [
          { objective: { type: 'claimMonument', index: 1 }, text: '在中洲石阵学会石之庇护' },
          { objective: { type: 'destroyTribe', tribe: 'red' }, text: '把灰痕族赶出东岛' },
          { objective: { type: 'reachPopulation', count: 35 }, text: '让部族壮大到35人', optional: true },
        ],
        events: [
          { when: { type: 'time', at: 2 }, message: '我们岸边的石阵借出石道——两条出自大海的路。去那里跪下，然后架桥通往中洲。', focus: LAYOUT.causewayStone, actions: [] },
          { when: { type: 'spellCast', spell: 'landbridge' }, message: '大海让开了一条路。石阵沉睡之前还剩一条路——请好好使用它。', actions: [] },
        ],
        briefing: {
          title: '星罗浅滩',
          body:
            '灰痕族渡海东逃，占据了浅滩里最大的那座岛。我们只有最小的这座。' +
            '两岛之间是中洲，那里有一座传授庇护之道的石阵，它的两侧都是开阔的海面。' +
            '我们自己的岸上立着一座借出石道的石阵——可以升起两条陆地之路，然后它会沉睡七分钟。想清楚每一条路该通向何方。',
          tips: [
            '与赠礼石阵交流：无论你是否习得该法术，都能得到两次免费的掷道。',
            '石道从你的首领脚下延伸到你指定的地点，最多22格。站在岸边，瞄准对岸。',
            '余烬木屋训练出的掷火者，射程比瞭望塔还远。带他们去围攻。',
          ],
        },
      },
    });
  },
};