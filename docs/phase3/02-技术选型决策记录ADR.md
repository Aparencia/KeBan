# 课伴技术选型决策记录（ADR）

> 版本：v1.2 | 最后更新：2026-07-09

本文档记录课伴项目所有关键技术选型决策，采用 ADR（Architecture Decision Record）标准格式。

---

## ADR-001：前端框架 — React 18 + TypeScript + Vite

**状态：** 已决定（Accepted）

**背景：**
课伴是一款面向学生的本地优先学习工具，需要支持PWA离线运行、复杂的交互界面（计时器、卡片翻转、富文本编辑）以及后续Electron桌面端和React Native移动端的扩展。

**决策：**
采用 React 18 + TypeScript + Vite 作为前端核心技术栈。

**理由：**
- **生态成熟**：React拥有最庞大的社区和最丰富的第三方库，番茄钟、图表、动画等组件可直接复用
- **PWA支持好**：React + Workbox的PWA方案最为成熟，Create React App和Vite均有完善插件
- **Concurrent Mode**：React 18的并发渲染能力适合实时更新场景（计时器状态、笔记自动保存）
- **TypeScript**：强类型保证多人协作代码质量，减少运行时错误，IDE提示更友好
- **Vite**：相比Webpack，开发服务器启动速度提升10x+，HMR几乎零延迟，极大提升开发体验
- **跨端扩展性**：React代码可最大程度复用到React Native移动端

**备选方案对比：**

| 方案 | 优势 | 劣势 | 放弃原因 |
|------|------|------|---------|
| Vue 3 + Vite | 学习曲线平缓 | PWA生态略弱于React | 跨端扩展性不如RN |
| Svelte + Vite | 包体积小 | 生态规模小，组件库少 | 富文本编辑器集成困难 |
| Solid.js | 性能极致 | 生态过于早期 | 社区支持不足 |

**后果：**
- 正面：开发效率高，生态丰富，招人容易
- 负面：React打包体积相对较大（~40KB gzipped），但通过Vite tree-shaking可控制
- 风险：React未来大版本升级可能带来迁移成本

---

## ADR-002：状态管理 — Zustand + TanStack Query

**状态：** 已决定（Accepted）

**背景：**
课伴存在两类截然不同的状态：①客户端本地状态（计时器进度、UI开关、临时编辑内容）②服务端异步状态（同步数据、AI请求结果、账户信息）。需要分别用最合适的工具管理。

**决策：**
- **客户端状态**：Zustand（轻量状态管理）
- **服务端/异步状态**：TanStack Query（React Query v5）

**理由：**

**Zustand：**
- 极简API，无需Provider包裹，无样板代码
- 包体积仅~1KB，对PWA性能零影响
- 支持持久化中间件，可与localStorage/IndexedDB无缝集成
- 适合管理：计时器状态、当前选中的笔记/牌组、UI模态框开关等

**TanStack Query：**
- 专为异步数据设计，内置缓存、重试、轮询、乐观更新
- 完美契合同步场景：本地操作→乐观更新UI→后台推送→确认/回滚
- 支持离线查询缓存，网络恢复后自动refetch
- 适合管理：同步数据拉取、AI API调用、账户验证等异步操作

**备选方案对比：**

| 方案 | 放弃原因 |
|------|---------|
| Redux Toolkit | 样板代码多，对于4个模块的中型项目过重 |
| Jotai | 原子化状态适合细粒度更新，但团队学习成本高 |
| MobX | 隐式响应式难以调试，TypeScript支持不够完善 |
| XState | 状态机过于重型，仅番茄钟计时器适合 |

**后果：**
- 正面：两个库合计包体积<5KB，API简洁，开发效率高
- 负面：两个库需要在组件层协调，有一定心智负担
- 迁移成本：若需更换，Zustand可替换为任意轻量状态库，TanStack Query替换成本较高

> **状态更新 (v1.2, MVP-2 Alpha 实施)**：桌面端方案已 Superseded。
> 实际采用 **Tauri 2.0** 替代 Electron。
> - 安装包体积从 100-300MB 降至 5-15MB
> - 运行时内存从 200-500MB 降至 30-100MB
> - 前端代码 95-99% 复用
> - 决策依据：更轻量、更好的系统集成、SQLite 原生支持

---

## ADR-003：本地存储 — Supabase本地客户端 (PostgreSQL) + localStorage

**状态：** 已决定（Accepted） ~~（原：Dexie.js + IndexedDB，已于v1.1升级）~~

**背景：**
课伴作为本地优先应用，本地存储是核心基础设施。需存储：学习记录（结构化数据）、笔记内容（富文本大文本）、闪卡数据（可能包含图片）、用户配置等。容量需求可达数百MB。

**决策：**
- **主存储**：Supabase本地客户端（PostgreSQL）
- **配置/会话**：localStorage
- **大文件**：OPFS（Chromium）降级到PostgreSQL BLOB（其他浏览器）

**理由：**

**Supabase本地客户端（PostgreSQL）：**
- **统一数据栈**：本地与云端均使用PostgreSQL，消除Dexie/IndexedDB到Supabase的映射开销
- **完整SQL能力**：支持JOIN、事务、全文搜索（pg_trgm）、复杂聚合查询
- **RLS策略复用**：行级安全策略在本地和云端共享同一套规则
- **实时订阅**：Supabase Realtime支持数据库变更实时推送到前端
- **无缝云同步**：本地PostgreSQL操作可直接replay到云端，无需ORM映射
- **数据一致性**：ACID事务保证本地数据完整性，优于IndexedDB的弱事务模型

**localStorage：**
- 同步API，适合存储用户偏好、主题设置、Token等小型数据
- 容量5-10MB，足够存储配置信息
- 零依赖，浏览器原生支持

**备选方案对比：**

| 方案 | 优势 | 劣势 | 决策 |
|------|------|------|------|
| Dexie.js (IndexedDB) | 浏览器原生，零安装 | 无SQL、无JOIN、需ORM映射到Supabase | 不采用（v1.1废弃） |
| SQLite WASM (wa-sqlite) | SQL能力强 | 额外加载~1MB WASM，与Supabase不兼容 | 不采用 |
| PouchDB | CouchDB同步协议 | 包体积大，同步逻辑复杂 | 不采用 |
| RxDB | 响应式+同步 | 过于重型，学习曲线陡峭 | 不采用 |
| localStorage全量 | 简单 | 容量仅5-10MB，不支持索引 | 仅用于配置 |

**后果：**
- 正面：本地与云端统一PostgreSQL，SQL能力完整，同步架构大幅简化
- 正面：RLS策略复用，安全模型一致；实时订阅开箱即用
- 负面：本地PostgreSQL运行依赖WASM或Electron环境，PWA纯浏览器场景受限
- 缓解：Electron桌面端优先落地；PWA场景可保留IndexedDB降级方案

> **状态更新 (v1.2, MVP-2 Alpha 实施)**：已 Superseded。
> MVP-2 Alpha 阶段**保留 Dexie.js (IndexedDB)**，未执行 Supabase 本地客户端迁移。
> - 原因：Supabase 本地 PostgreSQL 强依赖 Docker（13+ 容器），无法嵌入桌面应用安装包
> - 通过 `IRepository<T>` 存储抽象接口隔离实现，后续迁移仅需替换底层适配器
> - 计划：Tauri 桌面端阶段迁移至 `tauri-plugin-sql` (SQLite)

---

## ADR-004：离线缓存 — Service Worker (Workbox)

**状态：** 已决定（Accepted）

**背景：**
课伴需要在无网络环境下完整可用，要求所有静态资源和动态数据均支持离线访问。PWA的核心依赖Service Worker实现离线缓存。

**决策：**
采用 Google Workbox 框架封装 Service Worker。

**理由：**
- **降低复杂度**：原生Service Worker API繁琐，Workbox提供高级抽象
- **预缓存策略**：构建时自动生成静态资源清单，首次访问即缓存所有关键资源
- **运行时策略丰富**：CacheFirst、NetworkFirst、StaleWhileRevalidate等开箱即用
- **后台同步**：Workbox Background Sync插件可自动管理离线队列，网络恢复后重放
- **版本管理**：内置缓存版本控制和过期清理，防止存储空间无限增长

**缓存策略矩阵：**

| 资源类型 | 策略 | TTL | 说明 |
|---------|------|-----|------|
| JS/CSS/字体 | CacheFirst | 30天 | 静态资源优先缓存 |
| HTML入口 | NetworkFirst | 7天 | 优先获取最新，离线回退 |
| 图片资源 | StaleWhileRevalidate | 14天 | 快速展示，后台更新 |
| API响应 | NetworkFirst + Queue | 1天 | 在线取最新，离线用缓存 |
| AI响应 | CacheFirst | 7天 | 相同问题缓存结果 |

**后果：**
- 正面：完整的离线体验，PWA安装提示，推送通知支持
- 负面：Service Worker调试较复杂，需Chrome DevTools支持
- 注意：首次访问需网络，之后离线可用

---

## ADR-005：富文本编辑器 — TipTap (ProseMirror)

**状态：** 已决定（Accepted）

**背景：**
智能笔记是课伴的核心功能之一，需要支持：Markdown快捷输入、模板渲染（康奈尔、思维导图）、富文本样式、AI摘要结果的嵌入展示、以及良好的移动端适配。

**决策：**
采用 TipTap（基于ProseMirror内核）作为富文本编辑器。

**理由：**
- **可扩展性强**：TipTap的Extension机制可轻松实现自定义模板节点（康奈尔分区、思维导图节点）
- **模板渲染支持好**：ProseMirror的Schema机制可定义结构化文档，模板本质是预定义的Schema
- **Headless设计**：TipTap只提供逻辑层，UI完全自定义，与设计规范无缝契合
- **社区活跃**：GitHub 30K+ stars，定期更新，生态插件丰富
- **协作基础**：ProseMirror的Collab模块为未来协同编辑奠定基础
- **React集成**：`@tiptap/react` 提供完善的React hooks和组件

**备选方案对比：**

| 方案 | 优势 | 放弃原因 |
|------|------|---------|
| Slate.js | React原生 | API不够稳定，文档质量参差 |
| Lexical (Meta) | 轻量 | 生态较新，模板扩展不如TipTap |
| Quill | 成熟稳定 | 定制能力弱，Headless支持差 |
| CKEditor 5 | 功能完整 | 商业授权限制，过于重型 |

**后果：**
- 正面：功能强大，扩展灵活，可满足所有笔记需求
- 负面：ProseMirror学习曲线较陡，自定义节点开发需要理解底层概念
- 包体积：TipTap核心~50KB gzipped，加上扩展约80-100KB

---

## ADR-006：数据同步 — Supabase客户端操作 + LWW冲突检测

**状态：** 已决定（Accepted） ~~（原：自定义同步引擎 LWW + 版本向量，已于v1.1升级）~~

**背景：**
课伴MVP-2阶段需要支持多设备数据同步。同步策略需要在"实现复杂度"和"可靠性"之间取得平衡。MVP阶段用户以单人单设备为主，多设备场景较少。

**决策：**
MVP-2采用Supabase客户端操作 + LWW冲突检测。本地PostgreSQL操作直接replay到云端Supabase，通过数据库级约束和RLS策略保证一致性。V2.0规划升级CRDT。

**理由：**

**Supabase客户端操作：**
- **消除ORM映射**：本地PostgreSQL操作直接映射到云端Supabase调用，无需Dexie→Supabase转换层
- **RLS策略复用**：行级安全策略在本地验证后，云端自动执行相同策略
- **实时订阅**：Supabase Realtime自动推送其他设备的变更，无需轮询
- **事务保证**：本地PostgreSQL事务确保操作原子性，replay到云端时保持一致性
- **实现简化**：相比自定义同步引擎，代码量减少约60%，团队可完全掌控

**LWW冲突检测（保留）：**
- **覆盖90%场景**：单人使用时95%以上操作无冲突，LWW自动解决
- **冲突检测可靠**：通过PostgreSQL `updated_at` 时间戳比较
- **冲突处理用户友好**：保留双方版本，UI提示用户选择，不丢数据

**为何不用CRDT（MVP阶段）：**
- Yjs/Automerge文档体积膨胀（元数据约占30%），对本地存储有压力
- CRDT学习曲线陡峭，团队需较长时间掌握
- MVP阶段多设备用户极少，CRDT的协同编辑优势无法体现

**Supabase同步流程：**
```
本地PostgreSQL写操作
    ↓
记录操作日志（本地operation_logs表）
    ↓
Supabase客户端推送操作到云端
    ↓
云端Supabase执行相同操作（受RLS约束）
    ↓
检测冲突（updated_at比较）
  - 无冲突：确认同步，更新本地synced状态
  - 有冲突：保留双方版本，通知用户
```

**后果：**
- 正面：同步架构大幅简化，本地→云端映射零损耗
- 正面：实时订阅开箱即用，无需自建WebSocket服务
- 负面：冲突时需用户手动选择，不如CRDT自动合并
- 升级路径：V2.0可引入Yjs替换核心同步引擎，操作日志格式向下兼容

> **状态更新 (v1.2, MVP-2 Alpha 实施)**：已 Superseded。
> 同步策略从 Supabase 客户端操作 Replay 改为 **HTTP Push/Pull + 操作日志**。
> - 原因：Replay 模式要求本地与云端共享 PostgreSQL schema，Dexie.js 环境下不可行
> - 实现：增强版操作日志（含 version/deviceId/patch）+ Go sync-service HTTP API
> - LWW 冲突检测在 HTTP 模式下完全可实现

---

## ADR-007：后端语言 — Go + Python

**状态：** 已决定（Accepted）

**背景：**
云端有两类截然不同的服务需求：①同步服务（高并发、低延迟、长连接）②AI服务（AI生态、模型调用、prompt工程）。单一语言难以同时满足。

**决策：**
- **同步服务 + 账户服务**：Go（Golang）
- **AI服务网关**：Python

**理由：**

**Go（同步服务）：**
- **高并发**：goroutine轻量级协程，单实例可处理万级并发连接
- **低延迟**：编译型语言，无GC停顿，P99延迟<10ms
- **WebSocket支持好**：goroutine天然适合长连接管理
- **部署简单**：静态编译二进制，Docker镜像<10MB
- **标准库强大**：net/http + database/sql 满足大部分需求

**Python（AI服务）：**
- **AI生态不可替代**：LangChain、Transformers、OpenAI SDK均为Python优先
- **FastAPI高性能**：基于asyncio，性能满足AI服务需求（AI调用本身是瓶颈，非框架）
- **prompt工程**：LangChain的prompt模板、chain、agent能力远超其他语言
- **快速迭代**：AI模型接口变化快，Python的动态特性适合快速适配

**备选方案对比：**

| 方案 | 放弃原因 |
|------|---------|
| 全Node.js | 高并发能力弱于Go，AI生态弱于Python |
| 全Go | AI生态几乎为零，LangChain没有Go版 |
| 全Python | 同步服务高并发性能不足，WebSocket管理复杂 |
| Rust (同步服务) | 学习曲线极陡，团队培养成本高 |

**后果：**
- 正面：各取所长，同步服务高性能，AI服务生态丰富
- 负面：两套技术栈，维护成本翻倍；服务间需通过HTTP/gRPC通信
- 缓解：服务边界清晰，团队可按技能分组；统一Docker部署降低运维复杂度

---

## ADR-008：主数据库 — PostgreSQL 16 (Supabase)

**状态：** 已决定（Accepted） ~~（原：独立PostgreSQL 16，已于v1.1升级为Supabase托管）~~

**背景：**
云端服务需要存储：用户账户、同步操作日志、闪卡/笔记元数据、AI调用记录等。需要强一致性、事务支持、灵活的查询能力。

**决策：**
采用 Supabase托管的 PostgreSQL 16 作为主数据库，替代独立部署的PostgreSQL。

**理由：**
- **Supabase全套能力**：内置Auth、Storage、Realtime、Edge Functions，无需自建
- **RLS行级安全**：数据访问策略直接在数据库层定义，中间件无需重复校验
- **实时订阅**：Supabase Realtime基于WAL实现，无需自建WebSocket服务
- **对象存储**：Supabase Storage替代MinIO，统一管理文件资源
- **自动备份**：Supabase内置每日备份+PITR，降低运维负担
- **本地开发一致**：Supabase CLI本地开发环境与云端完全一致
- **PostgreSQL原生能力保留**：JSONB、GIN索引、分区表等全部可用

**数据模型规划（Supabase迁移）：**
```sql
-- 用户账户（由Supabase Auth管理，auth.users表）
-- 自定义用户信息扩展
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name VARCHAR(100),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 同步操作日志
CREATE TABLE operation_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  entity_type VARCHAR(50),
  entity_id UUID,
  operation VARCHAR(20),
  version INT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- RLS策略示例
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see own logs" ON operation_logs
  FOR ALL USING (auth.uid() = user_id);
```

**后果：**
- 正面：开发效率大幅提升，Auth/Storage/Realtime开箱即用
- 正面：本地与云端统一PostgreSQL，数据栈一致性高
- 负面：Supabase供应商锁定风险（可通过标准PostgreSQL迁移缓解）
- 容量规划：Supabase Pro计划支持8GB数据库，满足初期需求

---

## ADR-009：缓存 — Redis 7

**状态：** 已决定（Accepted）

**背景：**
云端服务需要高速缓存层：用户会话（JWT Token验证）、同步状态临时存储、AI结果缓存、API调用频率限制计数器等。

**决策：**
采用 Redis 7 作为缓存层。

**理由：**
- **亚毫秒延迟**：GET/SET操作P99<0.5ms，满足实时性要求
- **丰富数据结构**：String（会话）、Hash（用户信息）、Sorted Set（排行榜）、Bitmap（活跃统计）
- **TTL自动过期**：AI缓存结果7天过期，会话Token 15分钟过期
- **Lua脚本**：频率限制逻辑可在Redis内原子执行，避免竞态
- **持久化选项**：AOF + RDB双保险，重启不丢关键缓存

**使用场景：**
```
会话缓存：    SET session:{userId} {token} EX 900
AI结果缓存：  SET ai:summarize:{hash(text)} {result} EX 604800
频率限制：    INCR ratelimit:{userId}:ai:daily EX 86400
同步状态：    HSET sync:{userId} lastVersion 42
```

**后果：**
- 正面：性能极佳，使用场景丰富，运维简单
- 负面：内存占用较高（需合理规划容量），单点故障风险（需Sentinel/Cluster）
- 容量规划：单实例4GB内存可支撑10万用户

---

## ADR-010：AI框架 — FastAPI + LangChain

**状态：** 已决定（Accepted）

**背景：**
AI服务网关需要：接收客户端AI请求、编排prompt模板、调用LLM API（OpenAI/本地模型）、缓存结果、限制调用频率。

**决策：**
采用 FastAPI 作为Web框架 + LangChain 作为AI编排层。

**理由：**

**FastAPI：**
- **高性能**：基于Starlette + asyncio，异步性能媲美Go
- **自动文档**：基于Pydantic自动生成OpenAPI文档，前后端协作效率高
- **类型安全**：Pydantic模型验证请求/响应，减少运行时错误
- **依赖注入**：FastAPI的依赖系统优雅处理认证、频率限制等横切关注点

**LangChain：**
- **Prompt编排**：Chain机制可组合多个prompt步骤（如：先提取关键概念→再生成闪卡）
- **模型抽象**：统一接口调用OpenAI/Anthropic/本地模型，切换模型零改动
- **记忆管理**：Memory机制可维护多轮对话上下文（费曼评估场景）
- **社区活跃**：快速跟进最新AI模型和工具

**架构示意：**
```
FastAPI Router
    ↓
Auth Middleware (JWT验证)
    ↓
Rate Limiter (Redis计数)
    ↓
LangChain Chain (Prompt编排)
    ↓
LLM API (OpenAI GPT-4o / 本地模型)
    ↓
Response Cache (Redis)
```

**后果：**
- 正面：开发效率高，AI能力强大，可快速接入新模型
- 负面：LangChain抽象层较重，简单场景可能过度封装
- 缓解：简单场景可直接调用OpenAI SDK，复杂场景使用LangChain

> **状态更新 (v1.2, MVP-2 Alpha 实施)**：已 Superseded。
> AI 模型从 OpenAI/本地模型改为接入**国产大模型双供应商方案**。
> - 主力：通义千问 Qwen3.5-Plus（笔记摘要、闪卡生成）
> - 辅助：DeepSeek V4/Chat（费曼评估、番茄钟推荐）
> - 备选：智谱 GLM-4-Flash（永久免费，Alpha 验证用）
> - 两者均兼容 OpenAI SDK 格式，仅需切换 base_url + api_key

---

## ADR-011：容器化与CI/CD — Docker + K8s + GitHub Actions + ArgoCD

**状态：** 已决定（Accepted）

**背景：**
云端服务（Go同步服务+Python AI服务）需要标准化的部署流程和自动化CI/CD流水线。要求支持：多环境（dev/staging/prod）、灰度发布、自动扩缩容。

**决策：**
- **容器化**：Docker
- **编排**：Kubernetes (K8s)
- **CI**：GitHub Actions
- **CD**：ArgoCD（GitOps模式）

**理由：**

**Docker：**
- 业界标准，Go/Python服务均可打包为轻量镜像
- Go服务镜像<10MB（静态二进制），Python服务镜像~200MB

**Kubernetes：**
- 自动扩缩容：HPA根据CPU/内存使用率自动调整副本数
- 滚动更新：零停机发布，自动回滚失败部署
- 服务发现：内置DNS，服务间通信无需硬编码地址

**GitHub Actions：**
- 与代码仓库深度集成，push/PR自动触发CI
- 丰富Marketplace，lint/test/build/deploy一站式配置
- 免费额度满足开源/小型项目需求

**ArgoCD：**
- GitOps模式：Git仓库是部署状态的唯一真实来源
- 可视化部署状态，一键回滚到任意历史版本
- 自动同步：Git变更自动触发部署，无需手动kubectl apply

**CI/CD流水线：**
```
开发者push代码
    ↓
GitHub Actions
  ├─ lint（代码规范检查）
  ├─ test（单元测试+集成测试）
  ├─ build（Docker镜像构建）
  └─ push镜像（推送到Container Registry）
    ↓
更新K8s Manifests（Git仓库）
    ↓
ArgoCD检测到Manifests变更
    ↓
自动部署到对应环境（dev/staging/prod）
    ↓
健康检查通过 → 完成
健康检查失败 → 自动回滚
```

**后果：**
- 正面：高度自动化，部署可靠，回滚快速
- 负面：K8s学习曲线陡峭，运维复杂度较高
- 缓解：MVP-1阶段仅部署前端PWA（CDN），无需K8s；MVP-2引入K8s时可考虑托管K8s（如阿里云ACK）降低运维负担

---

## ADR-012：通信协议 — gRPC + Protobuf（微服务间通信）

**状态：** 已决定（Accepted）

**背景：**
课伴云端包含Go同步服务、Python AI服务、Supabase Edge Functions等多个微服务。服务间通信需要高性能、强类型、跨语言的协议支持。原方案仅依赖HTTP/JSON，存在序列化开销大、接口定义松散、跨语言维护困难等问题。

**决策：**
微服务间通信采用 gRPC + Protobuf，对外API保留RESTful HTTP。

**理由：**

**gRPC：**
- **高性能**：基于HTTP/2多路复用 + Protobuf二进制序列化，比JSON快3-10倍
- **强类型契约**：.proto文件即接口定义，编译时保证跨语言一致性
- **双向流**：支持服务端推送、双向流式通信，适合AI流式响应场景
- **跨语言**：Go和Python均有成熟的gRPC实现（grpc-go / grpcio）
- **代码生成**：protoc自动生成客户端/服务端桩代码，减少手写序列化逻辑

**Protobuf：**
- **Schema定义**：.proto文件作为服务间通信的单一真实来源
- **向后兼容**：字段编号机制天然支持Schema演进，新增字段不破坏旧客户端
- **体积小**：二进制编码比JSON小3-5倍，降低网络传输成本

**架构示意：**
```
客户端（PWA/Electron）
    │
    │ RESTful HTTP（对外API）
    ↓
┌──────────────────────────────────────────┐
│         API Gateway (Nginx/Kong)          │
└──────┬───────────────┬──────────────┬────┘
       │               │              │
       │ gRPC          │ gRPC         │ gRPC
       ↓               ↓              ↓
  ┌─────────┐   ┌──────────┐   ┌──────────┐
  │  Sync   │   │   Auth   │   │    AI    │
  │ Service │←→ │ Service  │   │ Gateway  │
  │  (Go)   │   │   (Go)   │   │(Python)  │
  └─────────┘   └──────────┘   └──────────┘
```

**备选方案对比：**

| 方案 | 放弃原因 |
|------|----------|
| 纯HTTP/JSON | 序列化开销大，接口定义松散，跨语言维护困难 |
| GraphQL | 适合前端聚合查询，但服务间通信过于复杂 |
| Thrift | 社区活跃度低于gRPC，生态工具链不如Protobuf |
| MessagePack | 仅序列化方案，缺乏RPC框架和代码生成 |

**后果：**
- 正面：服务间通信性能提升3-10倍，接口强类型保证
- 正面：.proto文件作为接口文档，前后端协作效率提升
- 负面：gRPC调试不如HTTP直观（需grpcurl等工具），学习曲线略高
- 缓解：对外API保留RESTful HTTP，仅内部服务间使用gRPC

---

## 决策总览

| ADR | 类别 | 决策 | 阶段 | 版本 |
|-----|------|------|------|------|
| ADR-001 | 前端框架 | React 18 + TS + Vite | MVP-1 | v1.0 |
| ADR-002 | 状态管理 | Zustand + TanStack Query | MVP-1 | v1.0 |
| ADR-003 | 本地存储 | ~~Supabase本地客户端~~ → **Dexie.js (保留)** | MVP-1 | ~~v1.1 Supabase~~ → v1.2 Superseded |
| ADR-004 | 离线缓存 | Workbox (Service Worker) | MVP-1 | v1.0 |
| ADR-005 | 富文本 | TipTap (ProseMirror) | MVP-1 | v1.0 |
| ADR-006 | 数据同步 | ~~Supabase客户端操作~~ → **HTTP Push/Pull + 操作日志** | MVP-2 | ~~v1.1 Supabase~~ → v1.2 Superseded |
| ADR-007 | 后端语言 | Go + Python | MVP-2 | v1.0 |
| ADR-008 | 主数据库 | PostgreSQL 16 (Supabase) | MVP-2 | ~~v1.0 独立PG~~ → v1.1 Supabase |
| ADR-009 | 缓存 | Redis 7 | MVP-2 | v1.0 |
| ADR-010 | AI框架 | FastAPI + LangChain（**国产模型**） | MVP-2 | v1.0 → v1.2 Superseded |
| ADR-011 | CI/CD | Docker + K8s + GH Actions + ArgoCD | MVP-2 | v1.0 |
| ADR-012 | 通信协议 | gRPC + Protobuf | MVP-2 | v1.1 新增 |
