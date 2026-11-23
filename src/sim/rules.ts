/**
 * sim/rules.ts — the default ScenarioRules a random skirmish (or a legacy
 * level with no rules) plays under: you against 1–3 AI gods, starter
 * spells, every building, destroy every rival tribe.
 */

import { BUILD_ORDER, ScenarioRules, SPELLS, TRIBE_IDS, TribeId } from './catalog';

export const STARTER_SPELLS = SPELLS.filter((s) => s.starter).map((s) => s.id);

export function skirmishRules(enemies = 1): ScenarioRules {
  const n = Math.max(1, Math.min(3, Math.round(enemies)));
  const rivals = TRIBE_IDS.slice(1, 1 + n) as TribeId[];
  return {
    tribes: [
      { id: 'player', ai: false },
      ...rivals.map((id) => ({ id, ai: true })),
    ],
    objectives: [
      { objective: { type: 'destroyAll' }, text: n === 1 ? '消灭敌对部落' : '消灭所有敌对部落' },
    ],
    fail: [{ type: 'tribeDestroyed' }],
    briefing: {
      title: '遭遇战',
      body: n === 1 ? '一颗星球，两位神明。只有一个部落能活下去。' : `一颗星球，${n + 1} 位神明。只有一个部落能活下去。`,
      tips: [
        '民居会繁衍村民，并为你的法术提供法力。',
        '在木屋训练战士；在瞭望塔驻守以守住高地。',
        '首领在立石阵习得新的法术。',
      ],
    },
  };
}

/** Everything a loadout leaves out. */
export const ALL_BUILDINGS = [...BUILD_ORDER];