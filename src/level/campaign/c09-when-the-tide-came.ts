/**
 * Chapter 9 — When the Tide Came. The world is sinking; hold the high ground.
 *
 * Teaches/tests: moving a whole tribe under pressure. The sea takes the
 * lowlands a piece at a time (scripted Undertow strikes on a schedule —
 * the village lands on the first fields to go), while the Saltborn, who
 * have learned Undertow and charge it cheaply, push from their own hill.
 * Win by holding the summit of the Last Hill, uncontested, for two and a
 * half minutes. Level and Ward make the terraces liveable.
 *
 * The map: a broad low island with one stepped mountain in the middle —
 * three terraces and a crown — and the Saltborn's hill in the east. The
 * lowland skirt is all good farmland. None of it will last.
 */

import { dist, inside, polar, Terrain, wanderers } from '../terrain-kit';
import type { ScenarioEvent } from '../../sim/catalog';
import { CampaignScenario, makeLevel } from './common';

export const LAYOUT = {
  home: { x: 28, z: 74 },
  gold: { x: 104, z: 58 },
  summit: { x: 62, z: 62 },
  ward: { x: 52, z: 46 },
};

/** Where and when the sea comes in: lowland first, then nearer the hill. */
export const TIDE: Array<{ at: number; x: number; z: number; say?: string }> = [
  { at: 150, ...polar(62, 62, 44, 160), say: '大海吞没了西边的田地。' },
  { at: 200, ...polar(62, 62, 42, 230) },
  { at: 250, ...polar(62, 62, 44, 110) },
  { at: 300, ...polar(62, 62, 40, 190), say: '水已经漫到了村子的边缘。' },
  { at: 350, ...polar(62, 62, 44, 280) },
  { at: 400, ...polar(62, 62, 42, 60) },
  { at: 450, x: 28, z: 74, say: '旧村庄正在沉没。' },
  { at: 500, ...polar(62, 62, 34, 140) },
  { at: 560, ...polar(62, 62, 33, 210) },
  { at: 620, ...polar(62, 62, 35, 320) },
  { at: 680, ...polar(62, 62, 32, 90) },
  { at: 740, ...polar(62, 62, 34, 250), say: '只剩下山丘了。' },
  { at: 820, ...polar(62, 62, 30, 175) },
  { at: 900, ...polar(62, 62, 30, 40) },
];

export const scenario: CampaignScenario = {
  id: 'c09_when_the_tide_came',
  chapter: 9,
  title: '潮起之时',
  tagline: '大海正在蚕食这座岛。往高处走，守住山顶。',
  teaches: '在重压下迁徙、守住一个据点',
  async build() {
    const t = new Terrain(90909);
    const { home, gold, summit, ward } = LAYOUT;
    t.landFrom((x, z) => inside(dist(x, z, 62, 64) + t.wobble(x, z, 1) * 12, 50, 8), { base: 1.7, roll: 0.7 });
    // The Last Hill: three terraces and a crown, each step a short steep bank.
    t.mesa(summit.x, summit.z, 22, 5, 3).mesa(summit.x + 1, summit.z - 1, 14, 9.5, 3).mesa(summit.x, summit.z, 6, 14, 3);
    // Cliffs on the north face: the hill is climbed from the south and west.
    t.ridge([{ x: 46, z: 46 }, { x: 62, z: 40 }, { x: 80, z: 48 }], 5, 11, 0.3);
    // The Saltborn's hill.
    t.mesa(gold.x, gold.z, 12, 4.6, 4).peak(gold.x + 8, gold.z - 8, 7, 3);
    t.smooth(1);
    t.pad(home.x, home.z, 8, 1.8, 5).pad(gold.x, gold.z, 7, 4.6, 3);
    t.addGrove(home.x - 4, home.z + 14, 10, 0.6).addGrove(summit.x - 12, summit.z + 10, 8, 0.6).addGrove(gold.x, gold.z + 14, 9, 0.6).addGrove(80, 86, 10, 0.5);
    const tide: ScenarioEvent[] = TIDE.map((p) => ({
      when: { type: 'time', at: p.at },
      ...(p.say ? { message: p.say } : {}),
      actions: [{ type: 'strike', spell: 'sink', x: p.x, z: p.z, tribe: 'gold' }],
    }));
    return makeLevel({
      name: '潮起之时',
      desc: '战役九。大海吞没低地。守住最后之丘的山巅。',
      terrain: t,
      homes: { player: home, gold },
      civs: { gold: 'dynasty' },
      monuments: [{ x: ward.x, z: ward.z, spell: 'ward', mode: 'gift', charges: 2, cooldown: 150 }],
      wildmen: wanderers(t.map, 91, 40, 92, 10, 4).concat(wanderers(t.map, 92, 82, 34, 8, 3)),
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert', 'flatten', 'bloom', 'lightning'],
              buildings: ['hut', 'lumberyard', 'warriorHut', 'fireHut', 'tower', 'shrine'],
              startUnits: { brave: 10, warrior: 2 },
              startWood: 16,
            },
          },
          {
            id: 'gold', name: '盐裔', ai: true,
            personality: { target: 'player', harassAt: 4, assaultAt: 9 },
            loadout: {
              spells: ['blast', 'convert', 'sink', 'lightning'],
              chargeCost: { sink: 0.6 },
              buildings: ['hut', 'lumberyard', 'warriorHut', 'fireHut', 'tower', 'shrine'],
              startUnits: { brave: 9, warrior: 2 },
            },
          },
        ],
        objectives: [
          { objective: { type: 'holdPoint', x: summit.x, z: summit.z, radius: 6, seconds: 150 }, text: '守住最后之丘的山巅（两分半，无人争抢）' },
          { objective: { type: 'destroyTribe', tribe: 'gold' }, text: '把盐裔赶进大海', optional: true },
        ],
        fail: [{ type: 'timeLimit', seconds: 1500 }],
        events: [
          { when: { type: 'time', at: 2 }, message: '趁低地还没有被淹没，先在最后之丘上整平一层梯田。', focus: LAYOUT.summit, actions: [] },
          ...tide,
        ],
        briefing: {
          title: '潮起之时',
          body:
            '那一天来了。海水正以一种缓慢而碾磨的吞没之势漫上岛屿，一片田地接着一片田地，而我们的村庄就落在它最想要的初几片田地上。' +
            '盐裔学会了潮汐自己的歌谣——回澜——无论我们建起什么，他们都会用它来对付。' +
            '岛屿中央矗立着最后之丘。当海水停息之时，谁守住了它的山巅，谁就守住了这座岛。',
          tips: [
            '不要等水。早点在梯田上开工——整平能在坡地上腾出空间。',
            '守住山巅需要你的人站在上面，且圈内没有敌人，并且一分一秒都不能中断地持续两分半。',
            '在最高一层梯田上建一座瞭望塔，就能覆盖整座山巅。',
          ],
        },
      },
    });
  },
};