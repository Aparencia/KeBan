# 课伴API设计规范

> 版本：v1.1 | 最后更新：2026-07-08

---

## 一、API总体规范

### 1.1 通信协议

课伴采用双协议架构：

| 协议 | 用途 | 说明 |
|------|------|------|
| **RESTful HTTP** | 客户端↔服务端（对外API） | 标准HTTP/JSON，易于集成和调试 |
| **gRPC + Protobuf** | 微服务间通信（内部API） | 高性能二进制序列化，强类型契约 |

> v1.1变更：新增gRPC作为微服务间通信协议（详见ADR-012），对外API保留RESTful HTTP。

### 1.2 版本管理

采用URL路径版本管理：

```
https://api.keban.app/api/v1/sync/push
https://api.keban.app/api/v1/ai/summarize
https://api.keban.app/api/v1/user/profile
```

版本升级策略：
- 大版本变更（破坏性）：URL路径递增（v1→v2）
- 小版本变更（新增字段）：保持原版本，响应中新增字段
- 废弃旧版本：至少保留6个月过渡期

### 1.3 统一响应格式

所有HTTP API响应使用统一JSON结构：

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1720000000000,
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | int | 业务状态码（与HTTP状态码一致） |
| `message` | string | 人类可读的状态描述 |
| `data` | object/null | 业务数据 |
| `timestamp` | int | 服务器时间戳（毫秒） |
| `requestId` | string | 请求唯一标识（用于追踪和调试） |

### 1.4 请求规范

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt_token>
X-Device-Id: <device_uuid>
X-Client-Version: <app_version>
```

---

## 二、错误码规范

### 2.1 错误响应格式

```json
{
  "code": 400,
  "message": "Invalid request parameters",
  "data": {
    "errors": [
      {
        "field": "email",
        "message": "邮箱格式不正确"
      }
    ]
  },
  "timestamp": 1720000000000,
  "requestId": "550e8400-..."
}
```

### 2.2 错误码映射表

| 错误码 | 含义 | HTTP状态码 | 说明 |
|--------|------|-----------|------|
| 200 | 成功 | 200 | 请求成功 |
| 400 | 请求参数错误 | 400 | 请求体格式错误、必填字段缺失、字段值不合法 |
| 401 | 未认证 | 401 | Token缺失、Token过期、Token无效 |
| 403 | 无权限 | 403 | 用户无权访问该资源 |
| 404 | 资源不存在 | 404 | 请求的资源不存在 |
| 409 | 冲突（同步冲突） | 409 | 数据同步时检测到冲突，需用户解决 |
| 429 | 请求频率超限 | 429 | 超过速率限制（100请求/分钟/用户） |
| 500 | 服务器内部错误 | 500 | 服务端未捕获异常 |
| 503 | AI服务不可用 | 503 | AI模型服务暂时不可用 |
| 504 | AI服务超时 | 504 | AI请求处理超时（超过30秒） |

### 2.3 错误码使用规范

- **400**：客户端错误，需客户端修改请求后重试
- **401**：需重新登录或刷新Token
- **403**：权限不足，需申请权限或更换账户
- **409**：同步冲突，需调用冲突解决API
- **429**：限流，响应头包含`Retry-After`字段
- **5xx**：服务端错误，客户端可自动重试（指数退避）

---

## 三、同步API设计（MVP-2，标注离线不可用）

### 3.1 推送本地操作日志

> **⚠️ 需在线**：离线时操作写入本地队列，网络恢复后自动推送

```
POST /api/v1/sync/push
Authorization: Bearer <token>
Content-Type: application/json

请求体：
{
  "device_id": "device-uuid-001",
  "last_sync_version": 40,
  "operations": [
    {
      "id": "log-uuid-001",
      "entity_type": "note",
      "entity_id": "note-uuid-001",
      "operation": "create",
      "data": { "title": "微积分笔记", "content": "..." },
      "timestamp": "2026-07-08T10:00:00.000Z",
      "version": 41,
      "device_id": "device-uuid-001"
    },
    {
      "id": "log-uuid-002",
      "entity_type": "flashcard",
      "entity_id": "card-uuid-010",
      "operation": "update",
      "data": { "ease_factor": 2.3, "interval_days": 7 },
      "timestamp": "2026-07-08T10:01:00.000Z",
      "version": 42,
      "device_id": "device-uuid-001"
    }
  ]
}

响应体（成功）：
{
  "code": 200,
  "message": "sync successful",
  "data": {
    "synced": 2,
    "synced_ids": ["log-uuid-001", "log-uuid-002"],
    "conflicts": [],
    "server_changes": [],
    "new_server_version": 55
  }
}

响应体（有冲突）：
{
  "code": 409,
  "message": "sync conflicts detected",
  "data": {
    "synced": 1,
    "synced_ids": ["log-uuid-001"],
    "conflicts": [
      {
        "entity_id": "note-uuid-002",
        "entity_type": "note",
        "local_version": { "title": "本地标题" },
        "remote_version": { "title": "远程标题" },
        "local_timestamp": "2026-07-08T10:00:00.000Z",
        "remote_timestamp": "2026-07-08T09:55:00.000Z",
        "remote_device_id": "device-phone-002"
      }
    ],
    "server_changes": [],
    "new_server_version": 55
  }
}
```

**离线行为：** 操作写入本地`operation_logs`表（`synced=false`），网络恢复后批量推送。

### 3.2 拉取远端变更

> **⚠️ 需在线**：离线时返回缓存数据或空列表

```
GET /api/v1/sync/pull?since=<last_sync_version>&device_id=<device_uuid>
Authorization: Bearer <token>

响应体：
{
  "code": 200,
  "message": "success",
  "data": {
    "changes": [
      {
        "entity_type": "flashcard",
        "entity_id": "card-uuid-020",
        "operation": "update",
        "data": { "ease_factor": 2.1 },
        "version": 45,
        "device_id": "device-phone-002",
        "timestamp": "2026-07-08T09:50:00.000Z"
      }
    ],
    "new_server_version": 55,
    "has_more": false
  }
}
```

**离线行为：** 返回本地缓存的上次同步数据，`data.changes`为空数组。

### 3.3 解决同步冲突

> **⚠️ 需在线**：冲突解决需要云端确认

```
POST /api/v1/sync/resolve
Authorization: Bearer <token>
Content-Type: application/json

请求体：
{
  "resolutions": [
    {
      "entity_id": "note-uuid-002",
      "entity_type": "note",
      "resolution": "local",
      "final_data": { "title": "保留的本地标题", "content": "..." }
    },
    {
      "entity_id": "note-uuid-003",
      "entity_type": "note",
      "resolution": "both",
      "local_data": { "title": "本地版本" },
      "remote_data": { "title": "远程版本" }
    }
  ]
}

resolution取值：
  "local"  - 保留本地版本
  "remote" - 保留云端版本
  "both"   - 两者都保留（生成两个副本）

响应体：
{
  "code": 200,
  "message": "conflicts resolved",
  "data": {
    "resolved_count": 2,
    "new_entities": ["note-uuid-new-001"]
  }
}
```

### 3.4 获取同步状态

> **⚠️ 需在线**：离线时返回本地记录的同步状态

```
GET /api/v1/sync/status
Authorization: Bearer <token>

响应体：
{
  "code": 200,
  "message": "success",
  "data": {
    "last_sync_at": "2026-07-08T10:05:00.000Z",
    "pending_operations": 3,
    "server_version": 55,
    "devices": [
      {
        "device_id": "device-uuid-001",
        "device_name": "我的笔记本",
        "last_sync_at": "2026-07-08T10:05:00.000Z"
      },
      {
        "device_id": "device-phone-002",
        "device_name": "我的手机",
        "last_sync_at": "2026-07-08T09:50:00.000Z"
      }
    ]
  }
}
```

---

## 四、AI增强API设计（MVP-2，标注离线不可用）

### 4.1 笔记AI摘要

> **⚠️ 需在线+AI可用**：离线时Toast提示"连接网络后可使用智能摘要功能"

```
POST /api/v1/ai/summarize
Authorization: Bearer <token>
Content-Type: application/json

请求体：
{
  "text": "笔记全文内容...",
  "options": {
    "max_length": 200,
    "style": "bullet",
    "language": "zh",
    "focus_keywords": ["微积分", "极限"]
  }
}

style取值：
  "bullet"    - 要点列表（默认）
  "paragraph" - 段落摘要
  "outline"   - 大纲结构

响应体：
{
  "code": 200,
  "message": "success",
  "data": {
    "summary": "• 要点一：...\n• 要点二：...\n• 要点三：...",
    "model": "gpt-4o-mini",
    "tokens_used": 350,
    "latency_ms": 1200
  }
}
```

**错误处理：**
- 503：AI服务不可用，客户端显示Toast提示
- 429：今日AI配额耗尽，显示升级提示
- 400：输入文本过短（<10字），提示"内容太短，无法生成有效摘要"

### 4.2 AI生成闪卡

> **⚠️ 需在线+AI可用**：离线时Toast提示"连接网络后可使用AI生成卡片"

```
POST /api/v1/ai/generate-cards
Authorization: Bearer <token>
Content-Type: application/json

请求体：
{
  "note_content": "笔记全文内容...",
  "options": {
    "max_cards": 10,
    "difficulty": "medium",
    "card_type": "mixed",
    "language": "zh"
  }
}

difficulty取值： "easy" | "medium" | "hard"
card_type取值： "definition" | "question_answer" | "fill_blank" | "mixed"

响应体：
{
  "code": 200,
  "message": "success",
  "data": {
    "cards": [
      {
        "front": "什么是牛顿第一定律？",
        "back": "一切物体在不受外力作用时，总保持匀速直线运动或静止状态...",
        "type": "question_answer",
        "confidence": 0.92,
        "source_text": "牛顿第一定律：一切物体在不受外力..."
      }
    ],
    "total_extracted": 8,
    "model": "gpt-4o",
    "tokens_used": 1200
  }
}
```

### 4.3 费曼AI评估

> **⚠️ 需在线+AI可用**：离线时提供自我评分（1-5星）替代方案

```
POST /api/v1/ai/evaluate
Authorization: Bearer <token>
Content-Type: application/json

请求体：
{
  "concept": "光电效应",
  "explanation": "光电效应就是光照到金属上会把电子打出来..."
}

响应体：
{
  "code": 200,
  "message": "success",
  "data": {
    "overall_score": 7,
    "clarity": 8,
    "completeness": 6,
    "accuracy": 7,
    "strengths": ["用简单的语言描述了基本现象", "提到了光子和电子的关系"],
    "weaknesses": ["未提及截止频率的概念", "未解释为什么经典波动理论无法解释此现象"],
    "suggestions": ["可以补充：为什么只有特定频率的光才能打出电子？"],
    "simplified_version": "光电效应是指当光照射到金属表面时...",
    "model": "gpt-4o",
    "tokens_used": 800
  }
}
```

### 4.4 番茄钟AI推荐

> **⚠️ 需在线+AI可用**：离线时自动降级到本地规则引擎（无感降级，不提示用户）

```
POST /api/v1/ai/recommend
Authorization: Bearer <token>
Content-Type: application/json

请求体：
{
  "history": [
    { "date": "2026-07-01", "focus_duration": 25, "completed": true, "time_of_day": "morning" },
    { "date": "2026-07-01", "focus_duration": 25, "completed": false, "time_of_day": "afternoon" },
    ...
  ]
}

响应体：
{
  "code": 200,
  "message": "success",
  "data": {
    "focus_minutes": 30,
    "short_break_minutes": 6,
    "long_break_minutes": 12,
    "cycles_before_long_break": 4,
    "reason": "基于你最近30次记录，平均专注28分钟，推荐30分钟专注时长",
    "confidence": 0.85
  }
}
```

**降级策略：** AI不可用时，客户端自动调用本地规则引擎推荐，无需用户感知。

---

## 五、用户账户API（MVP-2）

### 5.1 认证API

> **⚠️ 需在线**：所有认证操作需要网络连接

**注册：**
```
POST /api/v1/auth/register

请求体：
{
  "email": "user@example.com",
  "password": "strongPassword123!",
  "display_name": "张三"
}

响应体：
{
  "code": 200,
  "data": {
    "user_id": "user-uuid-001",
    "access_token": "eyJhbGciOi...",
    "refresh_token": "dGhpcyBpcyBh...",
    "expires_in": 900
  }
}
```

> v1.1说明：认证由Supabase Auth托管，实际实现使用`supabase.auth.signUp()`。

**登录：**
```
POST /api/v1/auth/login

请求体：
{
  "email": "user@example.com",
  "password": "strongPassword123!"
}

响应体（同注册格式）
```

**刷新Token：**
```
POST /api/v1/auth/refresh

请求体：
{
  "refresh_token": "dGhpcyBpcyBh..."
}

响应体：
{
  "code": 200,
  "data": {
    "access_token": "new_jwt_token...",
    "expires_in": 900
  }
}
```

### 5.2 用户信息API

**获取用户信息：**
```
GET /api/v1/user/profile
Authorization: Bearer <token>

响应体：
{
  "code": 200,
  "data": {
    "user_id": "user-uuid-001",
    "email": "user@example.com",
    "display_name": "张三",
    "avatar_url": "https://storage.keban.app/avatars/user-001.jpg",
    "preferences": {
      "theme": "auto",
      "language": "zh-CN",
      "pomodoro_focus_minutes": 25
    },
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

**更新用户信息：**
```
PUT /api/v1/user/profile
Authorization: Bearer <token>

请求体：
{
  "display_name": "李四",
  "preferences": {
    "theme": "dark",
    "pomodoro_focus_minutes": 30
  }
}

响应体：
{
  "code": 200,
  "message": "profile updated"
}
```

**注销账户：**
```
DELETE /api/v1/user/account
Authorization: Bearer <token>

请求体（二次确认）：
{
  "confirm": true,
  "password": "strongPassword123!"
}

响应体：
{
  "code": 200,
  "message": "account scheduled for deletion",
  "data": {
    "deletion_date": "2026-08-08T00:00:00.000Z",
    "grace_period_days": 30
  }
}
```

> **⚠️ 需在线**：注销操作需要云端确认，30天内可恢复。

**导出数据：**
```
POST /api/v1/user/export
Authorization: Bearer <token>

响应体：
{
  "code": 200,
  "message": "export started",
  "data": {
    "export_id": "export-uuid-001",
    "status": "processing",
    "estimated_time_seconds": 60,
    "download_url": null
  }
}
```

> **⚠️ 需在线**：导出数据为异步任务，完成后通过通知或邮件告知下载链接。

---

## 六、本地API设计（始终可用）

本地API通过Supabase本地客户端实现，始终可用，无需网络连接。

### 6.1 本地存储CRUD接口

```typescript
// 统一的本地数据访问层
interface LocalAPI {
  // 番茄钟
  pomodoro: {
    create(session: PomodoroSession): Promise<string>;
    getById(id: string): Promise<PomodoroSession | null>;
    list(filter?: PomodoroFilter): Promise<PomodoroSession[]>;
    update(id: string, data: Partial<PomodoroSession>): Promise<void>;
    delete(id: string): Promise<void>;
    getStats(dateRange: DateRange): Promise<PomodoroStats>;
  };

  // 笔记
  notes: {
    create(note: Note): Promise<string>;
    getById(id: string): Promise<Note | null>;
    list(filter?: NoteFilter): Promise<Note[]>;
    update(id: string, data: Partial<Note>): Promise<void>;
    delete(id: string): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<Note[]>;
    pin(id: string): Promise<void>;
    unpin(id: string): Promise<void>;
    archive(id: string): Promise<void>;
  };

  // 闪卡
  flashcards: {
    create(card: Flashcard): Promise<string>;
    batchCreate(cards: Flashcard[]): Promise<string[]>;
    getById(id: string): Promise<Flashcard | null>;
    listByDeck(deckId: string, filter?: CardFilter): Promise<Flashcard[]>;
    update(id: string, data: Partial<Flashcard>): Promise<void>;
    delete(id: string): Promise<void>;
    getDueCards(deckId?: string): Promise<Flashcard[]>;
    recordReview(id: string, result: ReviewResult): Promise<void>;
  };

  // 牌组
  decks: {
    create(deck: Deck): Promise<string>;
    getById(id: string): Promise<Deck | null>;
    list(filter?: DeckFilter): Promise<Deck[]>;
    update(id: string, data: Partial<Deck>): Promise<void>;
    delete(id: string): Promise<void>;  // 级联删除牌组内所有闪卡
  };

  // 费曼
  feynman: {
    create(session: FeynmanSession): Promise<string>;
    getById(id: string): Promise<FeynmanSession | null>;
    list(filter?: FeynmanFilter): Promise<FeynmanSession[]>;
    update(id: string, data: Partial<FeynmanSession>): Promise<void>;
    delete(id: string): Promise<void>;
  };

  // 文件夹
  folders: {
    create(folder: Folder): Promise<string>;
    list(parentId?: string): Promise<Folder[]>;
    update(id: string, data: Partial<Folder>): Promise<void>;
    delete(id: string): Promise<void>;
    move(id: string, newParentId: string): Promise<void>;
    reorder(ids: string[]): Promise<void>;
  };
}
```

### 6.2 本地搜索接口

```typescript
interface LocalSearchAPI {
  // 全文搜索（基于PostgreSQL pg_trgm）
  fullText(query: string, options?: {
    tables?: ('notes' | 'flashcards' | 'feynman')[];
    limit?: number;
  }): Promise<SearchResult[]>;

  // 标签搜索
  byTags(tags: string[], mode?: 'all' | 'any'): Promise<Note[]>;

  // 时间范围搜索
  byDateRange(table: string, start: Date, end: Date): Promise<any[]>;

  // 高级搜索（组合条件）
  advanced(filter: AdvancedFilter): Promise<SearchResult[]>;
}
```

### 6.3 本地导入导出接口

```typescript
interface LocalImportExportAPI {
  // 导出
  exportAll(): Promise<Blob>;                        // 完整数据导出（JSON）
  exportDeck(deckId: string): Promise<Blob>;         // 单牌组导出（Anki兼容）
  exportNote(noteId: string): Promise<string>;       // 单笔记导出（Markdown）

  // 导入
  importAll(blob: Blob, strategy: ImportStrategy): Promise<ImportResult>;
  importDeck(blob: Blob, targetDeckId?: string): Promise<ImportResult>;

  // 导入预览
  previewImport(blob: Blob): Promise<ImportPreview>;
}
```

### 6.4 本地配置接口

```typescript
interface LocalConfigAPI {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  getAll(): Record<string, any>;
  reset(): void;  // 恢复默认配置
}

// 配置项定义
interface AppConfig {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-CN' | 'en-US';
  pomodoro: {
    focus_minutes: number;
    short_break_minutes: number;
    long_break_minutes: number;
    cycles_before_long_break: number;
    auto_start_next: boolean;
    sound_enabled: boolean;
  };
  notes: {
    default_template: string;
    auto_save_interval_seconds: number;
    font_size: number;
  };
  flashcards: {
    new_cards_per_day: number;
    review_limit_per_day: number;
    show_answer_timer: boolean;
  };
  sync: {
    auto_sync: boolean;
    sync_interval_ms: number;
  };
}
```

---

## 七、通用规范

### 7.1 分页

采用 cursor-based 分页（适合实时数据流）：

```
GET /api/v1/notes?page_token=<cursor>&page_size=20

响应体：
{
  "data": {
    "items": [...],
    "next_page_token": "eyJpZCI6Im5vdGUtdXVpZC0wMjAifQ==",
    "has_more": true
  }
}
```

- `page_size`：每页数量，默认20，最大100
- `page_token`：游标，首次请求不传，后续从上次响应获取
- `next_page_token`：下一页游标，`has_more=false`时为null

### 7.2 排序

通过`sort`查询参数指定：

```
GET /api/v1/notes?sort=updated_at:desc
GET /api/v1/flashcards?sort=due_date:asc

支持字段：
  notes: created_at, updated_at, title, word_count
  flashcards: due_date, ease_factor, review_count, created_at
  pomodoro: start_time, duration
```

### 7.3 过滤

通过查询参数过滤：

```
GET /api/v1/notes?folder_id=<uuid>&is_pinned=true&tags=数学,微积分
GET /api/v1/flashcards?deck_id=<uuid>&is_suspended=false
GET /api/v1/pomodoro?start_date=2026-07-01&end_date=2026-07-08&completed=true
```

### 7.4 速率限制

| 接口类型 | 限制 | 说明 |
|---------|------|------|
| 同步API | 100请求/分钟/用户 | 防止同步风暴 |
| AI API | 50请求/天/用户（总量） | 成本控制 |
| 认证API | 5请求/分钟/IP | 防暴力破解 |
| 其他API | 200请求/分钟/用户 | 正常使用限制 |

限流响应头：
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1720000060
Retry-After: 30
```

### 7.5 认证

- **方式：** JWT Bearer Token
- **获取：** 登录/注册API返回`access_token`
- **有效期：** 15分钟（access_token），30天（refresh_token）
- **刷新：** Token过期前自动刷新，刷新失败需重新登录
- **传递：** 每个需要认证的请求携带`Authorization: Bearer <token>`

```typescript
// Token自动刷新逻辑
async function requestWithAuth(url: string, options: RequestInit) {
  let token = await getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Token过期，尝试刷新
    token = await refreshAccessToken();
    if (token) {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    }
    // 刷新失败，跳转登录
    redirectToLogin();
  }

  return response;
}
```

### 7.6 gRPC服务间通信规范

> v1.1新增：微服务间使用gRPC + Protobuf通信

```protobuf
// 通用gRPC服务定义
syntax = "proto3";
package keban.common.v1;

// 统一响应包装
message APIResponse {
  int32 code = 1;
  string message = 2;
  int64 timestamp = 3;
  string request_id = 4;
}

// 健康检查
service HealthService {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
}

message HealthCheckRequest {
  string service_name = 1;
}

message HealthCheckResponse {
  enum Status {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
  }
  Status status = 1;
}
```

gRPC通信规范：
- 超时：所有gRPC调用默认10秒超时
- 重试：瞬态错误自动重试3次（指数退避）
- 负载均衡：客户端侧轮询（多副本时）
- 监控：所有gRPC调用记录到Prometheus

---

## 八、API文档管理

### 8.1 文档工具

使用 **Apifox** 维护API文档，自动生成 OpenAPI 3.0 规范：

- **开发阶段**：Apifox Mock Server提供模拟数据，前后端并行开发
- **联调阶段**：Apifox自动生成TypeScript类型和请求函数
- **测试阶段**：Apifox自动化测试覆盖所有接口
- **发布阶段**：导出OpenAPI 3.0 JSON，部署到API文档站

### 8.2 OpenAPI 3.0 生成

```yaml
# openapi.yaml（自动生成）
openapi: 3.0.3
info:
  title: 课伴 API
  version: 1.1.0
  description: 课伴学习工具后端API文档

servers:
  - url: https://api.keban.app/api/v1
    description: 生产环境
  - url: https://staging-api.keban.app/api/v1
    description: 预发布环境
  - url: http://localhost:8000/api/v1
    description: 本地开发

paths:
  /sync/push:
    post:
      summary: 推送本地操作日志
      tags: [同步]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SyncPushRequest'
      responses:
        '200':
          description: 同步成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SyncPushResponse'
        '409':
          description: 同步冲突
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SyncConflictResponse'
```

### 8.3 API变更管理

| 变更类型 | 处理方式 | 版本影响 |
|---------|---------|---------|
| 新增可选字段 | 直接添加，旧客户端忽略 | 无影响 |
| 新增必填字段 | 新API版本 | 大版本变更 |
| 删除字段 | 标记废弃→6个月后删除 | 大版本变更 |
| 修改字段类型 | 新API版本 | 大版本变更 |
| 新增API端点 | 直接添加 | 无影响 |
| 删除API端点 | 标记废弃→6个月后删除 | 大版本变更 |

---

## 附录：API设计检查清单

### 上线前检查项

- [ ] 所有API响应使用统一JSON格式（code/message/data/timestamp/requestId）
- [ ] 错误码与HTTP状态码一致
- [ ] 认证接口使用JWT Bearer Token
- [ ] 速率限制已配置并测试
- [ ] 分页使用cursor-based方案
- [ ] 所有需在线API标注离线行为
- [ ] AI API有完整的降级策略
- [ ] gRPC .proto文件已提交并生成桩代码
- [ ] Apifox文档与实际API一致
- [ ] OpenAPI 3.0规范已导出并可访问
