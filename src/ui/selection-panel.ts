/**
 * ui/selection-panel.ts — everything about what you've selected.
 *
 *   one person    portrait, name, health, what they're doing, buffs, stats
 *   many people   a grid of kinds with counts (click a kind to narrow to it,
 *                 shift-click to drop it) and the group's total health
 *   a building    name (dwellings by tier), health, construction, fire;
 *                 dwellings: residents/capacity and growth to the next tier;
 *                 lodges: the training queue with +1/+5/cancel, progress,
 *                 cost, rally point; tower/shrine: who's inside + eject;
 *                 demolish (asks twice)
 *   a stone       what it teaches or lends, the ritual, whether it's free now
 *   theirs        an inspect card (Selection.inspect): who they are and
 *                 what you could do about it — read-only, never orderable
 *
 * The panel is rebuilt only when its STRUCTURE changes (a signature of the
 * selection and the shape of what's shown); live numbers (health, timers,
 * progress) are patched into `data-k` slots a few times a second, so the
 * buttons under your cursor are never torn down mid-click.
 */

import { orderAck } from '../core/audio';
import { CIVS } from '../config';
import { BUILDINGS, DWELLING_TIERS, ECONOMY, spellDef, TribeId, UNITS, UnitKind } from '../sim/catalog';
import type { Building, Unit } from '../sim/world-state';
import { UiContext } from './context';
import { css, escapeHtml, h } from './dom';
import { fillTransform } from './bar-fill';
import { activityText, buildingName, fmtEta } from './format';
import { labelFor, orderVerb } from './hotkeys';
import { buildingIcon, icon, spellIcon, unitIcon } from './icons';
import { tribeCss } from './orders';
import { groupByKind } from './selection';
import { settings } from './settings';
import { ritualAt, ritualOf, ritualSeconds, stoneBlocked, stoneGuards, stoneName, stoneTerms } from './stones';
import { hideTip, tip } from './tooltip';

css('selection-panel', `
.sp { width: auto; min-width: 19rem; max-width: min(27rem, 100%); min-height: 7rem; padding: 0.55rem 0.7rem 0.6rem; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.45rem; }
.sp-head { display: flex; gap: 0.7rem; align-items: center; }
/* Portrait: painted on a disc of wood, ringed with the tribe's cloth. */
.sp-portrait { flex: none; width: 3.3rem; height: 3.3rem; border-radius: 50%; display: grid; place-items: center; color: #2a1708;
  background: radial-gradient(circle at 45% 35%, rgba(255,236,200,0.35), rgba(0,0,0,0.12) 70%), var(--tex-wood-light) 0 0 / 6rem;
  box-shadow: 0 0 0 0.2rem var(--tc, var(--rim-strong)), 0 0 0 0.3rem rgba(36,22,12,0.85), 0 0.15rem 0.3rem 0.3rem rgba(36,22,12,0.25); }
.sp-portrait svg { filter: drop-shadow(0 1px 0 rgba(255,236,200,0.5)); }
.sp-title { flex: 1; min-width: 0; }
.sp-name { font: 700 var(--t-lg)/1.15 var(--font-display); letter-spacing: 0.01em; display: flex; align-items: center; gap: 0.4rem; color: var(--text); }
.sp-sub { font-size: var(--t-xs); color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; display: flex; align-items: center; gap: 0.35rem; }
.sp-sub .dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--tc); box-shadow: 0 0 0 1px rgba(36,22,12,0.7); }
.sp-act { font-size: var(--t-sm); color: var(--text-2); margin-top: 0.15rem; font-weight: 600; }
.sp-hp { display: flex; align-items: center; gap: 0.5rem; font-size: var(--t-xs); font-weight: 700; color: var(--text-2); }
.sp-hp svg { color: #a3271a; }
.sp-hp .bar { flex: 1; height: 0.5rem; }
.sp-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: var(--t-sm); color: var(--text-2); font-weight: 600; }
.sp-row .lbl { color: var(--text-3); font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.08em; min-width: 4.5rem; font-weight: 700; }
.sp-chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.12rem 0.45rem; border-radius: 0.2rem 0.35rem; background: rgba(70,40,15,0.1); box-shadow: inset 0 0 0 1px var(--rim); font-size: var(--t-xs); font-weight: 700; }
.sp-chip.ward { color: #3d4f66; } .sp-chip.song { color: var(--gold); } .sp-chip.bad { color: var(--bad); background: var(--bad-soft); }
.sp-stats { display: flex; gap: 0.9rem; font-size: var(--t-xs); color: var(--text-3); font-weight: 600; }
.sp-stats b { color: var(--text); font-weight: 800; }
.sp-kinds { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.4rem, 1fr)); gap: 0.35rem; }
.sp-kind { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.45rem; border: 0; cursor: pointer; font: inherit; text-align: left; color: var(--bone);
  border-radius: 0.25rem 0.4rem 0.3rem 0.45rem; background: linear-gradient(180deg, rgba(255,226,180,0.2), rgba(0,0,0,0.2)), var(--tex-wood-light) 0 0 / 8rem;
  box-shadow: inset 0 1px 0 rgba(255,236,200,0.45), 0 0 0 1px #1d1008, 0 2px 0 1px #1d1008; text-shadow: 0 1px 0 rgba(0,0,0,0.8); }
.sp-kind:hover { filter: brightness(1.12); }
.sp-kind:active { transform: translateY(1px); }
.sp-kind svg { color: var(--bone); }
.sp-kind .n { font-size: var(--t-lg); font-weight: 800; }
.sp-kind .k { font-size: var(--t-xs); color: var(--bone-2); line-height: 1.1; font-weight: 600; }
.sp-pips { display: flex; gap: 0.2rem; }
.sp-pips i { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: rgba(70,40,15,0.18); box-shadow: inset 0 1px 1px rgba(40,20,5,0.5); }
.sp-pips i.on { background: radial-gradient(circle at 40% 35%, #c8f0a0, #4f8d2c); box-shadow: 0 0 0 1px rgba(30,50,10,0.6); }
.sp-pips i.q { background: radial-gradient(circle at 40% 35%, #e8ffff, #2f9ba6); box-shadow: 0 0 0 1px rgba(10,50,56,0.6); }
.sp-queue { display: flex; align-items: center; gap: 0.35rem; }
.sp-queue .tg-btn { min-height: 1.7rem; padding: 0 0.5rem; }
.sp-train { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; font-size: var(--t-xs); color: var(--text-2); }
.sp-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: auto; }
.sp-actions .tg-btn { min-height: 1.75rem; }
.sp-warn { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.5rem; border-radius: 0.2rem 0.35rem; background: linear-gradient(rgba(150,36,16,0.88), rgba(110,26,12,0.92)); color: #ffe4da; font-size: var(--t-sm); font-weight: 700; }
.sp-warn.soft { background: rgba(163,39,26,0.12); color: var(--bad); box-shadow: inset 0 0 0 1px rgba(163,39,26,0.35); }
.sp-inside { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.sp-inside span { width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; background: rgba(70,40,15,0.1); box-shadow: inset 0 0 0 1px var(--rim); color: var(--text); }
.sp-inside span.empty { opacity: 0.45; }
.sp-spell { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.55rem; border-radius: 0.25rem 0.4rem; background: radial-gradient(circle at 50% 60%, #7d776c, #4f4a43); color: var(--spirit); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.45); }
.sp-spell svg { filter: drop-shadow(0 0 0.25rem rgba(134,227,234,0.8)); }
.sp-spell b { color: var(--bone); }
.sp-spell-blurb { color: var(--bone-2); font-size: var(--t-xs); font-weight: 500; }
.sp-note { font-size: var(--t-sm); color: var(--text-2); line-height: 1.4; }
.sp-note b { color: var(--text); }
.sp-how { display: flex; align-items: center; gap: 0.35rem; color: var(--gold); font-weight: 700; }
.sp-warnword { color: var(--warn); font-weight: 700; }
.sp-empty { color: var(--text-3); font-size: var(--t-sm); display: flex; align-items: center; gap: 0.5rem; }
`);

const tribeLabel = (ctx: UiContext, t: string): string => {
  if (t === 'player') return '你的部落';
  if (t === 'wild') return '无部落';
  const civ = ctx.world.tribes[t as TribeId]?.civ;
  return `${civ ? CIVS[civ].name : '未知部落'} · ${t}`;
};

export class SelectionPanel {
  readonly el: HTMLDivElement;
  private sig = '';
  private confirmDemolish = 0;
  /** Set by the Rally button: the next ground click sets this building's rally point. */
  rallyPick: number | null = null;

  constructor(private readonly ctx: UiContext) {
    this.el = h('div.sp.tg-panel.mat-hide');
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  // ---------------------------------------------------------------------------

  private onClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!t) return;
    const w = this.ctx.world;
    const sel = this.ctx.selection;
    const a = t.dataset.a!;
    const bid = sel.building;
    switch (a) {
      case 'kind': {
        const kind = t.dataset.kind as UnitKind;
        const ids = [...sel.units].filter((id) => w.unitById(id)?.kind === kind);
        if (e.shiftKey) sel.setUnits([...sel.units].filter((id) => !ids.includes(id)));
        else sel.setUnits(ids);
        hideTip();
        break;
      }
      case 'q':
        if (bid !== null) {
          w.queueTraining(bid, Number(t.dataset.n));
          orderAck('train');
        }
        break;
      case 'eject':
        if (bid !== null) w.ejectGarrison(bid);
        break;
      case 'rally':
        this.rallyPick = bid;
        break;
      case 'demolish':
        if (bid === null) break;
        if (performance.now() < this.confirmDemolish) {
          w.demolish(bid);
          sel.clear();
          this.confirmDemolish = 0;
        } else {
          this.confirmDemolish = performance.now() + 3000;
          this.sig = ''; // re-render to show the confirm state
        }
        break;
      case 'commune': {
        const leader = w.leaderOf('player');
        if (leader && sel.monument !== null) w.orderWorship([leader.id], sel.monument);
        break;
      }
      case 'focus': {
        const x = Number(t.dataset.x), z = Number(t.dataset.z);
        this.ctx.actions.centreOn(x, z);
        break;
      }
    }
    this.update();
  }

  /** Called by the demolish hotkey: same two-step confirm as the button. */
  demolishSelected(): void {
    const btn = this.el.querySelector<HTMLElement>('[data-a="demolish"]');
    btn?.click();
  }

  // ---------------------------------------------------------------------------

  update(): void {
    const w = this.ctx.world;
    const sel = this.ctx.selection;
    sel.prune((id) => !!w.unitById(id), (id) => !!w.getBuilding(id));
    // Someone you were looking at just joined you (Kindled, or stranded kin reached home): now they're yours.
    if (sel.inspect !== null && w.unitById(sel.inspect)?.tribe === 'player') sel.setUnits([sel.inspect]);
    if (this.rallyPick !== null && sel.building !== this.rallyPick) this.rallyPick = null;

    let sig: string;
    let render: () => string;
    const units = [...sel.units].map((id) => w.unitById(id)).filter((u): u is Unit => !!u);
    if (sel.building !== null) {
      const b = w.getBuilding(sel.building)!;
      const trains = BUILDINGS[b.kind].trains;
      sig = `b${b.id}|${b.tier}|${b.progress >= 1}|${b.burning > 0}|${b.garrison.join(',')}|${trains ? b.queue : ''}|${performance.now() < this.confirmDemolish}|${this.rallyPick}`;
      render = () => this.renderBuilding(b);
    } else if (sel.monument !== null) {
      const m = w.monuments[sel.monument];
      sig = `m${sel.monument}|${w.monumentAvailable(m)}|${m.claimedBy}|${!!m.guardsAwake}`;
      render = () => this.renderMonument(sel.monument!);
    } else if (sel.inspect !== null && w.unitById(sel.inspect)) {
      const u = w.unitById(sel.inspect)!;
      sig = `i${u.id}|${u.kind}|${u.tribe}`;
      render = () => this.renderUnit(u);
    } else if (units.length === 1) {
      const u = units[0];
      sig = `u${u.id}|${u.kind}|${u.wardTime > 0}|${u.warsongTime > 0}|${!!ritualOf(w, u.id)}`;
      render = () => this.renderUnit(u);
    } else if (units.length > 1) {
      const groups = groupByKind(units);
      sig = `g${sel.version}|${groups.map((g) => `${g.kind}${g.ids.length}`).join(',')}`;
      render = () => this.renderGroup(units);
    } else {
      sig = 'none';
      render = () => '';
    }
    sig += `|${settings.leftClickOrders}`; // the panel's wording names the order click
    if (sig !== this.sig) {
      this.sig = sig;
      this.el.innerHTML = render();
      this.el.hidden = sig.startsWith('none');
      for (const k of this.el.querySelectorAll<HTMLElement>('[data-kind]')) {
        const kind = k.dataset.kind as UnitKind;
        tip(k, () => `<h4>${UNITS[kind].name}</h4><p>${escapeHtml(UNITS[kind].blurb)}</p><p class="hint">点击：只选择这些。按住 Shift 点击：取消选择。</p>`);
      }
      for (const b of this.el.querySelectorAll<HTMLElement>('[data-tip]')) tip(b, () => b.dataset.tip!);
    }
    this.patch(units);
  }

  /** Live numbers into data-k slots. */
  private patch(units: Unit[]): void {
    const w = this.ctx.world;
    const set = (k: string, text: string) => {
      const el = this.el.querySelector(`[data-k="${k}"]`);
      if (el && el.textContent !== text) el.textContent = text;
    };
    const bar = (k: string, frac: number) => {
      const el = this.el.querySelector<HTMLElement>(`[data-k="${k}"]`);
      const t = fillTransform(frac);
      if (el && el.style.transform !== t) el.style.transform = t;
    };
    const sel = this.ctx.selection;
    if (sel.building !== null) {
      const b = w.getBuilding(sel.building);
      if (!b) return;
      bar('hp', b.progress < 1 ? b.progress : b.hp / b.maxHp);
      set('hpt', b.progress < 1 ? `已建造 ${Math.floor(b.progress * 100)}%` : `${Math.ceil(b.hp)} / ${b.maxHp}`);
      if (b.kind === 'hut') {
        set('res', `${b.residents} / ${w.dwellingCapacity(b)}`);
        const next = DWELLING_TIERS[b.tier + 1];
        if (next) {
          const full = b.residents >= DWELLING_TIERS[b.tier].capacity;
          bar('grow', b.fullTime / next.growSeconds);
          const wood = w.tribes[b.tribe]?.wood ?? 0;
          set('growt', !full
            ? `满员后升级`
            : b.fullTime >= next.growSeconds && wood < next.growWood
              ? `还缺 ${next.growWood - wood} 木材即可升级`
              : `${fmtEta(next.growSeconds - b.fullTime)}后升级`);
        }
      }
      const trains = BUILDINGS[b.kind].trains;
      if (trains) {
        const inside = b.trainee >= 0 && w.unitById(b.trainee)?.garrison === b.id;
        const def = UNITS[trains];
        bar('train', inside ? 1 - b.trainTime / def.trainSeconds : 0);
        const wood = w.tribes[b.tribe]?.wood ?? 0;
        set('traint', b.queue === 0
          ? '队列为空'
          : inside
            ? `正在训练${def.name} · ${fmtEta(b.trainTime)}`
            : b.trainee >= 0
              ? '村民正在赶来的路上'
              : wood < def.trainWood
                ? `还缺 ${def.trainWood - wood} 木材`
                : '等待一名闲置村民');
        set('qn', `${b.queue}`);
      }
    } else if (sel.monument !== null) {
      const m = w.monuments[sel.monument];
      if (m) set('sleep', m.sleep > 0 ? `沉睡——${fmtEta(m.sleep)}后苏醒` : '');
      const r = ritualAt(w, sel.monument);
      const row = this.el.querySelector<HTMLElement>('[data-k="ritrow"]');
      if (row) row.hidden = !r;
      if (r) {
        bar('rit', r.progress);
        set('ritt', `${r.tribe === 'player' ? '你的首领' : '敌对部落'} · ${Math.round(r.progress * 100)}%${!r.communing ? ' · 已中断，正在消逝' : r.contested ? ' · 僵持中' : ''}`);
      }
    } else if (units.length === 1 || sel.inspect !== null) {
      const u = units[0] ?? w.unitById(sel.inspect!);
      if (!u) return;
      const r = ritualOf(w, u.id);
      if (r) {
        bar('rit', r.ritual.progress);
        set('ritt', r.ritual.contested
          ? `${Math.round(r.ritual.progress * 100)}% · 僵持中——石圈内的敌人拖住了仪式`
          : `${Math.round(r.ritual.progress * 100)}% · 剩余${fmtEta((1 - r.ritual.progress) * ritualSeconds(w.monuments[r.index]))}`);
      }
      bar('hp', u.hp / u.maxHp);
      set('hpt', `${Math.ceil(u.hp)} / ${u.maxHp}`);
      const inside = u.garrison >= 0 ? w.getBuilding(u.garrison)?.kind ?? null : null;
      set('act', activityText(u, inside));
      set('ward', u.wardTime > 0 ? `${Math.ceil(u.wardTime)}s` : '');
      set('song', u.warsongTime > 0 ? `${Math.ceil(u.warsongTime)}s` : '');
    } else if (units.length > 1) {
      const hp = units.reduce((s, u) => s + u.hp, 0);
      const max = units.reduce((s, u) => s + u.maxHp, 0);
      bar('hp', hp / max);
      set('hpt', `${Math.round((hp / max) * 100)}%`);
    }
  }

  // ---------------------------------------------------------------------------

  private head(iconHtml: string, tc: string, name: string, sub: string, extra = ''): string {
    return `<div class="sp-head"><div class="sp-portrait" style="--tc:${tc}">${iconHtml}</div>` +
      `<div class="sp-title"><div class="sp-name">${escapeHtml(name)}</div>` +
      `<div class="sp-sub"><span class="dot" style="--tc:${tc}"></span>${escapeHtml(sub)}</div>${extra}</div></div>`;
  }

  private hpRow(): string {
    return `<div class="sp-hp">${icon('heart', 14)}<div class="bar"><i data-k="hp"></i></div><span data-k="hpt"></span></div>`;
  }

  private renderUnit(u: Unit): string {
    const def = UNITS[u.kind];
    const tc = tribeCss(u.tribe);
    const civ = u.kind === 'shaman' && u.tribe !== 'wild' ? this.ctx.world.tribes[u.tribe as TribeId]?.civ : undefined;
    const name = civ ? `${def.name} · ${CIVS[civ].leaderTitle.replace(/^the /, '')}` : def.name;
    let html = this.head(unitIcon(u.kind, 34), tc, name, tribeLabel(this.ctx, u.tribe), `<div class="sp-act" data-k="act"></div>`);
    html += this.hpRow();
    const chips: string[] = [];
    if (u.wardTime > 0) chips.push(`<span class="sp-chip ward">${icon('shield', 12)}石之庇护 <span data-k="ward"></span></span>`);
    if (u.warsongTime > 0) chips.push(`<span class="sp-chip song">${icon('speed', 12)}战歌 <span data-k="song"></span></span>`);
    if (chips.length) html += `<div class="sp-row">${chips.join('')}</div>`;
    const stats: string[] = [];
    if (def.dmg > 0) stats.push(`伤害 <b>${def.dmg}</b>`);
    if (def.range > 1.5) stats.push(`射程 <b>${def.range}</b>`);
    if (def.armor > 0) stats.push(`护甲 <b>${Math.round(def.armor * 100)}%</b>`);
    stats.push(`速度 <b>${def.speed}</b>`);
    html += `<div class="sp-stats">${stats.map((s) => `<span>${s}</span>`).join('')}</div>`;
    const verb = orderVerb(settings.leftClickOrders);
    if (u.tribe === 'player' && u.kind === 'shaman') {
      const r = ritualOf(this.ctx.world, u.id);
      if (r) {
        html += `<div class="sp-row"><span class="lbl">仪式</span><div class="sp-train"><div class="bar mana"><i data-k="rit"></i></div><span data-k="ritt"></span></div></div>` +
          `<div class="sp-warn soft">${icon('shield', 14)}共感仪式会让首领门户大开：受到的伤害会中断仪式。让战士守在身边。</div>`;
      } else {
        html += `<div class="sp-note">选择一个法术，然后点击世界施放。若要习得法术，${verb}一座立石阵：你的首领会前往那里共感。</div>`;
      }
    } else if (u.tribe === 'player' && u.kind === 'brave') {
      html += `<div class="sp-note">村民会自行劳作。右键点击神龛可派他们前往祈祷，或由备役木屋的训练队列将他们训练成战士。</div>`;
    } else if (u.tribe === 'wild' && u.joins) {
      html += `<div class="sp-note">${escapeHtml(tribeLabel(this.ctx, u.joins))}的流落族人：在一条可通行的道路将他们与你的家连接起来之前，你还不能号令他们——路通后他们就会加入。</div>`;
    } else if (u.tribe === 'wild' && (u.guardOf ?? -1) >= 0) {
      html += `<div class="sp-note">立石阵的守卫。它静静伫立，直到那里的仪式开始，之后会与范围内的一切部落交战。</div>`;
    } else if (u.tribe === 'wild') {
      html += `<div class="sp-note">${escapeHtml(def.blurb)} 你还不能号令他们：<b>感化</b>可以将漂泊者收入你的部落。</div>`;
    } else if (u.tribe !== 'player') {
      html += `<div class="sp-note">敌对部落的一名${escapeHtml(def.name)}。选中你的战士并${verb}它以发起攻击。</div>`;
    }
    return html;
  }

  private renderGroup(units: Unit[]): string {
    const groups = groupByKind(units);
    const own = units.every((u) => u.tribe === 'player');
    let html = `<div class="sp-head"><div class="sp-title"><div class="sp-name">已选中 ${units.length} 个单位</div>` +
      `<div class="sp-sub">${own ? `${orderVerb(settings.leftClickOrders)}地面以命令他们出发` : '混编'}</div></div></div>`;
    html += `<div class="sp-kinds">${groups
      .map((g) => `<button type="button" class="sp-kind" data-a="kind" data-kind="${g.kind}">${unitIcon(g.kind, 24)}<span><div class="n">${g.ids.length}</div><div class="k">${UNITS[g.kind].name}</div></span></button>`)
      .join('')}</div>`;
    html += this.hpRow();
    return html;
  }

  private renderBuilding(b: Building): string {
    const w = this.ctx.world;
    const def = BUILDINGS[b.kind];
    const ours = b.tribe === 'player';
    const tc = tribeCss(b.tribe);
    const status = b.progress < 1 ? '建造中' : tribeLabel(this.ctx, b.tribe);
    let html = this.head(buildingIcon(b.kind, 32), tc, buildingName(b), status);
    if (b.burning > 0) html += `<div class="sp-warn">${icon('fire', 16)}着火了！附近的村民会去扑灭它。</div>`;
    html += this.hpRow();

    if (b.progress >= 1 && b.kind === 'hut') {
      const tier = DWELLING_TIERS[b.tier];
      const cap = w.dwellingCapacity(b);
      html += `<div class="sp-row"><span class="lbl">住户</span><div class="sp-pips">${Array.from({ length: cap }, (_, i) => `<i class="${i < b.residents ? 'on' : ''}"></i>`).join('')}</div><span data-k="res"></span></div>`;
      const next = DWELLING_TIERS[b.tier + 1];
      if (next) {
        html += `<div class="sp-row"><span class="lbl">升级</span><div class="sp-train"><div class="bar gold"><i data-k="grow"></i></div><span data-k="growt"></span></div></div>` +
          `<div class="sp-note">一座满员的${tier.name}会在${next.growSeconds}秒后升级为${next.name}（${next.capacity} 张床），需花费 ${next.growWood} 木材。</div>`;
      } else {
        html += `<div class="sp-note">已完全成长：${tier.capacity} 张床，只要有空位，每${tier.breedSeconds}秒就会诞生一名村民。</div>`;
      }
    }

    const trains = def.trains;
    if (b.progress >= 1 && trains) {
      const ud = UNITS[trains];
      if (ours) {
        html += `<div class="sp-row"><span class="lbl">训练</span><div class="sp-train"><div class="bar mana"><i data-k="train"></i></div><span data-k="traint"></span></div></div>` +
          `<div class="sp-row"><span class="lbl">队列</span><div class="sp-queue">` +
          `<span class="sp-pips">${Array.from({ length: ECONOMY.trainQueueMax }, (_, i) => `<i class="${i < b.queue ? 'q' : ''}"></i>`).join('')}</span>` +
          `<button type="button" class="tg-btn" data-a="q" data-n="1" data-tip="&lt;h4&gt;训练一名${ud.name}&lt;/h4&gt;&lt;p&gt;每名需 ${ud.trainWood} 木材和 ${ud.trainSeconds} 秒。一名闲置村民走进去，出来时就是一名${ud.name}。&lt;/p&gt;">${icon('plus', 14)}1</button>` +
          `<button type="button" class="tg-btn" data-a="q" data-n="5">${icon('plus', 14)}5</button>` +
          `<button type="button" class="tg-btn" data-a="q" data-n="-1" aria-label="取消一名" data-tip="&lt;h4&gt;取消一名&lt;/h4&gt;">${icon('minus', 14)}</button>` +
          `</div></div>`;
      } else {
        html += `<div class="sp-note">训练${ud.name}。</div>`;
      }
    }

    if (b.progress >= 1 && (b.kind === 'tower' || b.kind === 'shrine')) {
      const cap = b.kind === 'tower' ? ECONOMY.towerGarrison : ECONOMY.shrineWorshippers;
      const slots = Array.from({ length: cap }, (_, i) => {
        const u = b.garrison[i] !== undefined ? w.unitById(b.garrison[i]) : undefined;
        return u ? `<span title="${UNITS[u.kind].name}">${unitIcon(u.kind, 16)}</span>` : `<span class="empty">${icon('plus', 12)}</span>`;
      });
      html += `<div class="sp-row"><span class="lbl">${b.kind === 'shrine' ? '祈祷者' : '驻守'}</span><div class="sp-inside">${slots.join('')}</div></div>`;
      if (ours) {
        html += `<div class="sp-note">${b.kind === 'shrine'
          ? `选中村民并右键点击神龛，派他们前往祈祷（每名祈祷者法术充能加快 +${Math.round(ECONOMY.shrinePrayerBonus * 100)}%）。`
          : '选中战士并右键点击瞭望塔派人驻守。他们在塔顶看得更远、打得更狠。'}</div>`;
      }
    }

    if (b.progress >= 1 && b.kind === 'lumberyard') html += `<div class="sp-note">${escapeHtml(def.blurb)}</div>`;

    if (ours) {
      const confirm = performance.now() < this.confirmDemolish;
      const acts: string[] = [];
      if (b.progress >= 1 && trains) {
        acts.push(`<button type="button" class="tg-btn${this.rallyPick === b.id ? ' on' : ''}" data-a="rally" data-tip="&lt;h4&gt;集结点&lt;/h4&gt;&lt;p&gt;点击，然后点击地面：新训练的${UNITS[trains].name}会在那里集合。（或选中备役木屋后右键点击地面。）&lt;/p&gt;">${icon('rally', 14)}${this.rallyPick === b.id ? '点击地面…' : '集结点'}</button>`);
      }
      if (b.garrison.length > 0 && (b.kind === 'tower' || b.kind === 'shrine')) acts.push(`<button type="button" class="tg-btn" data-a="eject">${icon('eject', 14)}遣出</button>`);
      acts.push(`<button type="button" class="tg-btn danger${confirm ? ' on' : ''}" data-a="demolish" style="margin-left:auto" data-tip="&lt;h4&gt;拆除 &lt;span class='kbd'&gt;${labelFor('demolish')}&lt;/span&gt;&lt;/h4&gt;&lt;p&gt;将其拆毁。返还一半木材（${Math.floor(def.wood / 2)}）。&lt;/p&gt;">${icon('demolish', 14)}${confirm ? '再次点击确认拆除' : '拆除'}</button>`);
      html += `<div class="sp-actions">${acts.join('')}</div>`;
    }
    return html;
  }

  private renderMonument(index: number): string {
    const w = this.ctx.world;
    const m = w.monuments[index];
    const s = spellDef(m.spell);
    const avail = w.monumentAvailable(m);
    let html = this.head(icon('stone', 32), avail ? 'var(--spirit)' : 'var(--rim-strong)', stoneName(m), `立石阵 · 第${s.tier}阶`);
    html += `<div class="sp-spell">${spellIcon(m.spell, 26)}<div><b>${escapeHtml(stoneTerms(m))}</b><div class="sp-spell-blurb">${escapeHtml(s.blurb)}</div></div></div>`;
    let note: string;
    if (m.mode === 'teach') {
      note = avail
        ? `第一个在此完成${ritualSeconds(m)}秒仪式的首领将永久习得${escapeHtml(s.name)}。受到的伤害会中断仪式。`
        : m.claimedBy === 'player' ? '你的部落已经在这里习得该法术。' : `已被${escapeHtml(tribeLabel(this.ctx, m.claimedBy ?? ''))}占据。`;
    } else {
      note = `一次${ritualSeconds(m)}秒的仪式可获得 ${m.charges ?? 2} 次免费施放，无论是否已习得。之后石阵将沉睡 ${m.cooldown ?? 90} 秒。`;
    }
    html += `<div class="sp-note">${note} <span data-k="sleep" class="sp-warnword"></span></div>`;
    const guards = stoneGuards(m);
    if (guards) html += `<div class="sp-warn soft">${icon('shield', 14)}${escapeHtml(guards)}</div>`;
    html += `<div class="sp-row" data-k="ritrow"><span class="lbl">仪式</span><div class="sp-train"><div class="bar mana"><i data-k="rit"></i></div><span data-k="ritt"></span></div></div>`;
    const leader = w.leaderOf('player');
    if (avail) {
      const verb = orderVerb(settings.leftClickOrders);
      html += `<div class="sp-note sp-how">${icon('leader', 14)} 选中你的首领（<span class="kbd">${labelFor('select-leader')}</span>）并${verb}这座石阵。</div>` +
        `<div class="sp-actions"><button type="button" class="tg-btn" data-a="commune" ${leader ? '' : 'disabled'}>${icon('worship', 14)}派出首领</button></div>`;
    } else {
      const why = stoneBlocked(w, m);
      if (why) html += `<div class="sp-note sp-warnword">${escapeHtml(why)}</div>`;
    }
    return html;
  }
}