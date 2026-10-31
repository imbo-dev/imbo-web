# imbo.dev 部署手册

官网 imbo.dev 是 `site/` 构建出的静态单页，网页端 app.imbo.dev 是 `app/` 构建出的单页应用，都用 wrangler 手动发布到 Cloudflare Pages，没有 push 即部署管线。代码推 GitHub 私有仓 `Bearisbug/imbo-web` 存档，仓库里不放 workflow：私有仓的 Actions 按分钟计费。

## 1. 环境信息表

| 项 | 值 |
| --- | --- |
| 部署目标 | `paas` |
| 平台与项目 | Cloudflare Pages 项目 `imbo`，账号 `627a6218f132dffc9cb22dd50c2fe1a6`，生产分支 `main` |
| 源码与产物 | `site/`（Vite 8 + React 19 + Tailwind 4，构建时预渲染），产物 `site/dist/` |
| 发布策略 | 平台内建原子切换：新部署成功后一次性接管流量，旧部署保留可回滚 |
| 域名 | `imbo.dev`（自定义域名，规范地址）。`www.imbo.dev` 与 `imbo-6vs.pages.dev`（项目默认域名）一跳 301 到 `https://imbo.dev/`，保留路径与查询参数；单次部署地址 `<id>.imbo-6vs.pages.dev` 不跳转。`imbo.pages.dev` 是别人的项目，与本站无关 |
| DNS | Cloudflare zone `imbo.dev`：根域由 Pages 自定义域名接管；`www` 是只为跳转存在的 AAAA `100::`（代理） |
| 跳转规则 | www：zone `imbo.dev` 的 Single Redirect（`http_request_dynamic_redirect` 阶段，规则「www.imbo.dev -> imbo.dev」）；pages.dev：账号级 Bulk Redirect 列表 `imbo_pages_dev` 加 `http_request_redirect` 阶段规则「imbo-6vs.pages.dev -> imbo.dev」 |
| 健康检查 | `curl -sS "https://imbo.dev/?v=$(date +%s)"` 返回 200 且含 `<meta property="og:site_name" content="Imbo"`；`curl -sS -o /dev/null -w '%{http_code}' https://imbo.dev/install` 返回 302 |
| 版本标识 | commit 哈希：工作区干净时 `deploy.sh` 发布，Pages 部署元数据记录当时的 commit；每次发布在第 7 节登记 deployment id 与 commit |
| 网页项目 | Cloudflare Pages 项目 `imbo-app`，生产分支 `main`；源码 `app/`，产物 `app/dist/`。产物里没有 `404.html`，Pages 把未知路径都交给 `index.html`，由前端路由处理 |
| 网页域名 | `app.imbo.dev`（Pages 自定义域名）；DNS 是 zone `imbo.dev` 里代理的 CNAME `app` → `imbo-app.pages.dev`。`imbo-app.pages.dev` 与单次部署地址也能打开页面，但服务端只认 `https://app.imbo.dev` 这个来源，在别的地址登录会被拒 |
| 网页接口 | 构建产物直接请求 `https://api.imbo.dev`（`app/src/data/online.ts`），服务端以 `IMBO_WEB_ORIGIN=https://app.imbo.dev` 放行跨域并带 cookie；本地开发仍走 Vite 的 `/v1` 代理 |
| 网页健康检查 | `curl -sS "https://app.imbo.dev/login?v=$(date +%s)"` 返回 200 且含 `<title>Imbo</title>`（官网首页的标题更长，以此区分）；`curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS -H 'Origin: https://app.imbo.dev' -H 'Access-Control-Request-Method: POST' https://api.imbo.dev/v1/auth/code` 返回 204 |
| CI | 无，手动发布 |

## 2. 日常发布（也是手动部署兜底）

```sh
site/deploy.sh
```

脚本先跑 `npm run build`（`tsc --noEmit`、Vite 构建、SSR 预渲染），任一步失败即中止；再从 Bitwarden 取 `IMBO_PAGES_DEPLOY_TOKEN`，以 `CLOUDFLARE_API_TOKEN` 注入 wrangler 发布 `site/dist/`。Bitwarden 锁着时先由人执行 `bw unlock`。输出末行的 `https://<id>.imbo-6vs.pages.dev` 里的 `<id>` 就是本次版本。发布后跑第 1 节的健康检查，并在第 7 节登记一行。

网页端用 `app/deploy.sh` 发布，步骤与上面相同，发到项目 `imbo-app`，末行地址形如 `https://<id>.imbo-app.pages.dev`；发布后跑第 1 节的网页健康检查和 `../docs/TEST.md` 的 TC-104（`node app/tests/prod.mjs <截图目录>`，用线上测试账号登录走一遍），在第 7 节登记。

`site/public/_redirects` 让 `/install` 与 `/install.sh` 302 到 GitHub 最新 release 的 `install.sh`，安装命令 `curl -fsSL https://imbo.dev/install | sh` 依赖它，改页面时保留。`site/public/_headers` 让 `/assets/*` 长缓存、HTML 每次回源校验。

## 3. 查日志 / 排障

- 部署列表与状态：Cloudflare 面板 Workers & Pages → `imbo`（网页端是 `imbo-app`）→ Deployments；或 API `GET /accounts/<账号>/pages/projects/<项目>/deployments?env=production`。
- 某次部署的内容：直接打开 `https://<id>.imbo-6vs.pages.dev/`（这类地址 Pages 会自动加 `x-robots-tag: noindex`，正常）。
- curl 和浏览器看到的 HTML 不一样：zone 开着 Cloudflare Web Analytics（只给浏览器请求注入 `static.cloudflareinsights.com` 信标）和邮箱地址混淆（把邮箱改写成 `[email protected]`，预渲染页靠 `<!--email_off-->` 避开）。查页面内容以浏览器为准，或带浏览器 User-Agent 与 `Accept: text/html` 请求。
- 怀疑边缘缓存：带随机查询参数请求 `https://imbo.dev/?v=<随机>` 会绕过缓存直达当前部署，和不带参数的结果对比。

## 4. 回滚

回滚到某个旧部署（id 从第 3 节的部署列表取；网页端把路径里的 `imbo` 换成 `imbo-app`）：

```sh
CLOUDFLARE_API_TOKEN=$(bw get password CLOUDFLARE_ACCOUNT_TOKEN_RW) sh -c 'curl -sS -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/627a6218f132dffc9cb22dd50c2fe1a6/pages/projects/imbo/deployments/<完整 deployment id>/rollback'
```

也可以在面板对应部署的菜单里点 Rollback。回滚后跑第 1 节健康检查，在第 7 节登记。2026-10-26 演练过一次：回到 `c8a5aac3` 后 `/` 为 404、`/install` 为 302，再切回 `34e754b2` 恢复，各约 8 秒生效。网页端同日演练：从 `32e5950f` 回到 `71dcf420` 再切回，各 4 秒、7 秒生效，期间 `/login` 一直是 200。

## 5. 密钥清单（只有键名，无值）

| 层 | 键名 | 用途 |
| --- | --- | --- |
| Bitwarden（本机执行） | `IMBO_PAGES_DEPLOY_TOKEN` | `deploy.sh` 发布用。Cloudflare 账号 token「imbo-web Pages deploy」，只有 Pages Write；注入时变量名为 `CLOUDFLARE_API_TOKEN` |
| Bitwarden（本机执行） | `CLOUDFLARE_ACCOUNT_TOKEN_RW` | 全权限 token：第 4 节回滚，以及建 Pages 项目、加自定义域名、改 DNS 与跳转规则；注入时变量名为 `CLOUDFLARE_API_TOKEN` |
| 运行时 | 无 | 纯静态站，没有运行时密钥 |

## 6. 数据库备份与恢复

N/A — 本站没有数据库。

## 7. 变更记录

| 日期 | 事件 | 记录 |
| --- | --- | --- |
| 2026-10-26 | 发布 | `site/` 首次上线，deployment `34e754b2`，替换只有 `/install` 跳转的 `c8a5aac3`；健康检查通过 |
| 2026-10-26 | 回滚演练 | 回到 `c8a5aac3` 再切回 `34e754b2`，见第 4 节 |
| 2026-10-26 | 补登版本 | `34e754b2` 的源码是 commit `c57bab5`（发布时 `site/` 尚未提交，Pages 元数据里记的是 `684248f`，以本行为准） |
| 2026-10-26 | 发布 | deployment `2395eea9`，commit `f232ad8`：页头下滚收起、首屏复制按钮、FAQ 02 新说法；健康检查通过 |
| 2026-10-26 | 跳转 | 新增 `www` 记录、www 跳转规则、pages.dev 跳转列表与规则（见第 1 节「跳转规则」）；curl 实测都是一跳 301，部署地址仍 200 |
| 2026-10-26 | 发布 | deployment `6d7b451d`，commit `8c60f4d`：首屏引言、Safety、Pricing 按 Quilt 新稿；新增 `/privacy`、`/terms` 与 404 页（未知路径返回 404 状态码）；健康检查通过，线上 `/privacy` 出现 React 水合报错 #418 |
| 2026-10-26 | 发布 | deployment `9c4666db`，commit `32c2e3a`：预渲染页面加 `<!--email_off-->`，修掉上一行的水合报错；健康检查通过，浏览器冒烟无报错 |
| 2026-10-26 | 发布 | deployment `3620e38a`，commit `614c505`：首屏、安装段、Pricing、FAQ、Terms 写上年付 $10（Quilt 落地页 `06a14f1e`、Terms `67941218`），meta、llms.txt、JSON-LD 加年付；健康检查通过，浏览器冒烟无报错 |
| 2026-10-26 | 发布 | deployment `80d6a376`，commit `8dd1bfc`：隐私政策第 2、3、6、8 节写明 Cloudflare Web Analytics（Quilt Privacy `86c13007`）；健康检查通过，浏览器冒烟无报错 |
| 2026-10-26 | 发布 | deployment `b245c52f`，commit `9553670`：服务条款第 9 节删掉「关停中央服务器时退还未用完的预付费」，只留提前 30 天通知（D74，Quilt Terms `e0641e68`）；健康检查通过，浏览器冒烟无报错 |
| 2026-10-26 | 发布 | 网页端首次上线：新建 Pages 项目 `imbo-app`（wrangler 4.152 的 `pages project create` 会转去建 Workers 形态的项目并失败，改用 API `POST /accounts/<账号>/pages/projects` 建成旧版 Pages 项目，与 `imbo` 相同），自定义域名 `app.imbo.dev`，DNS 加代理的 CNAME `app`；deployment `71dcf420`，commit `cebc758`；健康检查通过，浏览器打开登录页、发验证码无报错 |
| 2026-10-26 | 回滚演练 | 网页端再发一次同一提交得到 `32e5950f`，回到 `71dcf420` 再切回 `32e5950f`，见第 4 节；线上是 `32e5950f` |
| 2026-10-27 | 发布 | deployment `148d09eb`，commit `6c95283` + `f4b814d`：落地页写上六个工具（Quilt 落地页 `ab29e3f4`、Privacy `815ed92c`，标题、meta、分享图、JSON-LD、llms.txt 同步）；导航跳转后内容停在页头下方 24px（原来多空出区块上边距 120px），页头上滚满 120px 才出现，手机菜单点后收起；健康检查通过，浏览器冒烟无报错，导航检查 12 项全过 |
| 2026-10-27 | 发布 | deployment `58e025d7`，commit `298c9f3`：安装段复制按钮复制后宽度不变，旧文字淡出、「Copied successfully!」淡入 2 秒；健康检查通过，浏览器冒烟无报错，复制按钮检查 18 项全过 |
| 2026-10-27 | 发布令牌 | `site/deploy.sh`、`app/deploy.sh` 改用只有 Pages 发布权限的 `IMBO_PAGES_DEPLOY_TOKEN`；代码推 GitHub 私有仓 `Bearisbug/imbo-web` 存档 |
| 2026-10-27 | 发布 | 网页端 deployment `cfde2548`，commit `89e4f06`：对话与会话页能发文字（服务端 0.2.12 起放开）；健康检查通过，TC-104 线上 9 项全过（RUN-083） |
| 2026-10-28 | 发布 | deployment `53ac8a62`，commit `ddad45b`：页脚加「Support」一列，链接 `mailto:support@imbo.dev`（支付平台入驻审核要求页脚有联系入口）；四个页面线上都有该链接、未被邮箱混淆改写，健康检查通过，1440 与 390 宽浏览器检查无报错 |
| 2026-10-28 | 发布 | deployment `6405ed1d`，commit `0a547b8`～`f2a3c5a`：官网改成和网页端一致的 $2/月、$20/年，收款方由 Creem 改为 Waffo Pancake；条款与隐私换成新稿（Quilt 条款 `1b3f95d8`、隐私 `dc82fc6d`，加头像、屏蔽、举报、封号），日期 October 28, 2026；试用期统一写成 30 天（Quilt 落地页 `9b87db34`，meta、JSON-LD、llms.txt、terms.html 同步）。三页 compare.mjs 页高相等，条款与隐私 styleDiffs 0，落地页 2 处是安装段复制按钮；线上四页没有 $1、$10、Creem、first month，`mailto:support@imbo.dev` 都在且未被混淆；1440 与 390 宽浏览器检查无报错、无横向溢出 |
| 2026-10-31 | 发布 | 网页端 deployment `8591f3d2`，commit `9519c7a`：网页补齐终端功能（按账号 ID 或邮箱加联系人、删联系人、给没说过话的联系人开对话并选收件人、消息带文件、会话改名、改名字、让电脑退出、删除账号、群主换群头像与改群名、移人、转让、解散、成员退群），服务端 0.2.16；健康检查通过，TC-041、TC-104 线上全过（RUN-254），另用临时账号走了加联系人、开新对话、群改名 |
