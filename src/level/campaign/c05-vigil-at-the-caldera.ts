/**
 * Chapter 5 — Vigil at the Caldera. Defend a shrine while a spell charges.
 *
 * Teaches: the charge model as a plan. Volcano is known but here it costs
 * eight times its usual mana — the ritual is the objective. Villagers
 * praying in the Shrine speed every charging spell; switching Blast and
 * Ward off pours everything into the ritual. But praying hands don't
 * fight, and the Unmoored come in waves through the three breaches in the
 * crater wall. Lose the Shrine and the vigil fails.
 *
 * The map: an old volcano's caldera — a lush round basin walled by steep
 * rock, open to the outside only through three breaches (north, south-
 * east, south-west). Raiders land on the outer shore and come through
 * them. Towers in the breaches are the whole game.
 */

import { arc, dist, inside, polar, Terrain, wanderers } from '../terrain-kit';
import type { Pt } from '../terrain-kit';
import type { ScenarioEvent, UnitKind } from '../../sim/catalog';
import { CampaignScenario, makeLevel, RAIDER_TRIBE } from './common';

const C = { x: 64, z: 64 };
const RIM_R = 23;
/** Breach angles (degrees; 90 = south). */
const BREACHES = [270, 30, 150];

export const LAYOUT = {
  centre: C,
  home: { x: 64, z: 72 },
  shrine: { x: 64, z: 61 },
  rimRadius: RIM_R,
  breaches: BREACHES.map((a) => polar(C.x, C.z, RIM_R, a)),
  landings: BREACHES.map((a) => polar(C.x, C.z, 39, a)),
};

function wave(at: number, breach: number, units: Partial<Record<UnitKind, number>>, message?: string, repeat?: ScenarioEvent['repeat']): ScenarioEvent {
  const p = LAYOUT.landings[breach];
  return {
    when: { type: 'time', at },
    ...(message ? { message } : {}),
    ...(repeat ? { repeat } : {}),
    actions: [{ type: 'spawn', tribe: 'violet', units, x: p.x, z: p.z, march: LAYOUT.breaches[breach] }],
  };
}

export const scenario: CampaignScenario = {
  id: 'c05_vigil_at_the_caldera',
  chapter: 5,
  title: '火山口之夜',
  tagline: '守住祭坛，直到山峦苏醒。',
  teaches: '为一则大术充能、祭坛、扼守突破口',
  async build() {
    const t = new Terrain(50505);
    const { home, shrine } = LAYOUT;
    t.landFrom((x, z) => inside(dist(x, z, C.x, C.z) + t.wobble(x, z, 1) * 9, 46, 8), { base: 2.0, roll: 1.4 });
    // Outer flanks: a gentle apron so the wall reads as a mountain from outside.
    t.apply((x, z, h) => {
      const d = dist(x, z, C.x, C.z);
      const apron = inside(Math.abs(d - RIM_R - 4), 6, 6) * 3;
      return h > 0 ? h + apron : h;
    });
    t.smooth(1);
    // The crater wall, in three arcs with the breaches between them.
    const gap = 9; // degrees either side of a breach
    const sorted = [...BREACHES].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const a0 = sorted[i] + gap;
      const a1 = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 360) - gap;
      t.ridge(arc(C.x, C.z, RIM_R, a0, a1, 6), 6.5, 13, 0.35);
    }
    // The basin floor, and the breach floors.
    t.apply((x, z, h) => {
      const k = inside(dist(x, z, C.x, C.z), RIM_R - 7, 5);
      return k > 0 ? h * (1 - k) + (2.6 + t.wobble(x, z, 4) * 0.4) * k : h;
    });
    for (const a of BREACHES) {
      const inner: Pt = polar(C.x, C.z, RIM_R - 7, a);
      const outer: Pt = polar(C.x, C.z, RIM_R + 8, a);
      t.road([inner, outer], 6, 2.8);
    }
    t.pad(home.x, home.z, 5, 2.6, 3).pad(shrine.x, shrine.z, 4, 2.6, 3);
    t.addGrove(52, 58, 6, 0.8).addGrove(76, 58, 6, 0.8).addGrove(64, 88, 10, 0.3).addGrove(40, 40, 10, 0.4).addGrove(90, 92, 10, 0.4);
    const L = LAYOUT.landings;
    return makeLevel({
      name: '火山口之夜',
      desc: '战役五。在火山充能期间守住火山口中的祭坛。',
      terrain: t,
      homes: { player: home, violet: L[0] },
      monuments: [{ x: 70, z: 52, spell: 'lightning', mode: 'gift', charges: 2, cooldown: 180 }],
      buildings: [
        { tribe: 'player', kind: 'shrine', x: shrine.x, z: shrine.z },
        { tribe: 'player', kind: 'hut', x: 55, z: 70 },
        { tribe: 'player', kind: 'hut', x: 73, z: 70 },
        { tribe: 'player', kind: 'warriorHut', x: 64, z: 52 },
      ],
      wildmen: wanderers(t.map, 51, 64, 64, 12, 3),
      rules: {
        tribes: [
          {
            id: 'player', name: '灯民', ai: false,
            loadout: {
              spells: ['blast', 'convert', 'ward', 'volcano'],
              chargeCost: { volcano: 32 },
              buildings: ['hut', 'lumberyard', 'warriorHut', 'tower', 'shrine'],
              startUnits: { brave: 10, warrior: 3 },
              startWood: 16,
            },
          },
          { id: 'violet', name: '无根族', ...RAIDER_TRIBE },
        ],
        objectives: [
          { objective: { type: 'chargeSpell', spell: 'volcano' }, text: '为火山积攒充能' },
          { objective: { type: 'buildCount', kind: 'tower', count: 3 }, text: '在每个突破口各建一座瞭望塔', optional: true },
          { objective: { type: 'reachPopulation', count: 30 }, text: '让部族壮大到30人', optional: true },
          // Appended (stars index objectives): the ritual's point is the eruption.
          { objective: { type: 'castSpell', spell: 'volcano' }, text: '在掠夺者的岸边唤醒山峦', after: 0 },
        ],
        fail: [{ type: 'buildingLost', kind: 'shrine' }],
        events: [
          { when: { type: 'time', at: 2 }, message: '火山口里有三名漂泊者。感化他们——多一双手祈祷，也多一个人战斗。', focus: LAYOUT.centre, actions: [] },
          { when: { type: 'objective', index: 0 }, message: '山峦在你手中苏醒。把火山施放在掠夺者登陆的地方——那里的火山口壁将永不再被攻破。', focus: LAYOUT.landings[0], actions: [] },
          wave(70, 0, { warrior: 2 }, '北岸泊来了无根族的船。'),
          wave(150, 1, { warrior: 3 }, '他们正从东南突破口涌入。'),
          wave(230, 2, { warrior: 2, firewarrior: 1 }, '西南突破口——而且他们带着火。'),
          wave(310, 0, { warrior: 3, firewarrior: 1 }),
          wave(390, 1, { warrior: 3, firewarrior: 1 }, undefined, { every: 160, times: 4 }),
          wave(470, 2, { warrior: 3, firewarrior: 2 }, undefined, { every: 160, times: 4 }),
          wave(550, 0, { warrior: 4, warden: 1 }, '他们当中有一名守卫者。石槌攻向祭坛。', { every: 160, times: 4 }),
        ],
        briefing: {
          title: '火山口之夜',
          body:
            '在这座死火山的内部，无根族够不到我们——除非穿过火山口壁上的三个突破口。' +
            '古老的歌谣说，只要一个部族祈祷得足够久，山峦就能被唤醒一次：我们的火山法术已然习得，但这一次它将耗去八倍的灵能。' +
            '守住祭坛，让祈祷持续不止，直到充能盈满。一波又一波的袭击不会停歇，只有那一刻才会。',
          tips: [
            '在祭坛中祈祷的村民，会加快所有正在充能的法术。关掉冲击与庇护，让一切只喂养这场仪式——等到某一波攻破了，再立刻打开。',
            '每个突破口只有几格宽。在每个突破口里驻防一座瞭望塔，便能承担大部分战斗。',
            '一旦祭坛失守，这场守夜便告失败。再造一座祭坛，就是多一份保障。',
          ],
        },
      },
    });
  },
};