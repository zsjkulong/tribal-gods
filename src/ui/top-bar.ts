/**
 * ui/top-bar.ts — the tribe at a glance (top left) and time (top right).
 *
 * LEFT, one timber board: wood · population/cap (housed, idle villagers —
 * click to find one) · mana flowing into spells · villagers praying ·
 * the leader (alive, or back in N seconds — click to look at them).
 *
 * RIGHT: the game clock, pause and 1×/2×/3× speed, and the menu button.
 *
 * Every number comes from world.tribeSummary('player') (catalog.ts
 * TribeSummary). Updated a few times a second; text is only touched when
 * it changes.
 */

import { isSpeedUnlocked, playInterstitialAd, unlockSpeeds } from '../platform/4399-ads';
import { SPELLS } from '../sim/catalog';
import { fmtClock, fmtRate } from './format';
import { appState, SPEEDS } from './app-state';
import { UiContext } from './context';
import { css, h, setClass, setText } from './dom';
import { labelFor } from './hotkeys';
import { icon } from './icons';
import { carve } from './lettering';
import { tip } from './tooltip';

css('top-bar', `
.tb-left { position: absolute; top: var(--edge); left: var(--edge); display: flex; align-items: stretch; padding: 0.1rem 0.15rem; gap: 0; }
.tb-stat { display: flex; align-items: center; gap: 0.45rem; padding: 0.22rem 0.65rem 0.22rem 0.45rem; position: relative; }
/* Dividers: a cord tied round the board. */
.tb-stat + .tb-stat::before { content: ''; position: absolute; left: -1px; top: 12%; bottom: 12%; width: 3px;
  background: repeating-linear-gradient(-35deg, #e1c088 0 2px, #8a6436 2px 4px); box-shadow: 0 0 0 1px rgba(16, 8, 3, 0.85); border-radius: 2px; }
.tb-stat svg { color: var(--bone-2); }
.tb-stat .v { font: 700 var(--t-lg)/1.05 var(--font); letter-spacing: 0; color: var(--bone); text-shadow: 0 1px 0 rgba(0,0,0,0.85); }
.tb-stat .l { font-size: var(--t-xs); color: var(--bone-3); line-height: 1.15; white-space: nowrap; font-weight: 600; }
.tb-stat.wood svg { color: var(--wood); }
.tb-stat.mana svg, .tb-stat.mana .v { color: var(--spirit); }
.tb-stat.pop svg { color: var(--bone); }
.tb-stat.pray svg { color: var(--ochre-hi); }
.tb-stat.leader svg { color: var(--ochre-hi); }
.tb-stat.leader.down svg, .tb-stat.leader.down .v { color: var(--bad); }
.tb-stat.dim > *:not(.l) { opacity: 0.55; }
button.tb-stat { appearance: none; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
button.tb-stat:hover { background: rgba(255, 226, 180, 0.08); }
.tb-idle { display: inline-flex; align-items: center; gap: 0.2rem; margin-left: 0.3rem; padding: 0.1rem 0.4rem 0.1rem 0.25rem; border: 0;
  border-radius: 0.18rem 0.3rem 0.22rem 0.32rem; background: linear-gradient(#efe1c2, #cdb48a); color: #3a2614;
  box-shadow: 0 0 0 1px rgba(20,10,4,0.8); font: 700 var(--t-xs)/1 var(--font); cursor: pointer; vertical-align: 1px; }
.tb-idle:hover { filter: brightness(1.08); }
.tb-idle.has { background: linear-gradient(#ffd27a, #d39537); color: #2a1606; }
.tb-right { position: absolute; top: var(--edge); right: var(--edge); display: flex; align-items: center; gap: 0.35rem; padding: 0.2rem; }
.tb-clock { display: flex; align-items: center; gap: 0.35rem; padding: 0 0.5rem 0 0.35rem; font: 700 var(--t-md)/1 var(--font); min-width: 4rem; color: var(--bone); }
.tb-clock svg { color: var(--ochre-hi); }
.tb-speed { display: flex; gap: 0.2rem; }
.tb-speed .tg-btn { min-height: 1.7rem; padding: 0 0.45rem; font-weight: 700; }
.tb-right > .tg-btn.icon-only { min-height: 1.7rem; min-width: 1.9rem; }
.tb-paused { padding: 0.35rem 1.1rem 0.3rem; font-size: 1.15rem; line-height: 0; }
`);

export class TopBar {
  private readonly v: Record<string, HTMLElement> = {};
  private readonly idleBtn: HTMLButtonElement;
  private readonly leaderStat: HTMLButtonElement;
  private readonly prayStat: HTMLElement;
  private readonly speedBtns: HTMLButtonElement[] = [];
  private readonly pauseBtn: HTMLButtonElement;
  /** Game-ui moves this into the top-centre column so it stacks with the narrator and hints. */
  readonly pausedBanner: HTMLDivElement;
  private shownPaused = false;
  /** 上次 update() 观察到的各倍速解锁签名（如 '100'），变化时刷新按钮文字。 */
  private speedSig = '100';

  constructor(private readonly ctx: UiContext, parent: HTMLElement) {
    const left = h('div.tb-left.tg-panel');
    const stat = (cls: string, ic: string, key: string, label: string, tag: 'div' | 'button' = 'div') => {
      const v = h('div.v');
      const l = h('div.l', { text: label });
      const el: HTMLElement = h(tag, { class: `tb-stat ${cls}`, html: icon(ic as never, 22) }, h('div', {}, v, l));
      if (tag === 'button') el.setAttribute('type', 'button');
      this.v[key] = v;
      this.v[key + 'L'] = l;
      left.appendChild(el);
      return el;
    };

    const wood = stat('wood', 'wood', 'wood', '木材');
    tip(wood, () => `<h4>木材</h4><p>村民砍倒树木并把原木拖回家。建造建筑、训练单位和提升民居都要消耗木材。</p>`);

    const pop = stat('pop', 'population', 'pop', '已入住');
    this.idleBtn = h('button.tb-idle.tg-hit', { type: 'button', html: icon('idle', 14) + '<span>0</span>' });
    this.idleBtn.addEventListener('click', () => ctx.actions.nextIdleVillager());
    this.v.popL.textContent = '';
    this.v.housed = h('span');
    this.v.popL.append(this.v.housed, this.idleBtn);
    tip(pop, () => {
      const s = ctx.world.tribeSummary('player');
      return `<h4>人口</h4><p>${s.population} 人，上限 ${s.popCap} 人。${s.housed} 人居住在民居中——民居会孕育新的村民，并供养你的法力。</p>` +
        `<p class="hint">建造更多民居可提升人口上限。</p>`;
    });
    tip(this.idleBtn, () => `<h4>闲置村民 <span class="kbd">${labelFor('idle-villager')}</span></h4><p>点击跳到下一个无事可做的村民。</p>`);

    const mana = stat('mana', 'mana', 'mana', '法力');
    tip(mana, () => {
      const t = ctx.world.tribes.player;
      return `<h4>法力</h4><p>你子民的信仰，流入每一个正在充能的法术。更多人口、更多民居和更多祈祷意味着更快的充能。</p>` +
        (t && t.manaRate === 0 && t.income > 0 ? `<p class="why">没有法术在充能——法力正在白白流失。</p>` : '');
    });

    this.prayStat = stat('pray', 'prayer', 'pray', '祈祷中');
    tip(this.prayStat, () => `<h4>祈祷</h4><p>在神龛内的村民会放下工作开始祈祷。每多一个祈祷者，所有充能法术的速度都会加快。</p>`);

    this.leaderStat = stat('leader', 'leader', 'leader', '首领', 'button') as HTMLButtonElement;
    this.leaderStat.classList.add('tg-hit');
    this.leaderStat.addEventListener('click', () => {
      const s = ctx.world.tribeSummary('player');
      if (!s.leaderAlive && s.leaderRespawn > 0) {
        playInterstitialAd();
        ctx.world.reviveLeader('player');
      } else {
        ctx.actions.centreOnLeader();
      }
    });
    tip(this.leaderStat, () => {
      const s = ctx.world.tribeSummary('player');
      return !s.leaderAlive && s.leaderRespawn > 0
        ? `<h4>首领阵亡</h4><p>看一段广告即可让首领在氏族石阵处复活。</p>`
        : `<h4>你的首领 <span class="kbd">${labelFor('centre-leader')}</span></h4><p>首领能施放一切法术。若他们倒下，看一段广告即可让他们在氏族石阵处复活。</p><p class="hint">点击来查看他。</p>`;
    });
    parent.appendChild(left);

    // --- Right cluster: clock, speed, menu ---
    const right = h('div.tb-right.tg-panel');
    const clock = h('div.tb-clock', { html: icon('clock', 16) });
    this.v.clock = h('span');
    clock.appendChild(this.v.clock);
    tip(clock, () => `<h4>时间</h4><p>本场景已经进行了多久。</p>`);
    const speed = h('div.tb-speed');
    this.pauseBtn = h('button.tg-btn', { type: 'button', 'aria-label': '暂停', html: icon('pause', 16) });
    this.pauseBtn.addEventListener('click', () => ctx.actions.togglePause());
    tip(this.pauseBtn, () => `<h4>${appState.paused ? '继续' : '暂停'} <span class="kbd">${labelFor('pause')}</span></h4><p>时间停止；你仍然可以环顾四周、选择单位和制定计划。</p>`);
    speed.appendChild(this.pauseBtn);
    for (const n of SPEEDS) {
      const b = h('button.tg-btn', { type: 'button' });
      b.addEventListener('click', () => this.speedClick(n));
      tip(b, () => (n > 1 && !isSpeedUnlocked(n))
        ? `<h4>广告</h4><p>看一段广告即可解锁 ${n}× 倍速。</p>`
        : `<h4>速度 ${n}× <span class="kbd">${labelFor('speed-down')}</span><span class="kbd">${labelFor('speed-up')}</span></h4><p>${n === 1 ? '正常节奏。' : `时间以 ${n} 倍速流逝。`}</p>`);
      speed.appendChild(b);
      this.speedBtns.push(b);
    }
    this.refreshSpeedBtns();
    const menu = h('button.tg-btn.icon-only', { type: 'button', 'aria-label': '菜单', html: icon('menu', 18) });
    menu.addEventListener('click', () => ctx.actions.openMenu());
    tip(menu, () => `<h4>菜单 <span class="kbd">Esc</span></h4><p>设置、玩法说明、重新开始、退出。</p>`);
    right.append(clock, speed, menu);
    parent.appendChild(right);

    this.pausedBanner = h('div.tb-paused.tg-panel.mat-hide.passthrough', { html: carve('已暂停') });
    this.pausedBanner.hidden = true;
    parent.appendChild(this.pausedBanner);
  }

  /** 点击速度按钮：2×/3× 未解锁时先看广告，其余情况直接切换。 */
  private speedClick(n: number): void {
    if (n > 1 && !isSpeedUnlocked(n)) {
      playInterstitialAd();
      unlockSpeeds(n);
    }
    this.ctx.actions.setSpeed(n);
  }

  /** 按当前解锁状态刷新按钮文字：未解锁的 2×/3× 显示为「广告」。 */
  private refreshSpeedBtns(): void {
    this.speedBtns.forEach((b, i) => {
      const n = SPEEDS[i];
      const locked = n > 1 && !isSpeedUnlocked(n);
      b.textContent = locked ? '广告' : `${n}×`;
      b.setAttribute('aria-label', locked ? `看广告解锁 ${n}× 速度` : `速度 ${n}×`);
    });
  }

  update(): void {
    const w = this.ctx.world;
    const s = w.tribeSummary('player');
    setText(this.v.wood, String(s.wood));
    setText(this.v.pop, `${s.population}/${s.popCap}`);
    setText(this.v.housed, `${s.housed} 人入住`);
    setText(this.idleBtn.lastElementChild!, String(s.idleVillagers));
    setClass(this.idleBtn, 'has', s.idleVillagers > 0);
    setText(this.v.mana, fmtRate(w.tribes.player?.income ?? s.manaRate));
    // Idle mana is only a problem when something could be filling: all full is good news.
    const idle = s.manaRate === 0 && (w.tribes.player?.income ?? 0) > 0;
    const allFull = SPELLS.every((d) => { const st = w.spellState('player', d.id); return !st.known || st.charges >= st.max; });
    setText(this.v.manaL, !idle ? '法力' : allFull ? '法术已满' : '无充能进行中');
    setText(this.v.pray, String(s.praying));
    setClass(this.prayStat, 'dim', s.praying === 0);
    setText(this.v.leader, s.leaderAlive ? '在世' : s.leaderRespawn > 0 ? '复活' : '阵亡');
    setText(this.v.leaderL, s.leaderAlive ? '首领' : s.leaderRespawn > 0 ? '看广告' : '首领');
    setClass(this.leaderStat, 'down', !s.leaderAlive);
    setText(this.v.clock, fmtClock(w.elapsed));
    setClass(this.pauseBtn, 'on', appState.paused);
    if (this.shownPaused !== appState.paused) {
      this.shownPaused = appState.paused;
      this.pauseBtn.innerHTML = icon(appState.paused ? 'play' : 'pause', 16);
    }
    this.speedBtns.forEach((b, i) => setClass(b, 'on', !appState.paused && appState.speed === SPEEDS[i] && !(SPEEDS[i] > 1 && !isSpeedUnlocked(SPEEDS[i]))));
    // 各倍速解锁状态可能被重新开始 / 读档改变，检测到变化时刷新按钮文字。
    const sig = SPEEDS.map((n) => (isSpeedUnlocked(n) ? '1' : '0')).join('');
    if (sig !== this.speedSig) {
      this.speedSig = sig;
      this.refreshSpeedBtns();
    }
    this.pausedBanner.hidden = !appState.paused;
  }
}