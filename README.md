<p align="center">
  <h1 align="center">📚 课伴 KeBan</h1>
  <p align="center"><strong>你的 AI 智能学习伙伴 — 让每一分钟网课都高效有价值</strong></p>
  <p align="center">
    <img src="https://img.shields.io/badge/status-alpha-orange.svg" alt="Status" />
    <img src="https://img.shields.io/badge/version-v0.2.0--alpha-blue.svg" alt="Version" />
    <img src="https://img.shields.io/badge/build-passing-brightgreen.svg" alt="Build" />
    <img src="https://img.shields.io/badge/license-Private-lightgrey.svg" alt="License" />
    <img src="https://img.shields.io/badge/React-18-61dafb.svg" alt="React" />
    <img src="https://img.shields.io/badge/Tauri-2.0-ffc5c5.svg" alt="Tauri" />
  </p>
</p>

---

## 📝 项目简介

**课伴（KeBan）** 是一款面向个人的 **本地优先（Local-First）AI 辅助学习桌面应用**，基于费曼学习法等科学方法论，致力于解决网课学习效率低下的核心痛点。

> 💡 **核心理念：本地优先 + AI 增强可选**
>
> 所有核心功能 **离线完整可用**，无需任何网络依赖；联网时可按需开启 AI 辅助，作为增值能力叠加。你的学习数据，始终掌握在自己手中。

---

## ✨ 核心特性

课伴围绕 **"学 → 记 → 练 → 悟"** 学习闭环，提供四大核心模块：

### 🍅 番茄钟（Pomodoro Timer）— 时间管理

- **三段式计时**：工作 / 短休息 / 长休息自动轮转
- **双模式切换**：上课模式（45 分钟静默）与自习模式（25/5 标准节奏）
- **后台不中断**：Web Worker 后台计时，切换标签页不中断
- **数据洞察**：专注时长统计与趋势分析，量化学习投入

### 📝 智能笔记（Smart Notes）— 知识沉淀

- **专业编辑器**：基于 TipTap 3（ProseMirror）的富文本编辑体验
- **多种模板**：大纲式、康奈尔笔记法、思维导图式等结构化模板
- **灵活组织**：3 级嵌套文件夹 + 自由标签系统
- **安全省心**：本地全文搜索，自动保存（≤10 秒间隔）

### 🃏 闪卡（Flashcards）— 记忆巩固

- **科学算法**：SM-2 间隔重复算法（Again / Hard / Good / Easy 四档评分）
- **层级管理**：3 级嵌套牌组（科目 → 章节 → 知识点）
- **学习统计**：复习数 / 新学数 / 正确率 / 遗忘曲线可视化
- **批量导入**：支持 CSV / JSON 格式快速导入

### 🧠 费曼学习法（Feynman Technique）— 深度理解

- **四步流程**：选概念 → 用自己的话解释 → 识别薄弱点 → 简化重述
- **薄弱点追踪**：自动标记与汇总薄弱知识点
- **理解度评估**：1–5 星自评体系，直观衡量掌握程度

### 🤖 AI 增强能力（联网可选开启）

| 能力 | 说明 |
|------|------|
| 笔记智能摘要 | 一键生成课堂笔记摘要与续写润色 |
| AI 自动生成闪卡 | 从笔记内容智能生成记忆卡片 |
| 费曼学习评估 | AI 评估解释质量，给出改进建议 |
| 智能时长推荐 | 根据学习数据推荐最佳番茄钟时长 |

> 基于国产大模型：**通义千问（Qwen）** / **DeepSeek** / **智谱 GLM**，按需选择，灵活切换。

---

## 🛠️ 技术栈

### 前端客户端

| 类别 | 技术 | 说明 |
|------|------|------|
| UI 框架 | React 18 + TypeScript | 类型安全的组件化开发 |
| 构建工具 | Vite 8 | 极速 HMR 与构建 |
| 桌面端 | Tauri 2.0 | 轻量级跨平台桌面应用（5–15 MB 安装包） |
| 样式方案 | Tailwind CSS 3.4 | 原子化 CSS + Design Tokens |
| 状态管理 | Zustand + TanStack Query | 本地状态 + 异步数据缓存 |
| 本地存储 | Dexie.js (IndexedDB) | 本地优先数据存储 |
| 富文本编辑器 | TipTap 3 (ProseMirror) | 智能笔记编辑器 |
| 离线支持 | Workbox + Service Worker | PWA 离线可用 |
| 路由 | React Router 7 | SPA 路由管理 |
| 图标 | Lucide React | 线性风格图标库 |
| 测试 | Vitest + Testing Library | 单元与组件测试 |
| 代码检查 | Oxlint | 高性能 Rust Linter |

### 后端服务

| 服务 | 技术 | 端口 | 说明 |
|------|------|------|------|
| 同步服务 | Go + Gin | `8080` | 数据同步 API（Push / Pull / Resolve） |
| AI 网关 | Python + FastAPI + LangChain | `8000` | AI 增强服务网关 |
| 数据库 | PostgreSQL 16 | `5432` | 主数据存储 |
| 缓存 | Redis 7 | `6379` | 会话 / 缓存 / 限流 |

### 基础设施

| 类别 | 技术 |
|------|------|
| 容器化 | Docker + docker-compose |
| AI 模型 | 通义千问 (Qwen) / DeepSeek / 智谱 GLM |
| 服务通信 | gRPC + Protobuf（规划中） |

---


## 📁 项目结构

```
KeBan/
├── client/                     # 🖥️ 前端客户端（React + Tauri）
│   ├── src/
│   │   ├── features/           # 📦 业务功能模块
│   │   │   ├── dashboard/      #    仪表盘 & 学习概览
│   │   │   ├── pomodoro/       #    番茄钟模块
│   │   │   ├── notes/          #    智能笔记模块
│   │   │   ├── flashcards/     #    闪卡模块
│   │   │   └── feynman/        #    费曼学习法模块
│   │   ├── lib/                # 📚 核心库
│   │   │   ├── ai/             #    AI 服务集成层
│   │   │   ├── auth/           #    认证模块
│   │   │   ├── http/           #    HTTP 请求封装
│   │   │   ├── mode/           #    双模式管理（本地/AI）
│   │   │   ├── storage/        #    Dexie.js 本地存储层
│   │   │   ├── sync/           #    数据同步客户端
│   │   │   ├── sm2.ts          #    SM-2 间隔重复算法
│   │   │   └── utils/          #    通用工具函数
│   │   ├── components/         # 🧩 共享 UI 组件
│   │   ├── hooks/              # 🪝 自定义 React Hooks
│   │   ├── pages/              # 📄 页面级组件
│   │   ├── routes/             # 🧭 路由配置
│   │   ├── store/              # 🗄️ Zustand 全局状态
│   │   ├── styles/             # 🎨 全局样式 & Design Tokens
│   │   └── types/              # 📐 TypeScript 类型定义
│   ├── src-tauri/              # 🦀 Tauri Rust 后端
│   └── package.json
├── server/                     # ⚙️ 后端服务
│   ├── sync-service/           #    Go 数据同步服务（:8080）
│   ├── ai-gateway/             #    Python AI 网关服务（:8000）
│   ├── shared/proto/           #    gRPC Protobuf 定义
│   └── docker-compose.yml      #    容器编排配置
├── docs/                       # 📖 项目文档（按阶段组织）
│   ├── phase0/                 #    项目立项与启动
│   ├── phase1/                 #    需求分析
│   ├── phase2/                 #    项目计划与技术预研
│   └── phase3/                 #    系统设计
├── .env.example                # 🔑 环境变量模板
└── README.md
```

---

## 🏗️ 架构概览

课伴采用 **"本地优先 + AI 增强可选"** 双模式架构：

```
┌──────────────────────────────────────────────────────┐
│                 课伴桌面端 (Tauri 2.0)                 │
│  ┌────────────────────────────────────────────────┐  │
│  │           React 前端 (Vite + TypeScript)         │  │
│  │                                                  │  │
│  │   🍅 番茄钟  │ 📝 智能笔记 │ 🃏 闪卡 │ 🧠 费曼  │  │
│  │                                                  │  │
│  │         ↕                ↕                       │  │
│  │   Dexie.js (IndexedDB)  TipTap (ProseMirror)   │  │
│  └────────────────────┬───────────────────────────┘  │
└───────────────────────┼──────────────────────────────┘
                        │  可选（联网时按需开启）
             ┌──────────┴──────────┐
             │                     │
      ┌──────┴──────┐      ┌──────┴──────┐
      │ Sync Service │      │ AI Gateway  │
      │   (Go/Gin)   │      │  (FastAPI)  │
      │     ↕        │      │     ↕       │
      │  PG + Redis  │      │ Qwen / DS   │
      └──────────────┘      │   / GLM     │
                            └─────────────┘
```

> **离线模式**：所有四大模块在纯本地环境完整运行，数据存储在 IndexedDB，零网络依赖。
>
> **AI 增强模式**：联网时可选择开启 AI 能力（笔记摘要、闪卡生成、学习评估等），通过 AI Gateway 对接国产大模型。

---

## 🗺️ 路线图

| 阶段 | 状态 | 核心交付 |
|------|------|----------|
| **MVP-1 Alpha** | ✅ 已完成 | 纯本地核心版 — 四大模块 + PWA 离线 + 本地存储 |
| **MVP-2 Alpha** | 🔧 进行中 | AI 增强 + 云同步 + Tauri 桌面端 + 用户认证 |
| **Beta 公测** | 📋 规划中 | 全功能集成，面向真实用户测试 |
| **正式上线** | 🎯 规划中 | 生产就绪版 |

### 🔮 未来方向

- **社交协作**：学习小组、闪卡共享、专注排行榜
- **跨端生态**：移动端 App、浏览器插件
- **AI 深度增强**：个性化学习路径、知识图谱、智能复习规划
- **开放平台**：插件系统、第三方模板市场

---

## 📖 项目文档

完整的开发文档存放在 [`docs/`](./docs/) 目录，按项目生命周期组织：

| 阶段 | 目录 | 主要内容 |
|------|------|----------|
| Phase 0 | [`docs/phase0/`](./docs/phase0/) | 项目立项书、可行性评估、风险登记册、团队角色与沟通机制 |
| Phase 1 | [`docs/phase1/`](./docs/phase1/) | PRD 需求文档、用户故事地图、业务流程图、竞品分析 |
| Phase 2 | [`docs/phase2/`](./docs/phase2/) | WBS 工作量估算、SM-2 算法验证、技术预研报告、甘特图 |
| Phase 3 | [`docs/phase3/`](./docs/phase3/) | 系统架构设计、技术选型 ADR、UI 设计规范、API 设计规范 |

---

## 📦 版本与发布管理

### 语义化版本规范

项目遵循 **SemVer**（语义化版本）规范，格式为 `v{MAJOR}.{MINOR}.{PATCH}`：

| 组成部分 | 含义 | 示例 |
|----------|------|------|
| `MAJOR` | 主版本号（不兼容的 API 变更） | `1.0.0` |
| `MINOR` | 次版本号（向后兼容的功能新增） | `0.2.0` |
| `PATCH` | 修订号（向后兼容的缺陷修复） | `0.2.1` |

**当前版本**：`v0.2.0-alpha`（MVP-2 Alpha 阶段）

### Git Tag 发布流程

```bash
# 1. 确保在 master 分支并拉取最新代码
git checkout master
git pull origin master

# 2. 创建语义化版本标签
git tag v0.2.0

# 3. 推送标签到远程仓库
git push origin v0.2.0
```

> ⚠️ 发布 Tag 前请确保：所有测试通过（`npm run test`）、构建成功（`npm run build`）、关键功能手动验证完毕。

### Tauri 安装包构建

桌面端安装包通过 Tauri CLI 构建：

```bash
cd client
npm run build              # 前端生产构建
npx tauri build            # 生成 NSIS 安装包
```

- 产物路径：`client/src-tauri/target/release/bundle/nsis/`
- 安装包格式：Windows NSIS（`.exe`），支持简体中文 / English
- 安装模式：当前用户安装（`currentUser`），无需管理员权限

---

## 👥 团队协作

### 开发工作流

```
feature/* ──PR──▶ develop ──▶ master ──tag──▶ release
```

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `master` | 稳定发布分支 | 仅接受 develop 合并，需 Tag 标记发布 |
| `develop` | 日常开发集成分支 | 功能分支通过 PR 合入 |
| `feature/*` | 功能开发分支 | 从 develop 检出，完成后 PR 回合 |
| `fix/*` | 缺陷修复分支 | 紧急修复可直接 PR 到 master |

### 提交规范

项目使用 **Conventional Commits** 规范：

```
<type>(<scope>): <description>

# 示例
feat(notes): 添加康奈尔笔记模板
fix(pomodoro): 修复切换标签页后计时器暂停的问题
refactor(storage): 优化 Dexie.js 索引策略
docs(phase3): 补充 API 设计规范文档
```

常用类型：`feat` · `fix` · `refactor` · `docs` · `style` · `test` · `chore` · `perf`

### 代码质量

| 工具 | 用途 | 命令 |
|------|------|------|
| Oxlint | 高性能 Rust Linter | `npm run lint` |
| Vitest | 单元与组件测试 | `npm run test` |
| TypeScript | 静态类型检查 | `npm run build`（含 `tsc -b`） |

> 提交 PR 前请确保 `npm run lint` 和 `npm run test` 全部通过。

---

## 📄 许可证

**Private — All Rights Reserved.**

本项目为私有项目，所有权利保留。未经书面许可，不得复制、修改或分发本项目的任何部分。
