/**
 * Chapter 3 — Smoke Over the Ridge. The first rival tribe.
 *
 * Teaches: War Lodges turn villagers into Warriors; an army takes a town.
 * Watchtowers hold a choke. Tests: building an economy and an army at
 * once against a god who is doing the same (a young, smaller tribe — the
 * first war should be winnable by a learner).
 *
 * The map: "Twofold", one island cut north–south by a spine of bare rock.
 * Two ways across: the high pass in the middle — where the Lightning
 * stone stands — and the long shore path round the southern tip. The
 * Ashmark hold the eastern valley; we land in the west.
 */

import { inside, Terrain, wanderers } from '../terrain-kit';
import { CampaignScenario, makeLevel } from './common';

export const LAYOUT = {
  home: { x: 30, z: 62 },
  red: { x: 98, z: 66 },
  pass: { x: 64, z: 58 },
  ward: { x: 22, z: 44 },
  shore: { x: 64, z: 96 },
};

export const scenario: CampaignScenario = {
  id: 'c03_smoke_over_the_ridge',
  chapter: 3,
  title: '岭上炊烟',
  tagline: '岩脊那边，升起了别人家的炊烟——灰痕族。',
  teaches: '战团木屋、战士、扼守关隘',
  async build() {
    const t = new Terrain(30303);
    const { home, red, pass, ward } = LAYOUT;
    t.landFrom((x, z) => {
      const dx = (x - 64) / 54;
      const dz = (z - 64) / 36;
      return inside(Math.hypot(dx, dz) * 40 + t.wobble(x, z, 1) * 10, 40, 7);
    }, { base: 2.3, roll: 1.7 });
    t.peak(44, 38, 9, 4).peak(86, 90, 9, 4);
    t.smooth(1);
    // The spine: impassable but for the pass and the southern shore.
    t.ridge([{ x: 66, z: 20 }, { x: 62, z: 40 }, { x: 65, z: 54 }], 9, 14, 0.3);
    t.ridge([{ x: 63, z: 63 }, { x: 61, z: 74 }, { x: 63, z: 84 }], 9, 14, 0.3);
    t.road([{ x: pass.x - 9, z: pass.z }, { x: pass.x + 9, z: pass.z + 1 }], 6, 4.2);
    t.pad(pass.x, pass.z, 3, 4.6, 3);
    t.pad(home.x, home.z, 8, 2.4, 5).pad(red.x, red.z, 8, 2.6, 5);
    t.addGrove(home.x - 6, home.z + 14, 10, 0.7).addGrove(red.x + 8, red.z - 14, 10, 0.7).addGrove(44, 86, 8, 0.4).addGrove(90, 40, 8, 0.4);
    return makeLevel({
      name: '岭上炊烟',
      desc: '战役三。一条岩脊、一道关隘、一个对手。',
      terrain: t,
      homes: { player: home, red },
      civs: { red: 'north' },
      monuments: [
        { x: pass.x, z: pass.z, spell: 'lightning', mode: 'teach' },
        { x: ward.x, z: ward.z, spell: 'ward', mode: 'gift', charges: 2, cooldown: 240 },
      ],
      wildmen: wanderers(t.map, 31, 36, 76, 3, 4).concat(wanderers(t.map, 32, 88, 44, 8, 4), wanderers(t.map, 33, 44, 86, 6, 3)),
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert', 'bloom', 'flatten'],
              buildings: ['hut', 'lumberyard', 'warriorHut', 'tower'],
              startUnits: { brave: 8 },
              startWood: 10,
            },
          },
          {
            id: 'red', name: '灰痕族', ai: true,
            personality: { passive: true, wakeAt: 480, harassAt: 4, assaultAt: 8, maxArmy: 8, maxDwellings: 4 },
            loadout: {
              spells: ['blast', 'convert'],
              buildings: ['hut', 'lumberyard', 'warriorHut'],
              startUnits: { brave: 4 },
              startWood: 0,
            },
          },
        ],
        objectives: [
          { objective: { type: 'destroyTribe', tribe: 'red' }, text: '把灰痕族赶出双屿' },
          { objective: { type: 'claimMonument', index: 0 }, text: '在关隘的石阵学会闪电', optional: true },
          { objective: { type: 'buildCount', kind: 'tower', count: 2 }, text: '建起2座瞭望塔', optional: true },
          { objective: { type: 'castSpell', spell: 'lightning', count: 3 }, text: '召引闪电落下三次', optional: true },
        ],
        events: [
          { when: { type: 'time', at: 2 }, message: '村落下方的溪流边有漂泊者。感化他们——对抗灰痕族，每一双手都珍贵。', focus: { x: 36, z: 76 }, actions: [] },
          { when: { type: 'time', at: 40 }, message: '关隘里的石阵记载着闪电之道。赶在灰痕族首领之前去那里跪下——她会带着长矛赶来。', focus: LAYOUT.pass, actions: [] },
          { when: { type: 'time', at: 470 }, message: '岭那边升起了烟，响起了鼓。灰痕族不再躲藏了。', focus: LAYOUT.red, actions: [] },
        ],
        briefing: {
          title: '岭上炊烟',
          body:
            '清晨，远处的山谷升起炊烟。灰痕族比我们早一季从那片烧焦的山岭上下来，他们从不与人分享。' +
            '双屿被一条岩脊一分为二，岩脊上只有一道高隘，隘中有一块记载着闪电的石阵。' +
            '他们人还不多——比我们少——但这不会长久。建起一座战团木屋，聚起长矛，趁山谷还没有被他们填满，把它夺过来。',
          tips: [
            '战团木屋能把村民变成战士。先排几条队列，再把他们集结到你想要的地方。',
            '这道关隘对双方都是捷径；在它旁边立一座瞭望塔，就能提前看见他们来。',
            '让足够多的村民继续劳作——一支军队的规模，取决于背后有多少木材。',
          ],
        },
      },
    });
  },
};