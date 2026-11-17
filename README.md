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
| Blackboard 同步 | bbwatch 安全同步作业、DDL、公告和课件元数据 |

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

## Blackboard / bbwatch 集成

LGUide 不保存学校账号密码。Blackboard 登录、Cookie 与扫描继续在学生本机的
[`bbwatch`](https://github.com/W111aaam/bbwatch) 中完成，LGUide 仅接收标准化学习数据。

1. 登录 LGUide，打开 `/blackboard`。
2. 点击“连接 Blackboard”，复制网页生成的命令。
3. 在终端（Windows 用 PowerShell）粘贴并运行，电脑需安装 Python 3.11+。
   命令会安装配套的 bbwatch、连接 LGUide 并发起首次扫描。首次使用时在本机输入学校账号与密码。

配对码只能使用一次，10 分钟后失效。之后每次运行 bbwatch 扫描都会同步，
例如通过网页安装的版本可用以下命令再次扫描：

```bash
~/.lguide/bbwatch/venv/bin/python -m bbwatch.cli scan
```

Windows PowerShell：

```powershell
& "$env:USERPROFILE/.lguide/bbwatch/venv/Scripts/python.exe" -m bbwatch.cli scan
```

也可手动同步或移除本机连接：

```bash
bbwatch lguide-sync
bbwatch lguide-disconnect
```

部署 Worker 前需应用新增 D1 表：

```bash
cd worker
npx wrangler d1 execute pomodoro-db --remote --file=./schema.sql
npx wrangler deploy
```



推：

git push --force-with-lease

拉：

(git fetch origin)
(git reset --hard origin/main)
git pull

