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

git push --force-with-lease

git fetch origin
git reset --hard origin/main
git pull

这句话用于测试