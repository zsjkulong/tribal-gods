/**
 * ui/objective-advice.ts — "how do I do THAT?" for the objective in front of you.
 *
 * In a campaign chapter the story (narrator lines, objectives chained with
 * `after`) already says WHAT to do next; generic onboarding chips ("Build a
 * Dwelling") would argue with it. So in a guided scenario the hint chip is
 * derived from the current active objective instead, and says HOW, with
 * the real key — and, like every hint, only asks for what is possible now:
 * a spell still gathering power says so rather than "press J".
 *
 * Pure strings from data (World is only read), so it is unit-tested.
 */

import { BUILDINGS, Objective, spellDef, SpellId } from '../sim/catalog';
import type { World } from '../sim/world-state';
import { ActionId, labelFor, orderVerb } from './hotkeys';

const k = (a: ActionId) => {
  const l = labelFor(a);
  return l ? ` <span class="kbd">${l}</span>` : '';
};

/** A scenario that tells its own story (scripted events): generic onboarding hints stand aside. */
export function isGuided(world: World): boolean {
  return (world.rules.events?.length ?? 0) > 0;
}

/**
 * The objective the player should be working on: of the active, unfinished,
 * required ones, the one that became active MOST RECENTLY (the story moves
 * forward; it is what the narrator is talking about), the earliest-listed
 * among those that activated together. `activatedAt` (index → sim seconds)
 * is kept by the caller; without it, the first open one.
 */
export function currentObjective(world: World, activatedAt?: ReadonlyMap<number, number>): { index: number; objective: Objective; text: string } | null {
  const open = world.objectives
    .map((o, index) => ({ o, index }))
    .filter(({ o }) => o.active !== false && !o.done && !o.failed);
  const required = open.filter(({ o }) => !o.optional);
  const when = (i: number) => activatedAt?.get(i) ?? 0;
  const pick = required.reduce<(typeof required)[number] | undefined>((best, c) => (!best || when(c.index) > when(best.index) ? c : best), undefined) ?? open[0];
  return pick ? { index: pick.index, objective: pick.o.objective, text: pick.o.text } : null;
}

function spellAdvice(world: World, spell: SpellId, where: string): string {
  const def = spellDef(spell);
  const s = world.spellState('player', spell);
  if (!s.known && s.gifted === 0) return `${def.name}还不属于你——立石阵或主线剧情会带来它。`;
  if (!world.leaderOf('player')) return `你的首领负责施放${def.name}；她已倒下——点击左上角的首领状态看一段广告让她复活。`;
  if (s.charges + s.gifted === 0) {
    if (!s.charging) return `${def.name}未在充能：在法术书中右键点击它来注入法力。`;
    return `${def.name}正在积蓄力量${Number.isFinite(s.eta) ? `（约${Math.ceil(s.eta)}秒）` : ''}。当它的符文石亮起时，按下${k(`spell:${spell}`)}并${where}。`;
  }
  return `选择${def.name}${k(`spell:${spell}`)}并${where}。`;
}

/**
 * Foes expected but none ashore yet: if a stone is open to you, the story
 * (and this chip) points at it — the lull is for kneeling there; else hold.
 */
function quietAdvice(world: World, click: string): string {
  if (world.landings.length) return `敌船正在驶来——他们片刻后就会上岸。准备好将他们消灭在滩涂上。`;
  const kneeling = world.monuments.find((m) => m.communing && m.communer === 'player');
  if (kneeling) return `还没有敌人上岸。你的首领正在${spellDef(kneeling.spell).name}石阵前跪地共感——让她完成仪式吧。`;
  const open = world.monuments.find((m) => world.monumentAvailable(m) && !(m.mode === 'teach' && m.claimedBy !== null) && !world.tribes.player?.known.has(m.spell));
  if (open && world.leaderOf('player')) {
    return `还没有敌人上岸。利用这段空隙：选中你的首领${k('select-leader')}并${click}${spellDef(open.spell).name}石阵。`;
  }
  return `敌人还不见踪影。让战士留在村寨附近，并保持一个法术处于充能状态。`;
}

/** The leader is dead: say to revive her with an ad (never "select your leader" when there is none). */
function leaderAway(then: string): string {
  return `你的首领已经倒下——点击左上角的首领状态看一段广告让她在氏族石阵处复活，${then}。被打断的仪式正在缓缓消逝。`;
}

/** Strongest first: what to hit a host with when the leader holds it. */
const STRIKES: SpellId[] = ['volcano', 'emberfall', 'earthquake', 'lightning', 'blast'];

/** Foes in sight: name the strongest spell in hand (a stone's gift first), then the fighters. */
function strikeAdvice(world: World, click: string): string {
  const fighters = `选中你的战士（${labelFor('select-army') || '点选'}）并${click}敌人`;
  const ready = world.leaderOf('player') && STRIKES.find((id) => {
    const s = world.spellState('player', id);
    return s.gifted > 0 || (s.known && s.charges > 0);
  });
  if (!ready) return `${fighters}发起攻击。`;
  return `用${spellDef(ready).name}${k(`spell:${ready}`)}打击他们——或${fighters}。`;
}

/** The chip's text (HTML) for an objective, or null when there's nothing useful to add. */
export function objectiveAdvice(world: World, o: Objective, leftClickOrders: boolean): string | null {
  const click = orderVerb(leftClickOrders);
  switch (o.type) {
    case 'castSpell':
      return spellAdvice(world, o.spell, o.x !== undefined ? '左键点击标记的位置（旁白会指向它；小地图会标亮它）' : '左键点击世界中的目标地点');
    case 'chargeSpell':
      return `让${spellDef(o.spell).name}积蓄${o.charges ?? 1}层充能：更多的人口、民居和祈祷者会加快它的充满。`;
    case 'convertWanderers':
      return spellAdvice(world, 'convert', '左键点击聚集的漂泊者以感化他们');
    case 'buildCount': {
      const st = world.buildState('player', o.kind);
      const name = BUILDINGS[o.kind].name;
      if (!st.allowed) return null;
      if (!st.unlocked || !st.affordable) return `${name}：${st.reason ?? '尚未就绪'}。你的村民会自行收集木材。`;
      return `在建造面板中选择${name}${k(`build:${o.kind}`)}，然后点击开阔地面。`;
    }
    case 'reachPopulation':
      return `壮大部落：民居${k('build:hut')}只要有空位就会孕育新的村民。`;
    case 'claimMonument': {
      const m = world.monuments[o.index];
      if (!world.leaderOf('player')) return leaderAway('然后派她回到石阵');
      const name = m ? `${spellDef(m.spell).name} ` : '';
      const pct = (p: number | undefined) => `${Math.round((p ?? 0) * 100)}%`;
      if (m?.communing && m.communer === 'player') {
        return m.contested
          ? `仪式被僵持住了（${pct(m.communeProgress)}）：有敌人站在石圈内。驱散他们——用法术打击，或派战士上前。`
          : `你的首领正在${name}石阵前跪地共感（${pct(m.communeProgress)}）。别让敌人靠近她——一次打击就会打断仪式。`;
      }
      if (m && (m.communeProgress ?? 0) > 0.02 && m.communer !== 'player') {
        return `仪式在${pct(m.communeProgress)}时被打断，正在缓缓消逝。选中你的首领${k('select-leader')}并${click}${name}石阵再次跪地共感。`;
      }
      const l = world.leaderOf('player')!;
      if (l.hp < l.maxHp * 0.6) {
        const bloom = world.spellState('player', 'bloom');
        const heal = bloom.gifted > 0 || (bloom.known && bloom.charges > 0) ? ` 对她施放萌发生机${k('spell:bloom')}可立即治愈她；` : '';
        return `你的首领受伤了（${Math.round((l.hp / l.maxHp) * 100)}%），跪地共感时会承受额外伤害。${heal}脱离战斗后她会自行痊愈。然后选中她${k('select-leader')}并${click}${name}石阵。`;
      }
      return `选中你的首领${k('select-leader')}并${click}${name}石阵。带上战士：她若被击中，仪式就会被打断。`;
    }
    case 'leaderReach':
      if (!world.leaderOf('player')) return leaderAway('然后带她走过去');
      return `选中你的首领${k('select-leader')}并${click}故事所指向的地面。`;
    case 'rescueStranded': {
      const cb = world.spellState('player', 'landbridge');
      if (cb.known || cb.gifted > 0) return spellAdvice(world, 'landbridge', '左键点击他们所在的地面——道路会从她脚下延伸出去');
      return `当一条可通行的道路抵达时，被困的人们就会加入你——为他们升起陆地吧。`;
    }
    case 'holdPoint':
      return `让你的子民坚守在标记的地面上，直到时间结束。`;
    case 'killUnits':
      if (!world.units.some((u) => u.tribe === o.tribe && !u.hidden)) return quietAdvice(world, click);
      return strikeAdvice(world, click);
    case 'destroyTribe':
    case 'destroyAll':
      return `选中你的战士（${labelFor('select-army') || '点选'}）并${click}敌人发起攻击。`;
    default:
      return null;
  }
}