/**
 * ui/editor.ts — the level builder.
 *
 * The deep trick here is that there IS no separate editor world: the
 * editor is the game world with the simulation frozen (main.ts skips
 * World.tick in editor mode) and a different set of mouse tools. Terrain
 * sculpting is the same brush, rendering is the same renderers, monuments
 * are the same monuments. The editor edits THE live World object — which
 * is why Test Play is instant (capture → reload → unfreeze) and why
 * everything you place looks exactly as it will in play, because it is.
 *
 * Toolbar (top center): sculpt tools, placement tools, level metadata,
 * then the verbs — Save to library, Export share code, Test, Exit.
 *
 *   Stone   places a standing stone: pick its spell (any of the fourteen)
 *           and whether it TEACHES the spell or GIFTS two casts.
 *   Home    moves a tribe's home circle: pick the tribe. Placing the home
 *           of a tribe the level doesn't have adds it as an AI rival (up
 *           to four tribes); Erase on a rival's home circle removes it.
 *
 * What the editor does NOT edit: scenario rules beyond the tribe list
 * (loadouts, objectives, scripted events, alliances, personalities). A
 * level made here plays as "destroy every rival"; campaign chapters keep
 * the rules they were loaded with.
 */

import * as THREE from 'three';
import { CivId, CIVS, WORLD_SIZE } from '../config';
import { wrapDelta } from '../core/util';
import { LevelData, levelToCode } from '../level/level-format';
import { saveLevel } from '../level/store';
import { pickGroundTile } from '../render/ground-picker';
import { walkable } from '../sim/pathfinding';
import { SPELLS, spellDef, SpellId, TribeId } from '../sim/catalog';
import { World } from '../sim/world-state';
import { appState } from './app-state';
import { css } from './dom';
import { icon, spellIcon, UiIconName } from './icons';
import { toolState } from './tools';

const TRIBE_NAMES: Record<TribeId, string> = { player: '你的部落', red: '红色敌对', gold: '金色敌对', violet: '紫色敌对' };

css('editor', `
.ed-bar { position: fixed; top: var(--edge); left: 50%; transform: translateX(-50%); display: none; flex-wrap: wrap; gap: 0.3rem;
  max-width: 94vw; z-index: 15; padding: 0.3rem; align-items: center; font: var(--t-sm) var(--font); }
.ed-bar .tg-btn { min-height: 1.9rem; padding: 0 0.6rem; }
.ed-bar .sep { width: 3px; align-self: stretch; margin: 0.15rem 0.2rem; background: repeating-linear-gradient(-35deg, #e1c088 0 2px, #8a6436 2px 4px); border-radius: 2px; }
.ed-bar select { min-height: 1.9rem; padding: 0 0.5rem; border: 0; border-radius: 0.2rem 0.35rem; background: linear-gradient(#f3e4c4, #e0c99c); color: #24160c;
  box-shadow: inset 0 1px 3px rgba(60,32,10,0.45), 0 0 0 1px #1a0e06; font: 600 var(--t-sm) var(--font); }
.ed-status { color: var(--bone-2); margin-left: 0.3rem; font-weight: 600; }
`);

export class Editor {
  /** The level currently being edited (id when re-saving an existing one). */
  private editingId: string | undefined;
  private stoneSpell: SpellId = 'lightning';
  private stoneMode: 'teach' | 'gift' = 'teach';
  private homeTribe: TribeId = 'player';
  private readonly bar: HTMLDivElement;
  private editingName = '未命名星球';
  private editingAuthor = '无名之神';
  private readonly status: HTMLSpanElement;
  private monumentBtn!: HTMLButtonElement;

  constructor(
    private readonly camera: THREE.Camera,
    private readonly camTarget: THREE.Vector3,
    private readonly world: World,
    canvas: HTMLCanvasElement,
    private readonly hooks: {
      onTest(level: LevelData): void;
      onExit(): void;
    },
  ) {
    this.bar = document.createElement('div');
    this.bar.className = 'ed-bar tg-panel';
    document.body.appendChild(this.bar);

    const tool = (label: string, t: string, title = '', ic: UiIconName = 'target') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `${icon(ic, 14)}<span></span>`;
      (b.lastChild as HTMLElement).textContent = label;
      b.title = title;
      b.className = 'tg-btn';
      b.dataset.tool = t;
      b.addEventListener('click', () => {
        toolState.tool = t as never;
        this.refresh();
      });
      this.bar.appendChild(b);
      return b;
    };

    tool('抬升', 'raise', '', 'plus');
    tool('降低', 'lower', '', 'minus');
    tool('平整', 'flatten', '在编辑器中这是笔刷，不是法术', 'hammer');
    tool('树木', 'tree', '', 'wood');
    tool('漂泊者', 'wildman', '', 'idle');
    this.monumentBtn = tool('石阵', 'monument', '放置一座立石阵（选择其法术和类型）', 'stone');
    this.select(
      SPELLS.map((s) => [s.id, s.name]),
      () => this.stoneSpell,
      (v) => {
        this.stoneSpell = v as SpellId;
        toolState.tool = 'monument';
        this.refresh();
      },
      '下一座石阵承载的法术',
    );
    this.select([['teach', '传授'], ['gift', '借出 2 次施放']], () => this.stoneMode, (v) => {
      this.stoneMode = v as 'teach' | 'gift';
      toolState.tool = 'monument';
      this.refresh();
    }, '传授：第一位共感的首领会习得它。借出：任何共感者获得两次施放；之后石阵进入沉睡。');
    tool('家园', 'home', '移动一个部落的家园圈；新部落会作为 AI 敌对加入', 'home');
    this.select(
      (Object.keys(TRIBE_NAMES) as TribeId[]).map((t) => [t, TRIBE_NAMES[t]]),
      () => this.homeTribe,
      (v) => {
        this.homeTribe = v as TribeId;
        toolState.tool = 'home';
        this.refresh();
      },
      '家园工具移动哪个部落的家园',
    );
    tool('清除', 'erase', '移除树木 / 漂泊者 / 石阵 / 敌对部落的家园', 'close');

    const sep = () => {
      const s = document.createElement('span');
      s.className = 'sep';
      this.bar.appendChild(s);
    };
    sep();

    this.action('保存', () => void this.save(), 'check');
    this.action('复制代码', () => void this.exportCode(), 'book');
    this.action('测试', () => void this.test(), 'play', true);
    this.action('退出', () => hooks.onExit(), 'close');

    this.status = document.createElement('span');
    this.status.className = 'ed-status';
    this.bar.appendChild(this.status);

    // The placement click. pointerdown (not click) to match every other
    // world interaction; gated hard on editor mode.
    canvas.addEventListener('pointerdown', (e) => {
      if (appState.mode !== 'editor' || e.button !== 0) return;
      const hit = pickGroundTile(e.clientX, e.clientY, this.camera, this.world.map, this.camTarget);
      if (hit) this.applyTool(Math.round(hit.x), Math.round(hit.z));
    });
  }

  // -------------------------------------------------------------------------

  /** Open the editor on the current world (optionally an existing saved level). */
  open(existing?: { id?: string; level: LevelData }): void {
    appState.mode = 'editor';
    this.editingId = existing?.id;
    this.editingName = existing?.level.name ?? '未命名星球';
    this.editingAuthor = existing?.level.author ?? '无名之神';
    toolState.tool = 'raise';
    this.bar.style.display = 'flex';
    this.refresh();
    this.say('雕刻地形，放置物件，然后保存 / 测试');
  }

  close(): void {
    this.bar.style.display = 'none';
  }

  // -------------------------------------------------------------------------

  private applyTool(x: number, z: number): void {
    const w = this.world;
    switch (toolState.tool) {
      case 'tree':
        if (walkable(w.map, x, z)) {
          w.trees.push({ x: w.map.wrap(x), z: w.map.wrap(z), alive: true, regrow: 0, burning: 0 });
          w.treesVersion++;
          this.say('已种植树木');
        }
        return;
      case 'wildman':
        if (walkable(w.map, x, z)) w.spawnNearWalkable('wildman', 'wild', x, z);
        return;
      case 'monument': {
        if (!walkable(w.map, x, z)) return;
        const spell = this.stoneSpell;
        const gift = this.stoneMode === 'gift';
        w.monuments.push({
          x: w.map.wrap(x), z: w.map.wrap(z), spell, mode: this.stoneMode, claimedBy: null, claimer: null, sleep: 0,
          ...(gift ? { charges: 2, cooldown: 120 } : {}),
        });
        this.say(`石阵已放置：${gift ? '借出' : '传授'} ${spellDef(spell).name}`);
        return;
      }
      case 'home': {
        if (!walkable(w.map, x, z)) return;
        const added = !w.tribes[this.homeTribe];
        w.setHome(this.homeTribe, x, z);
        this.say(added ? `${TRIBE_NAMES[this.homeTribe]} 加入了关卡` : `${TRIBE_NAMES[this.homeTribe]}：家园已移动`);
        return;
      }
      case 'erase': {
        // Nearest placeable within 2 tiles dies: trees, wildmen, monuments, then a rival's home.
        // Wrapped distance: the pick and the things on the planet may sit either side of the seam.
        const near = (ax: number, az: number) => Math.hypot(wrapDelta(ax - x, WORLD_SIZE), wrapDelta(az - z, WORLD_SIZE)) < 2;
        const ti = this.world.trees.findIndex((t) => t.alive && near(t.x, t.z));
        if (ti >= 0) {
          this.world.trees.splice(ti, 1);
          this.world.treesVersion++; // the tree renderer re-indexes its per-tree state
          return;
        }
        const mi = this.world.monuments.findIndex((m) => near(m.x, m.z));
        if (mi >= 0) {
          this.world.monuments.splice(mi, 1);
          return;
        }
        const ui = this.world.units.findIndex((u) => u.kind === 'wildman' && near(u.x, u.z));
        if (ui >= 0) {
          this.world.units.splice(ui, 1);
          return;
        }
        const rival = this.world.activeTribes().find((t) => t !== 'player' && near(this.world.tribes[t]!.home.x, this.world.tribes[t]!.home.z));
        if (rival) this.say(this.world.removeTribe(rival) ? `${TRIBE_NAMES[rival]} 已移除` : '关卡至少需要一个敌对部落');
        return;
      }
      default:
        return; // raise/lower/flatten are handled by the sculpt brush
    }
  }

  private meta() {
    return {
      name: this.editingName,
      author: this.editingAuthor,
      desc: '',
    };
  }

  private async save(): Promise<void> {
    const level = await this.world.captureLevel(this.meta());
    this.editingId = saveLevel(level, this.editingId);
    this.say(`已将「${level.name}」保存到你的关卡库`);
  }

  private async exportCode(): Promise<void> {
    const code = await levelToCode(await this.world.captureLevel(this.meta()));
    try {
      await navigator.clipboard.writeText(code);
      this.say(`分享代码已复制（${code.length} 个字符）`);
    } catch {
      prompt('复制你的关卡代码：', code); // clipboard blocked — show it instead
    }
  }

  private async test(): Promise<void> {
    const level = await this.world.captureLevel(this.meta());
    this.close();
    this.hooks.onTest(level);
  }

  private say(msg: string): void {
    this.status.textContent = msg;
  }

  private refresh(): void {
    for (const b of this.bar.querySelectorAll('button')) {
      if (!b.dataset.tool) continue;
      b.classList.toggle('on', toolState.tool === b.dataset.tool);
    }
    const spell = this.stoneSpell;
    this.monumentBtn.innerHTML = `${spellIcon(spell, 14)}<span></span>`;
    (this.monumentBtn.lastChild as HTMLElement).textContent = '石阵';
    for (const s of this.selects) s.paint();
  }

  private readonly selects: Array<{ paint(): void }> = [];

  /** A small dropdown on the bar (keys typed into it stay out of the game). */
  private select(options: Array<[string, string]>, current: () => string, pick: (v: string) => void, title: string): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.title = title;
    for (const [v, label] of options) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => pick(sel.value));
    sel.addEventListener('keydown', (e) => e.stopPropagation());
    this.bar.appendChild(sel);
    this.selects.push({ paint: () => (sel.value = current()) });
    return sel;
  }

  /** A verb button (save/code/test/exit) — no tool highlighting. */
  private action(label: string, fn: () => void, ic: UiIconName, primary = false): void {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${icon(ic, 14)}<span></span>`;
    (b.lastChild as HTMLElement).textContent = label;
    b.className = primary ? 'tg-btn primary' : 'tg-btn';
    b.addEventListener('click', fn);
    this.bar.appendChild(b);
  }

  /** Used by the library's Edit button to choose the enemy civ shown while editing. */
  setRedCiv(civ: CivId | undefined): void {
    const red = this.world.tribes.red;
    if (civ && CIVS[civ] && red) red.civ = civ;
  }
}