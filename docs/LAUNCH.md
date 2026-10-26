# imbo.dev 上线清单

操作手册见 `docs/DEPLOY.md`；本清单管上线期打勾与遗留登记。执行者：**A**=Agent，**U**=用户。

## 1. 密钥配置清单

| 键名 | 配到哪 | 来源 | 配置动作（零回显） | 验证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_TOKEN_RW` | 不落地，发布时从 Bitwarden 取出注入 wrangler | Bitwarden | A：`site/deploy.sh` 内 `bw get password` 读入变量，不打印 | 2026-10-26 发布成功 | ☑ |

## 2. 部署步骤清单

- [x] 1. 盘点完成、本清单建档（A）· 验证：密钥表一行，纯静态站无运行时密钥 · 2026-10-26
- [x] 2. 质量门（A）· 验证：`npm run build` 通过（含 `tsc --noEmit`）；与 Quilt 设计稿逐元素样式比对 1440、390 两宽 0 差异 · 2026-10-26
- [x] 7. 首次部署（★A1；A）· 验证：deployment `34e754b2` 成功，`https://imbo.dev/` 200 且含 `og:site_name` Imbo，`/install` 302 · 2026-10-26
- [x] 8. 线上冒烟一轮（★P2；A）· 验证：无测试文档，以下方最小冒烟集替代，全部通过 · 2026-10-26
- [x] 9. 回滚演练（★P3；A）· 验证：回到 `c8a5aac3`（`/` 404、`/install` 302）再切回 `34e754b2`（`/` 200）· 2026-10-26
- [ ] 10. 搭 push 即部署管线 · `web/` 没有 GitHub 远端，暂不做

最小冒烟集（线上 2026-10-26 全部通过）：

1. 浏览器打开 `https://imbo.dev/`，1440 与 390 宽：返回 200，标题含 Imbo，h1 为「Inbox for agents.」，控制台无错误，无失败请求。
2. `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' https://imbo.dev/install`：302 到 GitHub 最新 release 的 `install.sh`，跟随后是 shell 脚本。
3. `/robots.txt`、`/sitemap.xml`、`/llms.txt`、`/og.png` 都返回 200。
4. FAQ 点第二个问题，答案展开；Install 段的复制按钮点击后显示「Copied」。
5. 390 宽点菜单按钮，菜单展开。

## 3. 提速优化菜单（默认全不做）

- [x] 静态资源长缓存：`site/public/_headers` 给 `/assets/*` 设 `public, max-age=31536000, immutable`，HTML 设 `max-age=0, must-revalidate` · 验证：线上响应头实测 · 2026-10-26

## 4. 遗留与例外登记

| 日期 | 事项 | 说明 |
| --- | --- | --- |
| 2026-10-26 | 管线待搭 | 最小上线。未兑现的契约条款：自动质量门（靠 `deploy.sh` 先构建）、失败自动回滚（手动按 DEPLOY.md 第 4 节） |
| 2026-10-26 | 测试文档缺失 | 以最小冒烟集替代，未经用户确认 |
| 2026-10-26 | 软 404 | 站点没有 `404.html`，Pages 对任何未知路径返回首页和 200。用户定了加 404 页（D2），「Imbo 探索」窗口在 Quilt 出稿，出稿后复刻成 `site/public/404.html` |
