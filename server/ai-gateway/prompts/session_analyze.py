"""
课伴 AI 网关 — 课堂多模态分析 Prompt 模板

@ai-context Path B 多模态分析链路：客户端捕获关键帧 + 语音转写 →
服务端多模态模型联合分析 → 生成结构化 Markdown 笔记。

Prompt 设计要求模型：
1. 按时间顺序组织内容
2. 提取板书/PPT 上的公式、定义（LaTeX 格式）
3. 结合语音转写补充重点
4. 输出 Markdown 结构化笔记
5. 末尾生成 3-5 个核心知识点摘要
"""

# 系统角色提示词：设定模型为课堂笔记助手
SESSION_ANALYZE_SYSTEM_PROMPT = (
    "你是一个专业的课堂笔记助手，擅长从课堂截屏和语音信息中提取结构化学习笔记。\n"
    "你的输出必须使用 Markdown 格式，语言清晰、逻辑严密。\n"
    "对于数学公式，使用 LaTeX 格式（行内用 $...$，独立公式用 $$...$$）。\n"
    "对于代码，保留语言标注的代码块。\n"
    "始终以中文输出，除非用户明确要求其他语言。"
)

# 用户消息模板：{keyframes_desc} {audio_context} {duration_desc} 由运行时填充
SESSION_ANALYZE_USER_TEMPLATE = (
    "以下是一门课程的 {keyframes_count} 张关键帧截图，"
    "课程总时长约 {duration_desc}。\n\n"
    "{keyframes_desc}\n\n"
    "{audio_context}"
    "请根据以上截屏内容和语音信息，生成一份结构化的课堂笔记，要求：\n\n"
    "1. **按时间顺序**组织内容，标注每个知识点大致出现的时间段\n"
    "2. **提取板书/PPT** 上的所有公式（LaTeX 格式）、定义、关键术语\n"
    "3. **结合语音内容**补充截屏中未完整展示的推导过程和重点解释\n"
    "4. 使用 Markdown 二级标题（##）分隔不同知识模块\n"
    "5. 在笔记末尾添加 **「核心知识点摘要」** 部分，列出 3-5 个最重要的知识点\n\n"
    "请直接输出 Markdown 笔记内容，不要添加额外说明。"
)


def build_session_prompt(
    keyframes_count: int,
    audio_segments_count: int,
    duration_seconds: int,
    language: str = "zh-CN",
) -> str:
    """
    组装完整的多模态分析用户提示词

    @ai-context 关键帧数量和语音时长直接影响 Prompt 复杂度，
    此处仅生成文本框架，图片由 Chain 层通过多图消息格式附加。

    Args:
        keyframes_count:    关键帧数量
        audio_segments_count: 语音片段数量（用于描述补充信息量）
        duration_seconds:   课程总时长（秒）
        language:           输出语言（zh-CN / en-US）

    Returns:
        填充后的用户提示词字符串
    """
    # 时长格式化：秒 → "X 分 Y 秒" 或 "X 小时 Y 分"
    if duration_seconds >= 3600:
        hours = duration_seconds // 3600
        mins = (duration_seconds % 3600) // 60
        duration_desc = f"{hours} 小时 {mins} 分钟"
    elif duration_seconds >= 60:
        mins = duration_seconds // 60
        secs = duration_seconds % 60
        duration_desc = f"{mins} 分钟 {secs} 秒" if secs else f"{mins} 分钟"
    else:
        duration_desc = f"{duration_seconds} 秒"

    # 语音上下文：有转写内容时提示模型结合语音，无则说明仅有截屏
    if audio_segments_count > 0:
        audio_context = (
            f"同时提供了 {audio_segments_count} 段语音转写文字作为补充信息，"
            "请在笔记中融合语音内容所强调的重点。\n\n"
        )
    else:
        audio_context = "本次分析仅有截屏内容，无语音转写补充。\n\n"

    return SESSION_ANALYZE_USER_TEMPLATE.format(
        keyframes_count=keyframes_count,
        duration_desc=duration_desc,
        keyframes_desc=f"截屏按时间顺序排列，共 {keyframes_count} 帧，每帧标注了出现时间",
        audio_context=audio_context,
    )
