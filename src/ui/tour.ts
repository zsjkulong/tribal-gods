/**
 * ui/tour.ts — 战役第一关的界面导览。
 *
 * 六个面板（资源栏、时间与速度、目标、小地图、建造、法术书）逐个被
 * 高亮，旁边浮出一句说明，玩家点“下一步”依次浏览。看过一次便不再
 * 出现（localStorage 记住）；设置里关闭“提示”时也不显示。
 *
 * 高亮用一张全屏暗幕 + 一个镂空聚光灯实现：洞（.tour-hole）是一个
 * 定位到目标面板的透明框，它的超大 box-shadow 把其余部分压暗，金色
 * outline 圈出当前面板；说明卡（.tour-card）浮在洞旁边。
 */

import { css, h } from './dom';
import { settings } from './settings';

interface TourStep {
  selector: string;
  title: string;
  text: string;
}

/** 只在战役第一关出现。 */
const SCENARIO = 'c01_landfall';
const KEY = 'tg.tour.v1';

const STEPS: TourStep[] = [
  {
    selector: '.tb-left',
    title: '资源栏',
    text: '你部落的命脉都在这儿：木材、人口、法力，以及祈祷中的村民和你的首领。点击首领一格可把视野移到他身上。',
  },
  {
    selector: '.tb-right',
    title: '时间与速度',
    text: '游戏时钟与节奏控制：暂停、1×／2×／3× 速度，最右边是菜单按钮。',
  },
  {
    selector: '.ob',
    title: '目标',
    text: '这一关要完成的事都列在这里，完成一项就打勾。点标题可以收起或展开。',
  },
  {
    selector: '.mm',
    title: '小地图',
    text: '世界的缩略图。点击任意位置就能把视野移过去，也能看到自己人和敌人的动向。',
  },
  {
    selector: '.bm',
    title: '建造',
    text: '选择要建造的建筑，再点击空地放下。民居会繁衍村民，伐木场会产出木材。',
  },
  {
    selector: '.sb',
    title: '法术书',
    text: '你掌握的法术都在这里。选中一个法术后点击世界施放；法术需要法力充能。',
  },
];

css('tour', `
.tour-hole { position: fixed; z-index: 70; pointer-events: none; border-radius: 0.35rem;
  box-shadow: 0 0 0 100vmax rgba(12, 7, 3, 0.62); outline: 2px solid #ffd27a; outline-offset: 2px; }
.tour-card { position: fixed; z-index: 71; width: min(22rem, calc(100vw - 2rem)); padding: 0.75rem 0.9rem 0.85rem; }
.tour-title { font: 700 var(--t-md)/1.2 var(--font); color: var(--text); margin-bottom: 0.3rem; }
.tour-text { font-size: var(--t-sm); line-height: 1.5; color: var(--text-2); }
.tour-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 0.7rem; }
.tour-step { font-size: var(--t-xs); font-weight: 700; color: var(--text-3); }
`);

export class UiTour {
  private readonly hole: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly stepEl: HTMLElement;
  private index = 0;
  private active = false;

  constructor(root: HTMLElement) {
    this.hole = h('div.tour-hole');
    this.hole.style.display = 'none';

    this.titleEl = h('div.tour-title');
    this.textEl = h('div.tour-text');
    this.stepEl = h('span.tour-step');

    const skip = h('button.tg-btn', { type: 'button', text: '跳过' });
    const next = h('button.tg-btn.primary', { type: 'button', text: '下一步' });
    skip.addEventListener('click', () => this.finish());
    next.addEventListener('click', () => this.next());

    this.card = h('div.tour-card.tg-panel.mat-hide', {},
      this.titleEl, this.textEl,
      h('div.tour-nav', {}, this.stepEl, h('div', { style: 'display:flex; gap:0.4rem;' }, skip, next)),
    );
    this.card.style.display = 'none';

    root.append(this.hole, this.card);
  }

  get isActive(): boolean {
    return this.active;
  }

  /** 新场景开始：仅战役第一关、且提示开启、且未看过时开始。 */
  begin(scenarioId: string | null): void {
    if (scenarioId !== SCENARIO || !settings.hints || this.seen()) {
      this.active = false;
      this.hide();
      return;
    }
    this.index = 0;
    this.active = true;
    this.place();
  }

  /** 每帧：把聚光灯和说明卡对齐到当前面板（面板就绪、窗口缩放都靠它兜底）。 */
  update(): void {
    if (!this.active) return;
    this.place();
  }

  private seen(): boolean {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  }

  private markSeen(): void {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* storage blocked */
    }
  }

  private hide(): void {
    this.hole.style.display = 'none';
    this.card.style.display = 'none';
  }

  private next(): void {
    if (this.index + 1 >= STEPS.length) {
      this.finish();
      return;
    }
    this.index++;
    this.place();
  }

  private finish(): void {
    this.active = false;
    this.markSeen();
    this.hide();
  }

  private place(): void {
    const step = STEPS[this.index];
    const target = document.querySelector<HTMLElement>(step.selector);
    const r = target?.getBoundingClientRect();
    if (!target || !r || r.width === 0 || r.height === 0) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);

    const pad = 5;
    this.hole.style.left = `${r.left - pad}px`;
    this.hole.style.top = `${r.top - pad}px`;
    this.hole.style.width = `${r.width + pad * 2}px`;
    this.hole.style.height = `${r.height + pad * 2}px`;

    this.titleEl.textContent = step.title;
    this.textEl.textContent = step.text;
    this.stepEl.textContent = `${this.index + 1} / ${STEPS.length}`;

    const cr = this.card.getBoundingClientRect();
    const below = r.top + r.height / 2 < innerHeight / 2;
    let left = r.left;
    let top = below ? r.bottom + 12 : r.top - 12 - cr.height;
    left = Math.max(8, Math.min(left, innerWidth - cr.width - 8));
    top = Math.max(8, Math.min(top, innerHeight - cr.height - 8));
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  }

  private setVisible(on: boolean): void {
    const d = on ? '' : 'none';
    this.hole.style.display = d;
    this.card.style.display = d;
  }
}