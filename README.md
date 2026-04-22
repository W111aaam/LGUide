# LGUide (Campus Study Hub)

面向cuhksz大学生的学习工具聚合网站，将常用学习功能集中在一个简洁的页面中。

## 功能规划

| 功能 | 状态 |
|------|------|
| 首页 Dashboard | 完成，已上线 GitHub 风格的热点记录 |
| 作业管理 | 框架完成 |
| 番茄钟 | 基础功能和显示互动完成，闹钟提示完成 |
| 课表管理 | 框架完成，提示功能完成 |
| 偏好设置 | 占位完成，功能未完全实现 |

## 技术栈

- React 18 + Vite
- Tailwind CSS
- React Router v6
- localStorage（本地数据持久化）
- Cloudflare Workers + D1（番茄钟历史记录与热力图 API）

## 本地开发

```bash
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`

如果你要在本地联调番茄钟 Cloudflare Worker + D1 API，需要额外启动 Worker：

```bash
cd worker
npx wrangler dev --port 8787
```

根目录的 Vite 开发服务器已经把 `/api/*` 代理到 `http://127.0.0.1:8787`。如果你的 Worker 跑在别的地址，可以设置环境变量：

```bash
VITE_POMODORO_API_PROXY_TARGET=http://127.0.0.1:8788 npm run dev
```

## 构建与部署

```bash
npm run build
```

构建产物在 `dist/` 目录，可直接部署到 Cloudflare Pages。

> **注意**：`public/_redirects` 文件已配置 SPA 路由支持，刷新页面不会 404。

## 番茄钟 D1 API

Worker 后端代码在 `worker/`：

```bash
cd worker
npx wrangler d1 create pomodoro-db
```

把命令返回的 `database_id` 填入 `worker/wrangler.toml`，然后执行：

```bash
npx wrangler d1 execute pomodoro-db --remote --file=./schema.sql
npx wrangler deploy
```

前端默认请求同域 `/api/*`。如果 Worker 部署在单独域名，给 Pages 设置环境变量：

```bash
VITE_POMODORO_API_BASE=https://你的-worker.workers.dev
```

生产环境推荐在 Cloudflare 给 Worker 配置 Route：`lguide.net/api/*`，这样前端无需额外环境变量。



推：

git push --force-with-lease

拉：

(git fetch origin)
(git reset --hard origin/main)
git pull

