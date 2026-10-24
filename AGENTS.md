# Imbo web

`landing/`：官网 imbo.dev，部署在 Cloudflare Pages 项目 `imbo`。`landing/deploy.sh` 用 wrangler 把 `landing/src/` 原样发布上去。`src/_redirects` 把 `/install` 跳到 GitHub 最新 release 的 `install.sh`，安装命令 `curl -fsSL https://imbo.dev/install | sh` 靠它，改页面时保留这个文件。页面本身还没写。视觉事实源是 `../brand/DESIGN.md`；产品设计与测试文档在 `../docs/`。本仓库不推远端。

## 前端实现纪律
<!-- ui-constraints:前端实现纪律 rev 2026-10 -->
本项目任何 Web 前端改动——新建页面/组件、调样式、修 UI 缺陷、按截图还原、逐条体验优化——动码前必须加载 `ui-constraints` 技能并按它执行，交付前做它要求的真实浏览器验证。适用范围看**改到哪个文件**、不看措辞：碰 `.tsx/.jsx/.vue/.svelte/.css/.scss/.html` 或任何组件、样式文件即适用，「就改一行」「随手调一下」同样适用，拿不准时按适用处理；React Native / Expo 等原生 App 的界面文件不在本段范围，归 `mobile-ui-constraints`。长会话中每进入一次新的前端改动，都要重新按该技能查一遍规则，不要凭上一轮的记忆推进。把前端工作派给 subagent 时，任务里必须写明要加载 `ui-constraints`（subagent 不继承）。技能不可用时停下告知用户，不要凭记忆拼一套前端约束。
