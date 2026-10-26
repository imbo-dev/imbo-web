# imbo.dev 部署手册

官网 imbo.dev 是 `site/` 构建出的静态单页，用 wrangler 手动发布到 Cloudflare Pages。本仓库不推远端，没有 push 即部署管线。

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
| CI | 无，手动发布 |

## 2. 日常发布（也是手动部署兜底）

```sh
site/deploy.sh
```

脚本先跑 `npm run build`（`tsc --noEmit`、Vite 构建、SSR 预渲染），任一步失败即中止；再从 Bitwarden 取 `CLOUDFLARE_ACCOUNT_TOKEN_RW`，以 `CLOUDFLARE_API_TOKEN` 注入 wrangler 发布 `site/dist/`。Bitwarden 锁着时先由人执行 `bw unlock`。输出末行的 `https://<id>.imbo-6vs.pages.dev` 里的 `<id>` 就是本次版本。发布后跑第 1 节的健康检查，并在第 7 节登记一行。

`site/public/_redirects` 让 `/install` 与 `/install.sh` 302 到 GitHub 最新 release 的 `install.sh`，安装命令 `curl -fsSL https://imbo.dev/install | sh` 依赖它，改页面时保留。`site/public/_headers` 让 `/assets/*` 长缓存、HTML 每次回源校验。

## 3. 查日志 / 排障

- 部署列表与状态：Cloudflare 面板 Workers & Pages → `imbo` → Deployments；或 API `GET /accounts/<账号>/pages/projects/imbo/deployments?env=production`。
- 某次部署的内容：直接打开 `https://<id>.imbo-6vs.pages.dev/`（这类地址 Pages 会自动加 `x-robots-tag: noindex`，正常）。
- 怀疑边缘缓存：带随机查询参数请求 `https://imbo.dev/?v=<随机>` 会绕过缓存直达当前部署，和不带参数的结果对比。

## 4. 回滚

回滚到某个旧部署（id 从第 3 节的部署列表取）：

```sh
CLOUDFLARE_API_TOKEN=$(bw get password CLOUDFLARE_ACCOUNT_TOKEN_RW) sh -c 'curl -sS -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/627a6218f132dffc9cb22dd50c2fe1a6/pages/projects/imbo/deployments/<完整 deployment id>/rollback'
```

也可以在面板对应部署的菜单里点 Rollback。回滚后跑第 1 节健康检查，在第 7 节登记。2026-10-26 演练过一次：回到 `c8a5aac3` 后 `/` 为 404、`/install` 为 302，再切回 `34e754b2` 恢复，各约 8 秒生效。

## 5. 密钥清单（只有键名，无值）

| 层 | 键名 | 用途 |
| --- | --- | --- |
| Bitwarden（本机执行） | `CLOUDFLARE_ACCOUNT_TOKEN_RW` | wrangler 发布与回滚，注入时变量名为 `CLOUDFLARE_API_TOKEN` |
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
