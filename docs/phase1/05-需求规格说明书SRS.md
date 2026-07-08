# 课伴需求规格说明书（SRS）v1.0

> **文档编号**：KB-SRS-001  
> **版本**：v1.0  
> **阶段**：Phase 1 — 需求阶段  
> **最后更新**：2026-07-08

---

## 1. 引言

### 1.1 目的

本文档是课伴（KeBan）学习辅助工具的完整需求规格说明，旨在为项目团队提供明确、可验证的功能与非功能需求基准。本文档面向产品经理、开发工程师、测试工程师和项目管理人员。

### 1.2 范围

课伴是一款面向网课学生的本地优先（Local-first）学习辅助工具，包含以下核心模块：

- **番茄钟模块**：专注计时与学习时长量化
- **智能笔记模块**：结构化笔记记录与知识组织
- **闪卡模块**：基于 SM-2 算法的间隔重复记忆系统
- **费曼学习法模块**：引导式深度学习与薄弱点攻克

产品遵循"本地优先、AI 增强"原则，MVP-1 阶段交付完整本地核心功能，MVP-2 阶段叠加 AI 增强与云同步能力。

### 1.3 术语表

| 术语 | 定义 |
|------|------|
| KeBan / 课伴 | 本产品名称 |
| Local-first | 本地优先架构，核心功能不依赖网络 |
| SM-2 | SuperMemo 2 算法，间隔重复记忆调度算法 |
| Pomodoro | 番茄工作法，以 25 分钟为单位的专注计时方法 |
| 费曼学习法 | 以"教会别人"为核心思想的四步学习方法 |
| IndexedDB | 浏览器内置的结构化数据存储 API |
| CRDT | Conflict-free Replicated Data Type，无冲突复制数据类型 |
| LWW | Last-Write-Wins，最后写入优先的冲突解决策略 |
| OpLog | Operation Log，操作日志 |
| EF (Ease Factor) | SM-2 算法中的难度因子参数 |
| MVP | Minimum Viable Product，最小可行产品 |
| LLM | Large Language Model，大语言模型 |

---

## 2. 总体描述

### 2.1 产品视角

课伴定位为**个人学习辅助工具**，而非教学管理平台。它帮助学生管理自己的学习过程（时间管理、知识记录、记忆巩固、深度理解），不涉及教师端、课程端或家长端功能（MVP 阶段）。

**系统边界**：
```
┌─────────────────────────────────────────────┐
│                课伴（KeBan）                   │
│  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐ │
│  │ 番茄钟  │ │ 笔记   │ │ 闪卡 │ │ 费曼   │ │
│  └────────┘ └────────┘ └──────┘ └────────┘ │
│  ┌─────────────────────────────────────────┐│
│  │  基础设施（存储·同步·账户·AI Provider）    ││
│  └─────────────────────────────────────────┘│
└──────────────┬──────────────────────────────┘
               │ (MVP-2)
         ┌─────┴─────┐
         │  云端服务   │
         │  同步·AI   │
         └───────────┘
```

### 2.2 用户特征

| 用户类型 | 描述 | 技术水平 | 使用频率 |
|---------|------|---------|---------|
| 网课学生（核心用户） | 初中至大学生，每日上网课 2-6 小时 | 中等（熟悉浏览器操作） | 每日 |
| 自律困难学生 | 需要外部工具辅助集中注意力 | 中等 | 每日多次 |
| 考试备考生 | 需要大量记忆和知识整理 | 中高 | 高强度（考前 2-4 周） |
| 学习方法探索者 | 对费曼学习法等方法论感兴趣 | 中高 | 每周 3-5 次 |

### 2.3 运行环境

| 维度 | 要求 |
|------|------|
| 平台 | Web 应用（MVP-1）；Web + Electron 桌面端（MVP-2） |
| 浏览器 | Chrome 90+、Firefox 88+、Edge 90+、Safari 14+（最新 2 个主要版本） |
| 操作系统 | Windows 10+、macOS 11+、Linux（主流发行版） |
| 屏幕分辨率 | 最低 1024×768，推荐 1920×1080 |
| 网络 | MVP-1 不要求；MVP-2 中 AI 功能需要稳定网络连接 |
| 存储 | 浏览器 IndexedDB 可用空间 ≥ 100MB |

### 2.4 约束条件

| 约束 | 说明 |
|------|------|
| 浏览器存储限制 | IndexedDB 通常限制为磁盘空间的 50%，需管理存储配额 |
| Web Worker 限制 | 部分浏览器在后台限制 Worker 执行，需处理计时精度问题 |
| Notification API | 需要用户授权；Safari 对通知的支持有限 |
| 无后端（MVP-1） | MVP-1 阶段不搭建服务端，所有数据纯本地 |
| AI API 成本 | AI 功能按调用量计费，需要设计用量控制机制 |

---

## 3. 功能需求

### 3.1 基础设施模块

| 编号 | 需求描述 | 优先级 |
|------|---------|--------|
| SRS-INF-001 | 系统应提供 IndexedDB 封装层，支持 CRUD 操作、事务管理和连接池 | Must |
| SRS-INF-002 | 系统应支持数据库 Schema 版本管理和自动迁移 | Must |
| SRS-INF-003 | 系统应支持数据导出为 JSON / CSV / Markdown 格式 | Must |
| SRS-INF-004 | 系统应支持从 JSON / CSV / Markdown 文件导入数据 | Must |
| SRS-INF-005 | 系统应提供本地用户 Profile 管理（用户名/头像/偏好设置） | Must |
| SRS-INF-006 | 系统应提供跨模块学习数据汇总看板（今日专注时长/笔记数/复习数/费曼完成数） | Must |
| SRS-INF-007 | 系统应支持云同步引擎（增量同步、冲突解决）（MVP-2） | Should |
| SRS-INF-008 | 系统应支持用户注册/登录（手机号/邮箱）（MVP-2） | Should |
| SRS-INF-009 | 系统应提供可插拔 AI Provider 接口（支持 OpenAI / Anthropic 等）（MVP-2） | Should |

### 3.2 番茄钟模块

| 编号 | 需求描述 | 优先级 |
|------|---------|--------|
| SRS-PT-001 | 系统应提供计时引擎，支持工作 / 短休息 / 长休息三段式计时 | Must |
| SRS-PT-002 | 计时引擎应在后台（标签页切换/最小化）保持稳定运行 | Must |
| SRS-PT-003 | 系统应提供"上课模式"——计时结束后静默提示，不弹出休息提醒 | Must |
| SRS-PT-004 | 系统应提供"自习模式"——标准 25/5 分钟节奏，每 4 个番茄后长休息 | Must |
| SRS-PT-005 | 系统应在计时结束时通过 Notification API 发送浏览器通知 | Must |
| SRS-PT-006 | 系统应在计时结束时播放可配置的声音提示 | Must |
| SRS-PT-007 | 系统应在计时过程中显示进度环动画，颜色随模式变化 | Must |
| SRS-PT-008 | 系统应允许用户自定义工作/短休息/长休息时长和每轮番茄数 | Must |
| SRS-PT-009 | 系统应自动保存每次计时记录（开始时间/结束时间/实际时长/模式） | Must |
| SRS-PT-010 | 系统应提供每日统计：今日专注时长、完成番茄数、最长连续记录 | Must |
| SRS-PT-011 | 系统应提供每周统计图表：柱状图 + 7 日移动平均趋势线 | Must |
| SRS-PT-012 | 系统应支持按自定义日期范围查看历史统计数据 | Must |
| SRS-PT-013 | 系统应提供统计数据 CSV 导出功能 | Must |
| SRS-PT-014 | 系统应基于历史数据提供 AI 智能时长推荐（MVP-2） | Should |
| SRS-PT-015 | 系统应基于时间段和历史数据提供 AI 专注度预测（MVP-2） | Should |

### 3.3 智能笔记模块

| 编号 | 需求描述 | 优先级 |
|------|---------|--------|
| SRS-NT-001 | 系统应提供富文本编辑器，支持标题（H1-H6）、有序/无序列表、代码块、表格、图片插入 | Must |
| SRS-NT-002 | 系统应内置至少 5 个笔记模板：大纲式、康奈尔、思维导图式、自由笔记、课堂速记 | Must |
| SRS-NT-003 | 系统应在新建笔记时提供模板选择界面 | Must |
| SRS-NT-004 | 系统应支持多级文件夹组织（至少 3 级嵌套） | Must |
| SRS-NT-005 | 系统应支持自由标签系统，笔记可关联多个标签 | Must |
| SRS-NT-006 | 系统应提供本地全文搜索，1000 篇笔记规模下响应时间 < 500ms | Must |
| SRS-NT-007 | 系统应支持搜索结果按相关性排序，支持按时间/标题二次排序 | Must |
| SRS-NT-008 | 系统应支持编辑内容自动保存（间隔 ≤ 10 秒） | Must |
| SRS-NT-009 | 系统应支持笔记版本历史（本地保存最近 10 个版本） | Must |
| SRS-NT-010 | 系统应支持 Markdown / HTML / JSON 格式的导入和导出 | Must |
| SRS-NT-011 | 系统应支持拖拽笔记到文件夹、拖拽调整笔记顺序 | Must |
| SRS-NT-012 | 系统应支持批量操作（多选移动/打标签/删除） | Must |
| SRS-NT-013 | 系统应提供 AI 智能摘要功能，点击后 < 3 秒返回结果（MVP-2） | Should |
| SRS-NT-014 | 系统应提供 AI 续写/润色功能（MVP-2） | Should |
| SRS-NT-015 | 系统应提供 AI 关键词提取和高亮标注（MVP-2） | Should |
| SRS-NT-016 | 系统应提供基于向量数据库的 AI 语义搜索（V2.0） | Could |

### 3.4 闪卡模块

| 编号 | 需求描述 | 优先级 |
|------|---------|--------|
| SRS-FC-001 | 系统应支持创建/编辑/删除卡片，卡片包含正面（问题）和背面（答案） | Must |
| SRS-FC-002 | 卡片内容应支持文字、图片、代码块 | Must |
| SRS-FC-003 | 系统应实现 SM-2 间隔重复算法，支持 Again/Hard/Good/Easy 四档评分 | Must |
| SRS-FC-004 | SM-2 算法应正确维护每张卡片的 EF 值（初始 2.5，最低 1.3）和间隔天数 | Must |
| SRS-FC-005 | 系统应在每日打开时汇总当日到期卡片数量并提示复习 | Must |
| SRS-FC-006 | 系统应支持创建/编辑/删除牌组 | Must |
| SRS-FC-007 | 牌组应支持至少 3 级嵌套（科目→章节→知识点） | Must |
| SRS-FC-008 | 每个牌组应显示总卡片数、今日到期数、已掌握数 | Must |
| SRS-FC-009 | 系统应提供学习会话功能，混合推送新卡片和到期复习卡片 | Must |
| SRS-FC-010 | 系统应支持设定每轮学习数量上限（默认 20 张） | Must |
| SRS-FC-011 | 系统应提供学习统计：今日复习数/新学数/正确率/遗忘曲线可视化 | Must |
| SRS-FC-012 | 系统应支持 CSV / JSON 格式批量导入卡片 | Must |
| SRS-FC-013 | 系统应支持全局和牌组内卡片搜索 | Must |
| SRS-FC-014 | 系统应提供 AI 自动生成卡片功能（基于笔记内容）（MVP-2） | Should |
| SRS-FC-015 | 系统应提供 AI 智能难度调整（动态 EF 参数）（MVP-2） | Should |
| SRS-FC-016 | 系统应提供 AI 解释补充功能（MVP-2） | Should |

### 3.5 费曼学习法模块

| 编号 | 需求描述 | 优先级 |
|------|---------|--------|
| SRS-FM-001 | 系统应提供四步流程引导引擎：选择概念→解释→识别薄弱→简化重述 | Must |
| SRS-FM-002 | 用户可在步骤间自由前进和后退，已填写内容不丢失 | Must |
| SRS-FM-003 | 每步内容应自动保存到本地（间隔 ≤ 30 秒） | Must |
| SRS-FM-004 | 步骤进度条应清晰展示当前进度，已完成步骤可点击回看 | Must |
| SRS-FM-005 | 系统应提供大面积文字编辑区，支持加粗/列表/代码块排版 | Must |
| SRS-FM-006 | 系统应支持选中文字后标记为薄弱点 | Must |
| SRS-FM-007 | 被标记的薄弱点应以醒目颜色高亮显示 | Must |
| SRS-FM-008 | 所有薄弱点应自动汇总到"待补强"列表 | Must |
| SRS-FM-009 | 待补强列表应支持按科目/日期筛选 | Must |
| SRS-FM-010 | 薄弱点可标记"已掌握"移出待补强列表，保留历史记录 | Must |
| SRS-FM-011 | 流程完成后记录完成状态和理解深度自评（1-5 星） | Must |
| SRS-FM-012 | 已完成的费曼学习归入历史列表，可随时回顾 | Must |
| SRS-FM-013 | 系统应提供薄弱点统计（总数/科目分布/本周新增-已攻克） | Must |
| SRS-FM-014 | 系统应提供 AI 解释质量评估功能（MVP-2） | Should |
| SRS-FM-015 | 系统应提供 AI 引导问题生成功能（MVP-2） | Should |
| SRS-FM-016 | 系统应提供 AI 录音转文字功能（MVP-2） | Should |

---

## 4. 非功能需求

### 4.1 性能需求

| 编号 | 指标 | 目标值 | 测量条件 |
|------|------|--------|---------|
| NFR-PERF-001 | 首屏加载时间 | < 3 秒 | 生产环境、首次访问（无缓存）、4G 网络 |
| NFR-PERF-002 | 操作响应时间 | < 200ms | 所有交互操作（按钮点击/输入/切换） |
| NFR-PERF-003 | 全文搜索响应 | < 500ms | 1000 篇笔记规模 |
| NFR-PERF-004 | 卡片翻转动画 | ≥ 60fps | 闪卡翻转动画 |
| NFR-PERF-005 | 自动保存延迟 | ≤ 10 秒（笔记）/ ≤ 30 秒（费曼） | 从最后编辑到保存完成 |
| NFR-PERF-006 | AI 摘要响应 | < 3 秒 | 网络正常情况 |
| NFR-PERF-007 | AI 卡片生成 | < 5 秒 | 网络正常情况 |
| NFR-PERF-008 | 应用打包体积 | < 5MB（gzip 后） | MVP-1 不含 AI 模块 |
| NFR-PERF-009 | IndexedDB 读写 | < 50ms | 单次 CRUD 操作 |

### 4.2 可靠性需求

| 编号 | 指标 | 目标值 |
|------|------|--------|
| NFR-REL-001 | 离线可用性 | 100% 基础功能纯离线可用 |
| NFR-REL-002 | 数据持久性 | 正常关闭浏览器不丢失任何已保存数据 |
| NFR-REL-003 | 崩溃恢复 | 意外关闭后可恢复到最近自动保存状态 |
| NFR-REL-004 | 计时精度 | 番茄钟计时误差 < 1 秒/小时 |
| NFR-REL-005 | SM-2 正确性 | 算法计算结果与标准 SM-2 参考实现一致 |

### 4.3 安全性需求

| 编号 | 指标 | 描述 |
|------|------|------|
| NFR-SEC-001 | 本地数据加密 | 敏感字段使用 AES-256 加密存储 |
| NFR-SEC-002 | 密钥管理 | 加密密钥由用户密码通过 PBKDF2 派生 |
| NFR-SEC-003 | 传输加密 | 所有云端通信使用 HTTPS（TLS 1.3） |
| NFR-SEC-004 | 认证机制 | JWT 短期 Token（15 分钟）+ Refresh Token（7 天） |
| NFR-SEC-005 | XSS 防护 | 用户输入内容渲染时进行 HTML 转义 |
| NFR-SEC-006 | 本地缓存安全 | 浏览器缓存中不存储明文笔记/卡片内容 |

### 4.4 兼容性需求

| 编号 | 指标 | 描述 |
|------|------|------|
| NFR-CMP-001 | Chrome | 最新 2 个主要版本完全支持 |
| NFR-CMP-002 | Firefox | 最新 2 个主要版本完全支持 |
| NFR-CMP-003 | Edge | 最新 2 个主要版本完全支持 |
| NFR-CMP-004 | Safari | 14+ 完全支持（Notification API 受限除外） |
| NFR-CMP-005 | 响应式 | 支持 1024px 以上屏幕，优先桌面端体验 |

### 4.5 可用性需求

| 编号 | 指标 | 描述 |
|------|------|------|
| NFR-USE-001 | 新手引导 | 首次使用时提供各模块简要功能引导（< 5 步） |
| NFR-USE-002 | 操作反馈 | 所有用户操作在 200ms 内提供视觉反馈 |
| NFR-USE-003 | 错误恢复 | 误操作可通过撤销（Ctrl+Z）恢复，至少支持 10 步撤销 |
| NFR-USE-004 | 无障碍 | 关键操作支持键盘导航和 ARIA 标签 |
| NFR-USE-005 | 国际化 | MVP-1 支持中文；MVP-2 支持中文/英文双语 |

---

## 5. 接口需求

### 5.1 本地存储接口

```typescript
interface IStorageProvider {
  // 基础 CRUD
  create<T>(store: string, data: T): Promise<string>;
  read<T>(store: string, id: string): Promise<T | null>;
  update<T>(store: string, id: string, data: Partial<T>): Promise<void>;
  delete(store: string, id: string): Promise<void>;
  
  // 批量操作
  batchCreate<T>(store: string, items: T[]): Promise<string[]>;
  query<T>(store: string, filter: QueryFilter): Promise<T[]>;
  
  // 搜索
  search(stores: string[], keyword: string): Promise<SearchResult[]>;
  
  // 迁移
  migrate(fromVersion: number, toVersion: number): Promise<void>;
  
  // 导入导出
  export(format: 'json' | 'csv' | 'markdown'): Promise<Blob>;
  import(data: Blob, format: 'json' | 'csv' | 'markdown'): Promise<ImportResult>;
}
```

### 5.2 云同步 API（MVP-2）

```typescript
interface ISyncAPI {
  // 推送本地操作
  pushOps(ops: OpLog[]): Promise<SyncResult>;
  
  // 拉取云端变更
  pullChanges(since: string): Promise<OpLog[]>;
  
  // 冲突解决
  resolveConflict(entityId: string, resolution: ConflictResolution): Promise<void>;
  
  // 同步状态
  getSyncStatus(): Promise<SyncStatus>;
}
```

### 5.3 AI API 接口（MVP-2）

```typescript
interface IAIProvider {
  // 笔记摘要
  summarize(content: string, options?: SummarizeOptions): Promise<string>;
  
  // 文本续写/润色
  enhance(text: string, mode: 'continue' | 'polish'): Promise<string>;
  
  // 关键词提取
  extractKeywords(content: string): Promise<Keyword[]>;
  
  // 生成闪卡
  generateCards(content: string, options?: CardGenOptions): Promise<CardDraft[]>;
  
  // 费曼评估
  evaluateExplanation(concept: string, explanation: string): Promise<EvaluationResult>;
  
  // 可用性检查
  isAvailable(): Promise<boolean>;
}
```

---

## 6. 数据需求

### 6.1 本地数据模型概要

#### 核心实体

| 实体 | 主要字段 | 存储位置 |
|------|---------|---------|
| User Profile | id, username, avatar, preferences, createdAt | IndexedDB |
| PomodoroRecord | id, startTime, endTime, duration, mode, type (work/break) | IndexedDB |
| PomodoroConfig | id, workDuration, shortBreak, longBreak, pomodorosPerRound | IndexedDB |
| Note | id, title, content (JSON), templateType, folderId, tags[], version, createdAt, updatedAt | IndexedDB |
| Folder | id, name, parentId, order, createdAt | IndexedDB |
| Tag | id, name, color | IndexedDB |
| NoteTag | noteId, tagId | IndexedDB |
| Deck | id, name, parentId, description, createdAt | IndexedDB |
| Card | id, deckId, front (JSON), back (JSON), ef, interval, dueDate, reviewCount, createdAt | IndexedDB |
| ReviewLog | id, cardId, rating, timestamp, nextDueDate | IndexedDB |
| FeynmanSession | id, concept, steps[4], currentStep, status, selfRating, createdAt, completedAt | IndexedDB |
| WeakPoint | id, sessionId, content, status (pending/mastered), subject, createdAt | IndexedDB |
| OpLog | opId, deviceId, timestamp, entityType, entityId, operation, payload, version | IndexedDB |

#### 索引策略

| 实体 | 索引字段 | 用途 |
|------|---------|------|
| PomodoroRecord | startTime, mode | 按时间范围查询、按模式筛选 |
| Note | folderId, updatedAt | 按文件夹列出、按时间排序 |
| NoteTag | tagId | 按标签筛选笔记 |
| Card | deckId, dueDate | 按牌组列出、查询到期卡片 |
| ReviewLog | cardId, timestamp | 查询卡片复习历史 |
| FeynmanSession | status, createdAt | 按状态筛选、按时间排序 |
| WeakPoint | status, subject | 按状态和科目筛选 |
| OpLog | timestamp, synced | 查询未同步操作 |

### 6.2 数据导入导出格式

| 格式 | 支持实体 | 说明 |
|------|---------|------|
| JSON | 全部 | 完整数据结构和元信息，用于备份和迁移 |
| CSV | PomodoroRecord, Card | 扁平化结构，适合在 Excel 中查看 |
| Markdown | Note | 将笔记内容转为 Markdown 文本，含 YAML Front Matter |

#### JSON 导出示例

```json
{
  "exportVersion": "1.0",
  "exportDate": "2026-07-08T10:00:00Z",
  "appVersion": "1.0.0",
  "data": {
    "pomodoroRecords": [...],
    "notes": [...],
    "folders": [...],
    "tags": [...],
    "decks": [...],
    "cards": [...],
    "feynmanSessions": [...],
    "weakPoints": [...]
  }
}
```

#### CSV 卡片导入格式

```csv
front,back,deck,tags
"什么是光合作用？","光合作用是植物利用光能将CO2和H2O转化为有机物的过程","生物-基础","定义,核心概念"
```
