# 课伴（KeBan）

> 提高网课效率的智能学习工具

## 项目简介

课伴是一款以"提高网课效率"为核心定位的学习工具软件，提供四大核心学习工具模块：

- **番茄钟（Pomodoro Timer）**：专注时长管理与统计
- **智能笔记（Notes）**：结构化随堂笔记记录
- **闪卡（Flashcards）**：SM-2 间隔重复记忆
- **费曼学习法（Feynman Technique）**：以教代学深度理解

## 架构理念

**本地优先 + AI 增强可选**

- **本地模式**：所有核心功能可在纯本地离线环境完整运行，不依赖任何网络服务
- **AI 增强模式**：网络可用时可选开启 AI 辅助能力，作为增值功能叠加

## 技术栈

| 领域 | 选型 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 本地存储 | Dexie.js (IndexedDB) + localStorage |
| 离线缓存 | Service Worker (Workbox) |
| 富文本编辑器 | TipTap (ProseMirror) |
| 后端语言 | Go + Python |
| 数据库 | PostgreSQL 16 + Redis 7 |
| AI 框架 | FastAPI + LangChain |

## 项目结构

```
├── docs/           # 项目文档（按开发流程阶段组织）
│   ├── phase0/     # 阶段零：项目立项与启动
│   ├── phase1/     # 阶段一：需求阶段
│   ├── phase2/     # 阶段二：签约与项目计划
│   ├── phase3/     # 阶段三：设计阶段
│   └── templates/  # 文档模板
├── client/         # 前端客户端代码
├── server/         # 后端服务代码
└── scripts/        # 脚本工具
```

## 里程碑

| 里程碑 | 时间节点 | 交付 |
|--------|---------|------|
| MVP-1 Alpha | 第 28 周 | 本地核心版（番茄钟+笔记+闪卡+费曼） |
| MVP-2 Alpha | 第 36 周 | AI 增强版（云同步+AI 功能） |
| Beta 公测 | 第 44 周 | 全功能集成版 |
| 正式上线 | 第 54 周 | 生产就绪版 |

## 许可证

Private - All rights reserved
