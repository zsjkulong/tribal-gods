/**
 * 4399 原创平台广告接入（src/platform/4399-ads.ts）
 *
 * index.html 里引入了平台 SDK（h5api-interface.php）。SDK 的 api.js
 * 把所有接口转发给 parent.h5api —— 游戏必须运行在 4399 的 iframe 里，
 * 广告才能真实播放。因此：
 *   - 本地直接打开（parent === window）或非 iframe 环境：静默跳过，绝不调用，
 *     否则会触发 SDK 内部 parent.h5api 的无限递归。
 *   - 插屏广告由页面自行选择时机（本项目在暂停菜单弹出），平台自身带频控。
 *   - 插屏接口无回调，播放结束由平台接管覆盖层、玩家点击关闭。
 */

// 4399 广告已临时禁用（无广告版本）：以下整段注释掉，恢复广告时按原样还原。
// export function showInterstitialAd(): void {
//   const api = (window as typeof window & { h5api?: { playInterstitialAd?: () => void } }).h5api;
//   // SDK 尚未加载完，或运行环境不在 4399 的 iframe 中 —— 静默跳过
//   // （本地开发、GitHub Pages 等都会走到这里，游戏不受任何影响）。
//   if (!api || typeof api.playInterstitialAd !== 'function' || window.parent === window) return;
//
//   try {
//     api.playInterstitialAd();
//     // eslint-disable-next-line no-console
//     console.info('[4399] 请求播放插屏广告');
//   } catch (err) {
//     // eslint-disable-next-line no-console
//     console.warn('[4399] 插屏广告调用失败', err);
//   }
// }