# My Growth｜我的成长

极简个人成长记录应用。每天记下几件小事，长期看见自己做过什么、读过什么、想过什么。

- **今日**：六个固定维度，输入框直接可写，勾选与文字各自独立保存。
- **日历**：月历里用图标显示每天实际完成的维度，点某天即可查看并补写。
- **我的年度**：年度书架、年度感悟时间线、年度回顾。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
```

无需任何配置即可使用全部记录功能。数据写入浏览器的 IndexedDB。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器 |
| `npm run build` | 类型检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm run typecheck` | 只做类型检查 |
| `npm test` | 运行测试 |
| `npm run ai-proxy` | 启动可选的 AI 代理（需要 API Key） |

## 数据存储

当前版本使用 **IndexedDB**，数据只保存在当前浏览器和设备上：

- 清理浏览器数据、换设备、用隐私模式都可能导致记录丢失。
- 「我的年度 → 数据备份」可导出 / 导入 JSON 备份，导入支持「合并」和「替换全部」两种方式。
- 这不是云端同步方案。界面里也如实写明了这一点，不会把本地存储说成云端持久化。

所有数据访问都走 `src/data/repository.ts` 定义的 `GrowthRepository` 接口，IndexedDB 只是其中一个实现（`indexedDbRepository.ts`）。迁移到 Supabase 时只需新增一个实现并在 `GrowthStoreProvider` 注入，页面代码无需改动。

### 数据模型

| 实体 | 关键约束 |
| --- | --- |
| `DailyRecord` | `(userId, localDate, category)` 唯一，由 IndexedDB 唯一索引保证；重复编辑更新同一条 |
| `Book` | 年度归属按 `finishedDate` 计算，不按创建时间 |
| `Reflection` | 来自每日思考的收藏只存 `sourceDailyRecordId` 引用，**不复制正文**；每条每日思考最多对应一条收藏（唯一索引） |
| `GrowthReview` | 按 `(periodType, periodStart, periodEnd)` 覆盖保存，并记录 `sourceUpdatedAt` 用于提示「回顾可能已过时」 |

日期一律按用户本地日历日处理：`YYYY-MM-DD` 字符串 + `parseLocalDate()` 手动构造本地午夜，避免 UTC 转换导致记录错位。

## AI 回顾（可选）

AI 是纯增强功能。**不配置 AI 时，所有记录和回顾功能照常可用**，「生成回顾」按钮会产出一份按真实记录整理的**本地确定性摘要**，界面明确标注为「本地摘要」，不会伪装成 AI 生成。

配置方式（Key 只存在于服务端进程，不进前端产物）：

```bash
cp .env.example .env

# 终端 1：启动代理，Key 从环境变量读取
AI_API_KEY=sk-... npm run ai-proxy

# 终端 2：只把端点 URL 告诉前端
VITE_AI_PROXY_URL=http://localhost:8787/api/review npm run dev
```

`VITE_*` 变量会被打进浏览器产物，所以那里只能放端点 URL，绝不能放 Key。代理支持任何 OpenAI 兼容接口（`AI_BASE_URL` / `AI_MODEL`）。

AI 调用失败、超时或未配置时，会自动回退到本地摘要并说明原因。提示词与服务端 system message 都写明了约束：只能基于真实记录总结，不得编造，数据不足直说，不说教、不贴标签、不把「没打卡」解释为失败。

## 生产部署

```bash
npm run build        # 产物在 dist/
```

`dist/` 是纯静态文件，可部署到任意静态托管（Vercel / Netlify / Cloudflare Pages / Nginx）。

因为使用了 `BrowserRouter`，需要把所有路径回退到 `index.html`：

- **Nginx**：`try_files $uri $uri/ /index.html;`
- **Vercel / Netlify**：添加 `/* → /index.html` 的 rewrite 规则（SPA fallback）。

如果启用了 AI，`server/ai-proxy.mjs` 需要单独作为 Node 进程部署，并把 `AI_ALLOWED_ORIGIN` 改成正式站点域名、`VITE_AI_PROXY_URL` 改成代理的公网地址。

## 目录结构

```
src/
├── domain/          纯逻辑，不依赖 React 或存储
│   ├── types.ts         实体定义
│   ├── categories.ts    六个固定维度（名称、图标、placeholder）
│   ├── dates.ts         本地日期处理
│   ├── selectors.ts     统计口径、感悟引用解析
│   └── reviewInput.ts   回顾数据组装、本地摘要、AI 提示词
├── data/            存储层
│   ├── repository.ts         存储接口（迁移边界）
│   ├── indexedDbRepository.ts IndexedDB 实现 + 备份校验
│   ├── draftBuffer.ts        未落盘文字的崩溃缓冲
│   └── aiClient.ts           调用 AI 代理
├── store/           GrowthStore：内存缓存 + 写穿 IndexedDB + 保存状态
├── hooks/           useAutosaveText：500ms debounce、切日期前 flush
├── components/      卡片、月历、统计、书架、感悟、回顾、备份、UI 基础件
├── pages/           今日 / 日历 / 我的年度
└── App.tsx          响应式导航（桌面顶部，移动端底部 Tab）
server/ai-proxy.mjs  可选 AI 代理（Key 只在服务端）
```

## 测试结果

```
npm test
✓ src/data/indexedDbRepository.test.ts  (17 tests)
✓ src/domain/dates.test.ts              (12 tests)
✓ src/domain/selectors.test.ts          (14 tests)
✓ src/domain/reviewInput.test.ts         (6 tests)

Test Files  4 passed (4)
     Tests  49 passed (49)
```

覆盖的核心逻辑：

- 本地日期不被 UTC 偏移影响；闰年 2 月、月初为周日 / 周六时的日历对齐；42 格月历网格。
- 同一天同一维度只保留一条记录；只写文字不会把完成状态改为 true；取消勾选不清空文字；可修改三个月前的记录。
- 「有记录的天数」与「完成次数」两种统计口径分离（只写文字的日期计入前者、不计入后者）。
- 收藏的每日思考按引用解析：改原文后年度感悟同步更新且不产生第二份副本；取消收藏不删除原始记录。
- 书籍按 `finishedDate` 归属年份；只填书名即可创建。
- 本地摘要只包含真实记录，且不含鼓励 / 说教 / 评价性词汇。
- 备份导出导入往返；合并时同一天同一维度保留较新记录；拒绝格式错误或含未知维度的文件。

### 浏览器实测（开发服务器 + 真实 IndexedDB）

已手动走通：打开首页直接看到六个维度并能直接输入 → 只写文字不自动完成 → 只勾选不写字 → **刷新后数据仍在** → 输入后立刻切换日期，文字被写入正确的那一天 → 收藏今日思考 → 年度感悟出现该条 → 修改原文后年度感悟同步变化 → 取消收藏后原始记录仍在 → 只填书名加入年度书架 → 日历格显示当天完成维度的图标（无障碍名例如 `2026-11-02，已完成：看书`）→ 点击日期查看并编辑当天记录 → 生成本周回顾，内容只包含真实记录 → 390×844 移动端视口下七列完整、底部 Tab 不遮挡输入。

## 已实现 / 未实现

**已实现**：三个页面与响应式导航、六项直接输入与独立勾选、500ms 自动保存与保存状态、日期切换与历史补写、带图标的成长日历、日期详情编辑、周 / 月 / 年统计与趋势图、历史记录筛选与搜索、年度书架（增删改 + 封面上传 + 占位封面）、每日看书卡片的「读完一本书」快捷入口、今日思考收藏到年度感悟（引用式、双向一致）、年度感悟时间线 / 搜索 / 月份筛选 / 独立新增、周 / 月 / 年回顾生成与保存、来源数据变化提示、JSON 备份导出导入、未落盘文字的崩溃恢复。

**未实现或有意省略**：

- **云端同步与多设备**：没有接 Supabase，也没有用户认证和 Row Level Security。数据模型已按多用户设计（每行带 `userId`），但当前是单用户本地库。
- **AI 默认不可用**：没有配置 Key 时产出本地摘要，不是 AI 文本。
- **年度回顾导出 PDF**：按需求列为后续增强，未实现。
- **深色模式**：未实现（需求中列为后续增强）。
- **图书搜索 API**：未接入，封面靠手动上传或按书名生成的占位封面。不会伪造真实封面或作者。
- **shadcn/ui**：未使用其 CLI，组件用 Tailwind 手写（`src/components/ui.tsx`），样式语言一致，省去一层生成代码。
- **定时自动生成回顾**：所有回顾都由用户主动触发。
