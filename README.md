# LGUide（Campus Study Hub）

面向cuhksz大学生的学习工具聚合网站，将常用学习功能集中在一个简洁的页面中。

## 功能规划

| 功能 | 状态 |
|------|------|
| 首页 Dashboard | 框架完成 |
| 作业管理 | 框架完成，业务逻辑待实现 |
| 番茄钟 | 框架完成，计时逻辑待实现 |
| 课表管理 | 框架完成，录入与查询待实现 |
| 偏好设置 | 占位完成，功能待实现 |

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

git push --force-with-lease

git fetch origin
git reset --hard origin/main
git pull

这句话用于测试
