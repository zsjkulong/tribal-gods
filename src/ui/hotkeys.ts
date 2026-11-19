/**
 * ui/hotkeys.ts — THE hotkey table. Single source of truth.
 *
 * Every control that has a key shows it (spell slots, build tiles, top-bar
 * buttons), the How-to-play page prints this table, and the one keyboard
 * handler (ui/game-ui.ts onKey) dispatches through matchHotkey(). Change a
 * key here and every one of those follows.
 *
 * The layout, and why:
 *   - W A S D / arrows and Q E belong to the camera (render/camera-rig.ts
 *     reads them directly), so nothing else may use them.
 *   - 1–9 recall control groups, Ctrl+1–9 set them (RTS convention).
 *   - Spells sit on three keyboard ROWS, one per tier, so the keyboard
 *     mirrors the spell book: tier I on R T Y U I, tier II on F G H J K,
 *     tier III on V B N M. Muscle memory learns "row = power".
 *   - Buildings are Shift + 1–8 in build-menu order.
 *   - Space jumps to your leader, C to your home circle, period to the next
 *     idle villager, comma selects the whole army.
 *
 * Pure data + pure functions: no DOM, so Vitest can check for collisions.
 */

import { BUILD_ORDER, BUILDINGS, BuildingKind, SPELLS, SpellId } from '../sim/catalog';

export type ActionId =
  | `spell:${SpellId}`
  | `build:${BuildingKind}`
  | `group-set:${number}`
  | `group-recall:${number}`
  | 'select-army'
  | 'idle-villager'
  | 'select-leader'
  | 'centre-leader'
  | 'centre-home'
  | 'pause'
  | 'speed-down'
  | 'speed-up'
  | 'demolish'
  | 'cancel'
  | 'debug'
  | 'help';

export type HotkeyGroup = 'Spells' | 'Build' | 'Selection' | 'Camera' | 'Game';

export interface Hotkey {
  action: ActionId;
  /** KeyboardEvent.code */
  code: string;
  shift?: boolean;
  ctrl?: boolean;
  group: HotkeyGroup;
  /** What the How-to-play table says it does. */
  desc: string;
}

/** Keyboard rows the spell tiers live on (index = tier - 1). */
export const SPELL_ROWS = [
  ['KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI'],
  ['KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'],
  ['KeyV', 'KeyB', 'KeyN', 'KeyM'],
] as const;

/** Debug-only keys (F3 on): - and = arm the sculpt brush, Shift+[ / Shift+] size it (ui/brush.ts). Not bound in play. */
export const DEBUG_CODES = ['Minus', 'Equal'];

/** Keys the camera rig reads directly; nothing else may bind them. */
export const CAMERA_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function spellHotkeys(): Hotkey[] {
  const out: Hotkey[] = [];
  const used = [0, 0, 0];
  for (const s of SPELLS) {
    const row: readonly string[] = SPELL_ROWS[s.tier - 1];
    const i = used[s.tier - 1]++;
    if (i >= row.length) continue; // a tier longer than its row goes unbound (the slot shows no key)
    out.push({ action: `spell:${s.id}`, code: row[i], group: 'Spells', desc: s.name });
  }
  return out;
}

function buildHotkeys(): Hotkey[] {
  return BUILD_ORDER.slice(0, 9).map((kind, i) => ({
    action: `build:${kind}` as ActionId,
    code: `Digit${i + 1}`,
    shift: true,
    group: 'Build' as const,
    desc: BUILDINGS[kind].name,
  }));
}

function groupHotkeys(): Hotkey[] {
  const out: Hotkey[] = [];
  for (let n = 1; n <= 9; n++) {
    out.push({ action: `group-recall:${n}`, code: `Digit${n}`, group: 'Selection', desc: `选择控制组 ${n}（按两次：镜头跳转）` });
    out.push({ action: `group-set:${n}`, code: `Digit${n}`, ctrl: true, group: 'Selection', desc: `将当前选中设为控制组 ${n}` });
  }
  return out;
}

export const HOTKEYS: Hotkey[] = [
  ...spellHotkeys(),
  ...buildHotkeys(),
  ...groupHotkeys(),
  { action: 'select-army', code: 'Comma', group: 'Selection', desc: '选中全部战士' },
  { action: 'idle-villager', code: 'Period', group: 'Selection', desc: '下一个闲置村民' },
  { action: 'select-leader', code: 'KeyL', group: 'Selection', desc: '选中你的首领' },
  { action: 'centre-leader', code: 'Space', group: 'Camera', desc: '镜头跳转到首领' },
  { action: 'centre-home', code: 'KeyC', group: 'Camera', desc: '镜头跳转到家园石圈' },
  { action: 'pause', code: 'KeyP', group: 'Game', desc: '暂停 / 继续' },
  { action: 'speed-down', code: 'BracketLeft', group: 'Game', desc: '放慢' },
  { action: 'speed-up', code: 'BracketRight', group: 'Game', desc: '加快' },
  { action: 'demolish', code: 'Delete', group: 'Selection', desc: '拆除选中的建筑' },
  { action: 'demolish', code: 'Backspace', group: 'Selection', desc: '拆除（Mac 删除键）' },
  { action: 'cancel', code: 'Escape', group: 'Game', desc: '取消瞄准 / 建造；否则打开菜单' },
  { action: 'help', code: 'F1', group: 'Game', desc: '如何游玩' },
  { action: 'debug', code: 'F3', group: 'Game', desc: '调试信息' },
];

/**
 * Camera + mouse controls the table also documents (handled elsewhere).
 * `leftClickOrders` is the player's setting (ui/settings.ts): with it on, a
 * plain click on the ground orders your selected people, like a right-click.
 */
export function describedControls(leftClickOrders: boolean): Array<{ keys: string[]; desc: string; group: HotkeyGroup }> {
  return [
    { keys: ['W', 'A', 'S', 'D'], desc: '平移视角（或方向键）', group: 'Camera' },
    { keys: ['Q', 'E'], desc: '旋转视角（或按住中键拖动）', group: 'Camera' },
    { keys: ['Wheel'], desc: '向光标方向缩放', group: 'Camera' },
    { keys: ['Click'], desc: leftClickOrders
      ? '选中你的族人、建筑或石阵。选中族人后，点击地面或目标即可派他们行动'
      : '选中你的族人、建筑或石阵', group: 'Selection' },
    { keys: ['Drag'], desc: '在地面上拖出区域：其中的族人将被选中', group: 'Selection' },
    { keys: ['Double-click'], desc: '选中屏幕上全部同类单位', group: 'Selection' },
    { keys: ['Shift', 'Click'], desc: '添加到 / 移出选择（Shift 拖动同样生效）', group: 'Selection' },
    { keys: ['Right-click'], desc: '下达指令：移动、攻击、驻守、共感、集结（Mac 上用 Ctrl 点击或双指轻点）', group: 'Selection' },
    { keys: ['Esc'], desc: '取消选择', group: 'Selection' },
  ];
}

/** The word hints and tooltips use for "give an order" under the current setting. */
export function orderVerb(leftClickOrders: boolean): string {
  return leftClickOrders ? '左键点击' : '右键点击';
}

/** 'KeyR' → 'R', 'Digit1' → '1', 'Space' → 'Space'… */
export function codeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named: Record<string, string> = {
    Space: 'Space', Period: '.', Comma: ',', Escape: 'Esc', Backquote: '`', BracketLeft: '[', BracketRight: ']',
    Delete: 'Del', Backspace: 'Bksp', Slash: '/', Minus: '-', Equal: '=',
  };
  return named[code] ?? code;
}

/** Display label for a hotkey, e.g. 'R', '⇧1', 'Ctrl 1'. */
export function keyLabel(hk: Hotkey): string {
  return `${hk.ctrl ? 'Ctrl ' : ''}${hk.shift ? '⇧' : ''}${codeLabel(hk.code)}`;
}

export function hotkeyFor(action: ActionId): Hotkey | undefined {
  return HOTKEYS.find((k) => k.action === action);
}

/** Label for an action's key, or '' if it has none. */
export function labelFor(action: ActionId): string {
  const hk = hotkeyFor(action);
  return hk ? keyLabel(hk) : '';
}

export interface KeyLike {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** The hotkey a key event means, or null. Modifiers must match exactly. */
export function matchHotkey(e: KeyLike): Hotkey | null {
  if (e.altKey || e.metaKey) return null; // leave browser/OS shortcuts alone
  for (const hk of HOTKEYS) {
    if (hk.code === e.code && !!hk.shift === e.shiftKey && !!hk.ctrl === e.ctrlKey) return hk;
  }
  return null;
}

/**
 * Which key sizes the brush, and by how much (0 = not a brush key).
 * In the editor: [ and ]. In play [ ] are game speed, so the debug brush
 * (F3) sizes with Shift+[ and Shift+] instead — never both at once.
 */
export function brushSizeStep(
  e: { code: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
  mode: string,
  debug: boolean,
): number {
  if (e.ctrlKey || e.metaKey || e.altKey) return 0;
  const dir = e.code === 'BracketLeft' ? -1 : e.code === 'BracketRight' ? 1 : 0;
  if (!dir) return 0;
  if (mode === 'editor') return e.shiftKey ? 0 : dir;
  if (mode === 'game' && debug) return e.shiftKey ? dir : 0;
  return 0;
}