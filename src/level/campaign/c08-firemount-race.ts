/**
 * Chapter 8 — The Firemount Race. Be first to the stone, against a clock.
 *
 * Teaches/tests: timing and positioning. The Volcano stone on the summit
 * of the Firemount sleeps until the fourth minute; whoever communes first
 * learns Volcano for good — and if the Ashmark get it, it's over. Their
 * town is closer. The summit is held by the mountain's Keepers (the
 * Unmoored who made it a shrine), who fight anyone who climbs. Then the
 * clock: the Ashmark must fall within thirty minutes.
 *
 * The map: twin continents joined by one narrow isthmus, with the
 * Firemount — a broad cone with a flat crown — standing on it. Our land is
 * the western one, larger and further; theirs is the eastern. A mere lies
 * across our road to the mountain; Causeway is known, and a bridge over it
 * cuts the walk.
 */

import { dist, inside, Terrain, wanderers } from '../terrain-kit';
import { CampaignScenario, makeLevel } from './common';

export const OPENS_AT = 240;

export const LAYOUT = {
  home: { x: 18, z: 70 },
  red: { x: 104, z: 60 },
  summit: { x: 66, z: 62 },
  bay: { x: 40, z: 66 },
  lightning: { x: 22, z: 44 },
  swamp: { x: 108, z: 80 },
};

export const scenario: CampaignScenario = {
  id: 'c08_firemount_race',
  chapter: 8,
  title: '火岳竞逐',
  tagline: '山巅的石阵在第四分钟苏醒。你必须在那里。',
  teaches: '把握时机、争夺石阵、一条限期',
  async build() {
    const t = new Terrain(80808);
    const { home, red, summit, bay } = LAYOUT;
    t.landFrom((x, z) => {
      const westL = inside(Math.hypot((x - 26) / 24, (z - 64) / 42) * 30 + t.wobble(x, z, 1) * 7, 30, 6);
      const eastL = inside(Math.hypot((x - 102) / 22, (z - 62) / 36) * 30 + t.wobble(x, z, 2) * 7, 30, 6);
      const isthmus = inside(Math.abs(z - 62 - Math.sin(x / 6) * 2) + t.wobble(x, z, 3) * 2, 7, 4) * inside(Math.abs(x - 64), 20, 4);
      const cut = inside(dist(x, z, bay.x, bay.z) + t.wobble(x, z, 4) * 4, 8, 4);
      return Math.max(westL, eastL, isthmus) * (1 - cut);
    }, { base: 2.2, roll: 1.4 });
    // The Firemount: a broad cone with a crown flat enough to stand on.
    t.peak(summit.x, summit.z, 15, 11);
    t.smooth(1);
    t.pad(summit.x, summit.z, 3, 9.6, 3);
    t.ridge([{ x: 6, z: 36 }, { x: 14, z: 26 }, { x: 28, z: 24 }], 7, 6, 0.4).ridge([{ x: 114, z: 36 }, { x: 120, z: 50 }], 6, 6, 0.4);
    t.pad(home.x, home.z, 8, 2.4, 5).pad(red.x, red.z, 8, 2.6, 5);
    t.addGrove(home.x + 4, home.z + 16, 10, 0.7).addGrove(home.x + 12, home.z - 6, 8, 0.5).addGrove(red.x - 6, red.z + 16, 10, 0.7);
    return makeLevel({
      name: '火岳竞逐',
      desc: '战役八。双大陆、一座山、一块在第四分钟苏醒的石阵。',
      terrain: t,
      homes: { player: home, red, violet: summit },
      civs: { red: 'north' },
      monuments: [
        { x: summit.x, z: summit.z, spell: 'volcano', mode: 'teach', opensAt: OPENS_AT },
        { x: LAYOUT.lightning.x, z: LAYOUT.lightning.z, spell: 'lightning', mode: 'teach' },
        { x: LAYOUT.swamp.x, z: LAYOUT.swamp.z, spell: 'swamp', mode: 'teach' },
      ],
      units: [
        { tribe: 'violet', kind: 'warrior', x: summit.x - 3, z: summit.z + 2, count: 3 },
        { tribe: 'violet', kind: 'warrior', x: summit.x + 3, z: summit.z - 2, count: 2 },
      ],
      wildmen: wanderers(t.map, 81, 30, 92, 8, 4).concat(wanderers(t.map, 82, 96, 40, 8, 3)),
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert', 'flatten', 'bloom', 'ward', 'landbridge'],
              buildings: ['hut', 'lumberyard', 'warriorHut', 'fireHut', 'tower', 'shrine'],
              startUnits: { brave: 8, warrior: 2 },
              startWood: 12,
            },
          },
          {
            id: 'red', name: '灰痕族', ai: true,
            personality: { target: 'player', harassAt: 5, assaultAt: 11 },
            loadout: {
              spells: ['blast', 'convert', 'ward'],
              buildings: ['hut', 'lumberyard', 'warriorHut', 'fireHut', 'tower', 'shrine'],
              startUnits: { brave: 8, warrior: 2 },
            },
          },
          { id: 'violet', name: '守山人', ai: false, loadout: { spells: [], buildings: [], startUnits: { shaman: 0, brave: 0 } } },
        ],
        objectives: [
          { objective: { type: 'claimMonument', index: 0 }, text: '第一个在火岳之巅与石阵交流' },
          { objective: { type: 'destroyTribe', tribe: 'red' }, text: '在半小时内击垮灰痕族' },
          { objective: { type: 'destroyTribe', tribe: 'violet' }, text: '把守山人赶下山', optional: true },
        ],
        fail: [{ type: 'monumentTaken', index: 0 }, { type: 'timeLimit', seconds: 1800 }],
        events: [
          { when: { type: 'time', at: 2 }, message: '石道已经备好：越过水泊架一座桥，通往火岳的路就缩短一半。', focus: LAYOUT.bay, actions: [] },
          { when: { type: 'commune', index: 0, tribe: 'red' }, message: '灰痕族首领在火岳下跪了！打断她的仪式——攻击她，或者把长矛围进圈内。', focus: LAYOUT.summit, actions: [] },
          { when: { type: 'commune', index: 0, tribe: 'player' }, message: '仪式已经开始了：三十五次心跳，山峦之火便归于我们。别让任何长矛靠近她。', focus: LAYOUT.summit, actions: [] },
          { when: { type: 'time', at: OPENS_AT - 30 }, actions: [{ type: 'message', text: '火岳发出了轰鸣。它的石阵将在三十次心跳后苏醒。' }] },
          { when: { type: 'time', at: OPENS_AT }, actions: [{ type: 'message', text: '火岳的石阵已经苏醒。' }] },
        ],
        briefing: {
          title: '火岳竞逐',
          body:
            '在两片大陆之间矗立着火岳，其山巅有一块记载着山峦之火本身的石阵。它沉睡直到第四分钟。' +
            '灰痕族比我们离它更近。若是他们的首领先与那块石阵相伴而坐，我们便活不过她学成的那一天。' +
            '守山人守护着山巅，凡攀爬者皆受其攻击，而潮汐只给我们半小时，在那之后了结灰痕族。',
          tips: [
            '山巅的仪式要花去半分钟有余，一旦敌方的长矛站进圈内便会中止，任何一击都会令它中断。带上长矛。',
            '一条越过水泊的石道能缩短脚程。这道法术已经记在你的书里了。',
            '习得火山之后，一次充能便可抹平一座城镇。充能要花很长时间：尽早开始。',
          ],
        },
      },
    });
  },
};