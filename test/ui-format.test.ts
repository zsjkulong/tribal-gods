import { describe, expect, it } from 'vitest';
import { activityText, buildingName, fmtClock, fmtEta, fmtEtaShort, fmtRate, fmtSeconds, fmtTiles } from '../src/ui/format';

const unit = (over: Record<string, unknown> = {}) => ({
  kind: 'brave', state: 'idle', task: 'none', carrying: false, castSpell: null, garrison: -1,
  hidden: false, pacified: 0, lifted: 0, hp: 10, ...over,
}) as Parameters<typeof activityText>[0];

describe('formatters', () => {
  it('clock', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(75.9)).toBe('1:15');
    expect(fmtClock(3725)).toBe('1:02:05');
  });
  it('eta', () => {
    expect(fmtEta(4.2)).toBe('5秒');
    expect(fmtEta(95)).toBe('1分 35秒');
    expect(fmtEta(Infinity)).toBe('—');
    expect(fmtEtaShort(95)).toBe('1分 35秒');
    expect(fmtEtaShort(874)).toBe('15分');
  });
  it('rate, tiles, seconds', () => {
    expect(fmtRate(1.53)).toBe('+1.5/秒');
    expect(fmtTiles(1)).toBe('1 格');
    expect(fmtTiles(4.5)).toBe('4.5 格');
    expect(fmtSeconds(0)).toBe('即时');
    expect(fmtSeconds(2.5)).toBe('2.5秒');
  });
  it('dwellings are named by tier', () => {
    expect(buildingName({ kind: 'hut', tier: 0 })).toBe('小民居');
    expect(buildingName({ kind: 'hut', tier: 2 })).toBe('大民居');
    expect(buildingName({ kind: 'tower', tier: 0 })).toBe('瞭望塔');
  });
});

describe('activityText', () => {
  it('describes what a villager is doing', () => {
    expect(activityText(unit())).toBe('待命');
    expect(activityText(unit({ task: 'chop', state: 'working' }))).toBe('砍伐树木');
    expect(activityText(unit({ task: 'deliverWood', state: 'moving' }))).toBe('搬运木材');
    expect(activityText(unit({ garrison: 5, hidden: true, state: 'inside' }), 'shrine')).toBe('在祭坛祈祷');
    expect(activityText(unit({ hidden: true, state: 'inside' }), 'hut')).toBe('在家');
  });
  it('describes the leader casting', () => {
    expect(activityText(unit({ kind: 'shaman', castSpell: 'blast', state: 'working' }))).toBe('正在施放冲击');
    expect(activityText(unit({ kind: 'shaman', castSpell: 'convert', state: 'moving' }))).toBe('前去施放感化');
  });
  it('fighters at rest stand guard', () => {
    expect(activityText(unit({ kind: 'warrior' }))).toBe('站岗中');
  });
});