尽管你已经做了全面的排查，确认后端服务、API Key、网络和前端调用链路本身没有阻断性问题，但桌面端仍失败，问题很可能出在 **Tauri IPC 参数传递、Rust 侧的 HTTP 请求细节、运行环境限制** 这几个容易被忽略的环节。以下是一些常见但隐蔽的原因，按可能性从高到低排列：

---

### 1. `authToken` 为 `null` 导致 Rust 命令参数反序列化失败
- **现象**：你提到占位符凭证时 `authToken` 为 `null`。前端通过 `invoke("ai_summarize", { authToken: null })` 传递时，如果 Rust 侧的函数签名把 `auth_token` 定义为 `String` 而非 `Option<String>`，Tauri IPC 会直接抛出 **“invalid type: null, expected a string”** 的错误，后续 HTTP 请求根本不会发出。
- **验证方法**：
  - 打开桌面端开发者工具（或收集 Rust 日志），查看 `invoke` 返回的错误信息。
  - 检查 Rust 命令定义，类似：
    ```rust
    #[tauri::command]
    async fn ai_summarize(text: String, max_length: u32, style: String, language: String, auth_token: String) -> ... 
    ```
    若 `auth_token` 没有用 `Option<String>`，就会失败。
- **修复**：将 `auth_token` 改为 `Option<String>`，并在 Rust 中仅在 `Some(token)` 且非空时添加 Authorization 头。

### 2. Rust 侧发送了 `Authorization: Bearer null` 字面字符串
- **现象**：即使参数传递成功，如果 Rust 代码将 `Option::None` 或空字符串直接拼成 `Bearer null` 发送给网关，而你的 JWT 中间件虽然可以在密钥为空时降级放行，但 **此时密钥存在，JWT 解析 "null" 会失败，返回 401**。桌面端将 401 映射为通用“失败”。
- **验证方法**：
  - 检查 Rust HTTP 请求构造，是否在 `auth_token` 为空时仍设置了 Authorization 头。
  - 抓取 `127.0.0.1:8000` 的网络包，或查看 ai-gateway 的访问日志，看请求是否收到、返回什么状态码。
- **修复**：仅在 `auth_token` 非空时才插入 Authorization 头；如果为空就不发该头，让网关降级放行。

### 3. 环境代理干扰本地回环请求
- **现象**：Rust 的 `reqwest` 默认会读取系统代理环境变量（`HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`）。如果系统设置了代理但未正确排除 `127.0.0.1`，`reqwest` 会尝试通过代理连接本地 8000 端口，导致连接失败或超时。
- **验证方法**：
  - 在 Rust 代码中打印实际请求的目标地址和代理设置，或临时禁用代理：使用 `reqwest::Client::builder().no_proxy()` 构建客户端。
  - 检查操作系统环境变量是否有 `HTTP_PROXY`。
- **修复**：在构建 `reqwest::Client` 时调用 `.no_proxy()` 或显式设置 `NO_PROXY` 包含 `127.0.0.1`。

### 4. macOS / Windows 安全策略阻止桌面应用访问本地网络
- **macOS**：如果你启用了 App Sandbox（例如为 Mac App Store 打包），必须添加 `com.apple.security.network.client` 权限，且沙盒默认可能阻止本地回环连接，需要额外开启 `com.apple.security.network.client` 并配置 `NSLocalNetworkUsageDescription`。
- **Windows**：防火墙或 Defender 可能拦截应用第一次的出站请求，没有弹出授权提示或用户点了“取消”；某些安全软件会阻止未知程序监听/连接本地端口。
- **验证方法**：
  - 临时关闭防火墙 / 安全软件测试。
  - 在 macOS 的 `entitlements.plist` 中检查网络权限；Windows 下检查防火墙“允许应用通过”列表。
- **修复**：确保打包配置中包含必要的网络权限，并在首次请求前向用户解释原因。

### 5. Rust `reqwest` 被 Tauri 异步运行时阻塞或超时配置过短
- **现象**：Tauri 命令默认在异步运行时中执行，但如果 `reqwest` 的请求用了阻塞模式（`.send()` 而非 `.await`），可能卡死工作线程；或者默认超时太短，而 GLM 的响应需要 4-5 秒，导致超时。
- **验证方法**：
  - 确认 Rust 代码使用异步 `reqwest::Client`（`.send().await`）。
  - 检查是否显式设置了超时（`timeout(Duration::from_secs(30))`），部分系统默认超时可能过短。
- **修复**：使用异步请求，并至少设置 15-30 秒超时。

### 6. 响应体 JSON 反序列化失败
- **现象**：ai-gateway 成功返回 200，但 Rust 解析响应时字段名或类型不匹配（例如期望 `{ "summary": "..." }` 实际返回 `{ "data": { "summary": "..." } }`），反序列化错误被映射为通用失败。
- **验证方法**：
  - 在 Rust 代码中打印原始响应体字符串，对照网关的实际返回结构。
- **修复**：调整 Rust 的数据结构或网关的响应格式保持一致。

### 7. 桌面端未启动或无法访问 ai-gateway 服务
- **现象**：桌面应用依赖外部 Python 进程/Docker，如果启动应用时该服务未运行（例如你仅在开发时手动启动了它），调用自然失败。
- **验证方法**：确认每次打开桌面应用时，`127.0.0.1:8000` 确实在监听。可以将网关作为 Tauri 侧车进程（sidecar）自动管理。

---

**建议的下一步排查优先级**：
1. 在 Tauri 应用内捕获 `invoke` 的异常日志（前端 `try/catch` 打印 `error` 对象），或在 Rust `ai_gateway.rs` 命令开头添加 `println!` 并重定向日志到文件，确认**命令是否被调用**、**参数是否解析成功**。
2. 若参数解析通过，在 Rust 发送 HTTP 请求前后打印日志，包括请求 URL、请求头、响应状态码、响应体。
3. 检查系统代理环境变量（Rust 侧打印 `std::env::var("HTTP_PROXY")`）。
4. 检查防火墙/沙盒限制（简单方法：在同一设备上用 curl 从命令行能通，而应用不通时多为权限/代理问题）。

这些点通常能解释“后端单独测试成功，集成到桌面端却失败”的现象。需要我帮你进一步分析某一段的具体代码吗？