/**
 * 4399 原创平台广告接入（src/platform/4399-ads.ts）
 *
 * index.html 里引入了平台 SDK（h5api-interface.php）。SDK 在 window 上
 * 暴露 h5api，并把所有接口转发给 parent.h5api —— 游戏必须运行在 4399
 * 的 iframe 里，广告才能真实播放。因此：
 *   - 本地直接打开（parent === window）或 SDK 未加载：静默跳过，绝不调用，
 *     否则会触发 SDK 内部 parent.h5api 的无限递归。
 *   - 插屏广告由页面自行选择时机，平台自身带频控。
 *   - 插屏接口无回调，播放结束由平台接管覆盖层、玩家点击关闭。
 *
 * 广告解锁状态（看广告获得的奖励）保存在内存里，并随游戏存档一起持久化：
 * 新游戏 / 重新开始会重置，继续游戏（读档）则原样恢复。
 */

export interface AdState {
  /** 法术书右下角的广告是否已在本局看过（每局一次）。 */
  spellAdUsed: boolean;
  /** 已通过广告解锁的倍速（1× 无需解锁；这里只可能是 2 或 3）。 */
  speedUnlocked: number[];
}

const adState: AdState = { spellAdUsed: false, speedUnlocked: [] };

/**
 * 广告总开关：从外部配置文件 window.GAME_CONFIG.adsEnabled 读取（默认开启）。
 * 发行方尚未开通广告权限、或想发布无广告版本时，把 config.js 里的
 * adsEnabled 设为 false：游戏将完全不调用平台广告 SDK（避免平台在未授权时
 * 打印「尚未开启插屏广告权限」等报错），且所有看广告解锁的奖励直接放行——
 * 倍速直接可用，首领复活、随机法术解锁等流程照常完成，只是不再真实播放广告。
 */
const ADS_ENABLED =
  typeof window === 'undefined' ||
  (window as unknown as { GAME_CONFIG?: { adsEnabled?: boolean } }).GAME_CONFIG?.adsEnabled !== false;

/**
 * 播放一次插屏广告。广告总开关关闭、非 4399 环境（本地开发、GitHub Pages 等）
 * 时静默跳过，游戏不受任何影响。
 */
export function playInterstitialAd(): void {
  if (!ADS_ENABLED) return; // 无广告版本：不触碰 SDK，避免平台在未授权时报错。
  const api = (window as unknown as { h5api?: { playInterstitialAd?: () => void } }).h5api;
  // SDK 尚未加载完，或运行环境不在 4399 的 iframe 中 —— 静默跳过。
  if (!api || typeof api.playInterstitialAd !== 'function' || window.parent === window) return;

  try {
    api.playInterstitialAd();
    // eslint-disable-next-line no-console
    console.info('[4399] 请求播放插屏广告');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[4399] 插屏广告调用失败', err);
  }
}

/** 倍速 n 是否可用：1× 始终可用，2×/3× 需分别看广告解锁（无广告版本直接可用）。 */
export function isSpeedUnlocked(n: number): boolean {
  return n <= 1 || !ADS_ENABLED || adState.speedUnlocked.includes(n);
}

/** 解锁倍速 n（2× 或 3×，各自独立）。 */
export function unlockSpeeds(n: number): void {
  if (n > 1 && !adState.speedUnlocked.includes(n)) adState.speedUnlocked.push(n);
}

/** 法术书右下角的广告是否已在本局看过。 */
export function isSpellAdUsed(): boolean {
  return adState.spellAdUsed;
}

/** 标记法术书广告已看过。 */
export function markSpellAdUsed(): void {
  adState.spellAdUsed = true;
}

/** 新游戏 / 重新开始：清空本局广告状态。 */
export function resetAdState(): void {
  adState.spellAdUsed = false;
  adState.speedUnlocked = [];
}

/** 存档时的快照。 */
export function snapshotAdState(): AdState {
  return { spellAdUsed: adState.spellAdUsed, speedUnlocked: [...adState.speedUnlocked] };
}

/** 读档时恢复（缺省或字段缺失视为未看过 / 未解锁）。 */
export function restoreAdState(s?: { spellAdUsed?: boolean; speedUnlocked?: number[] | boolean } | null): void {
  adState.spellAdUsed = s?.spellAdUsed === true;
  const su = s?.speedUnlocked;
  // 兼容旧存档里的布尔值：true 视为已解锁全部 2×/3×。
  if (typeof su === 'boolean') adState.speedUnlocked = su ? [2, 3] : [];
  else if (Array.isArray(su)) adState.speedUnlocked = su.filter((n) => n === 2 || n === 3);
  else adState.speedUnlocked = [];
}