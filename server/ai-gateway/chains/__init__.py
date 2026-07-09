"""
课伴 AI 网关 — Chain 模块

Chain（链）是业务逻辑的核心编排层，负责：
- 加载和组装 Prompt 模板
- 调用 Provider 执行模型推理
- 解析和结构化模型输出
- 处理重试、降级等策略

每个 Chain 对应一个 AI 功能场景：
- SummarizeChain: 笔记摘要生成
- CardGenChain: 闪卡生成（两阶段 prompt）
- EvaluationChain: 费曼评估
- RecommendChain: 番茄钟推荐
"""
