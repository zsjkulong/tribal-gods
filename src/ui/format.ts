/**
 * ui/format.ts — numbers and states turned into words a player reads.
 *
 * Every panel formats time, rates and "what is this person doing?" the
 * same way because they all come through here. Pure functions (tested in
 * test/ui-format.test.ts).
 */

import { BUILDINGS, DWELLING_TIERS, spellDef, UNITS } from '../sim/catalog';
import type { Building, Unit } from '../sim/world-state';

/** 75 → "1:15", 3725 → "1:02:05". */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

/** A countdown: 4.2 → "5秒", 95 → "1分 35秒", Infinity → "—". */
export function fmtEta(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  return `${m}分 ${String(s % 60).padStart(2, '0')}秒`;
}

/** ETA that fits a spell slot: "45秒", "2分 05秒", then whole minutes from ten ("14分"). */
export function fmtEtaShort(seconds: number): string {
  if (Number.isFinite(seconds) && seconds >= 600) return `${Math.ceil(seconds / 60)}分`;
  return fmtEta(seconds);
}

/** Mana per second, one decimal: 1.53 → "+1.5/秒". */
export function fmtRate(perSecond: number): string {
  return `+${(Math.round(perSecond * 10) / 10).toFixed(1)}/秒`;
}

/** 1 → "1 格", 4.5 → "4.5 格". */
export function fmtTiles(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${v} 格`;
}

/** 0 → "即时", 2.5 → "2.5秒". */
export function fmtSeconds(n: number): string {
  return n <= 0 ? '即时' : `${Math.round(n * 10) / 10}秒`;
}

/** Player-facing name of a building (dwellings by their tier). */
export function buildingName(b: Pick<Building, 'kind' | 'tier'>): string {
  return b.kind === 'hut' ? DWELLING_TIERS[Math.max(0, Math.min(2, b.tier))].name : BUILDINGS[b.kind].name;
}

type ActivityUnit = Pick<
  Unit,
  'kind' | 'state' | 'task' | 'carrying' | 'castSpell' | 'garrison' | 'hidden' | 'pacified' | 'lifted' | 'hp'
>;

/**
 * "What is this person doing?" in a few words. `buildingKindOf` resolves
 * the building a garrisoned unit is inside (null if unknown).
 */
export function activityText(u: ActivityUnit, insideKind: string | null = null): string {
  if (u.hp <= 0) return '已倒下';
  if (u.lifted > 0) return '被风潮卷起';
  if (u.pacified > 0) return '被咏唱魅惑';
  if (u.castSpell) return u.state === 'working' ? `正在施放${spellDef(u.castSpell).name}` : `前去施放${spellDef(u.castSpell).name}`;
  if (u.garrison >= 0 || (u.hidden && u.state === 'inside')) {
    if (insideKind === 'shrine') return '在祭坛祈祷';
    if (insideKind === 'tower') return '驻守瞭望塔';
    if (insideKind && BUILDINGS[insideKind as keyof typeof BUILDINGS]?.trains) return '训练中';
    return '在家';
  }
  switch (u.task) {
    case 'chop':
      return u.state === 'working' ? '砍伐树木' : '前去伐木';
    case 'deliverWood':
      return '搬运木材';
    case 'build':
      return u.state === 'working' ? '建造中' : '前去建造';
    case 'goHome':
      return '回家';
    case 'train':
      return '前去训练';
    case 'attack':
      return u.state === 'fighting' ? '战斗中' : '冲向敌人';
    case 'attackBuilding':
      return u.state === 'fighting' ? '摧毁建筑' : '扑向建筑';
    case 'worship':
      return u.state === 'working' ? '与石阵共感' : '前往石阵';
    case 'garrison':
      return '进入建筑';
    case 'chant':
      return '咏唱中';
    default:
      break;
  }
  if (u.state === 'fighting') return '战斗中';
  if (u.state === 'moving') return u.carrying ? '搬运木材' : '行走中';
  if (u.kind === 'brave') return '待命';
  if (u.kind === 'shaman') return '随时可施法';
  return UNITS[u.kind].sight > 0 ? '站岗中' : '等候';
}