# Imbo web

`site/`：线上官网 imbo.dev，Vite + React + Tailwind，一比一复刻 Quilt 画板 `f35ff3e9-a374-4b50-ba58-a5fe83b08054` 里的四个画面，构建时预渲染：落地页「Imbo landing (EN)」→ `index.html`（`src/App.tsx`），404 页、Privacy、Terms → `404.html`、`privacy.html`、`terms.html`（共用 `src/SubPage.tsx`，页头页脚和落地页同一套组件，传 `base="/"` 让锚点回到首页）。部署在 Cloudflare Pages 项目 `imbo`，发布、回滚、排障见 `docs/DEPLOY.md`（入口 `site/deploy.sh`）。`site/public/_redirects` 把 `/install` 跳到 GitHub 最新 release 的 `install.sh`，安装命令 `curl -fsSL https://imbo.dev/install | sh` 靠它，改页面时保留这个文件。

`app/`：网页端 app.imbo.dev，Vite + React + Tailwind，部署在 Cloudflare Pages 项目 `imbo-app`（入口 `app/deploy.sh`，发布、回滚见 `docs/DEPLOY.md`）。范围：登录注册、对话（能给联系人和群发文字和文件，能给没说过话的联系人开新对话）、我的会话（能给自己的会话发文字和文件、改名，回复记为已读）、联系人（按账号 ID 或邮箱加，能删）、群（建群、邀请；群主换群头像、改群名、移人、转让、解散，成员退群）、账户（改名字、让已登录的电脑退出、删除账号）与订阅。数据走 imbo-server 的浏览器接口 `/v1`（`src/data/online.ts`；构建产物直接请求 `https://api.imbo.dev`，开发模式走下面的代理），每个响应都用 `src/data/contract.ts` 的 zod schema 校验（字段名与 `docs/DESIGN.md` §8 一致），组件只经 `src/data/store.ts` 取数。本地运行 `cd app && IMBO_API=http://127.0.0.1:18081 npm run dev`：开发服务器固定在 5190 端口，把 `/v1` 代理到 `IMBO_API`（默认 `http://127.0.0.1:18080`）；服务器要设 `IMBO_WEB_ORIGIN=http://localhost:5190`，页面也必须从 `http://localhost:5190` 打开，否则登录会被来源检查拒掉。`npm run dev:mock`（5191 端口）换成 `src/mock/` 的假数据，左下角「Demo」面板切套餐、加载 / 空 / 出错状态、发送被拒和模拟来信；普通构建不含 `src/mock/`。

视觉事实源是 `../brand/DESIGN.md`；产品设计与测试文档在 `../docs/`。代码推 GitHub 公开仓 `imbo-dev/imbo-web`，发布用 `site/deploy.sh`、`app/deploy.sh`；仓库里不放 workflow。

## 前端实现纪律
<!-- ui-constraints:前端实现纪律 rev 2026-10 -->
本项目任何 Web 前端改动——新建页面/组件、调样式、修 UI 缺陷、按截图还原、逐条体验优化——动码前必须加载 `ui-constraints` 技能并按它执行，交付前做它要求的真实浏览器验证。适用范围看**改到哪个文件**、不看措辞：碰 `.tsx/.jsx/.vue/.svelte/.css/.scss/.html` 或任何组件、样式文件即适用，「就改一行」「随手调一下」同样适用，拿不准时按适用处理；React Native / Expo 等原生 App 的界面文件不在本段范围，归 `mobile-ui-constraints`。长会话中每进入一次新的前端改动，都要重新按该技能查一遍规则，不要凭上一轮的记忆推进。把前端工作派给 subagent 时，任务里必须写明要加载 `ui-constraints`（subagent 不继承）。技能不可用时停下告知用户，不要凭记忆拼一套前端约束。
