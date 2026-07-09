//! AI Gateway — Rust 层 HTTP 客户端
//!
//! 封装 ai-gateway 服务四个端点，通过 Tauri command 暴露给前端：
//!   POST /api/v1/ai/summarize
//!   POST /api/v1/ai/generate-cards
//!   POST /api/v1/ai/evaluate-explanation
//!   POST /api/v1/ai/recommend-duration

use serde::{Deserialize, Serialize};
use tauri::State;

const DEFAULT_GATEWAY_URL: &str = "http://127.0.0.1:8000";

// ================================================================
// Summarize — POST /api/v1/ai/summarize
// ================================================================

#[derive(Serialize)]
struct SummarizeOptionsReq {
    #[serde(skip_serializing_if = "Option::is_none")]
    max_length: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    style: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
}

#[derive(Serialize)]
struct SummarizeRequest {
    text: String,
    options: SummarizeOptionsReq,
}

#[derive(Deserialize)]
struct SummarizeResponse {
    summary: String,
    model: String,
    tokens_used: u32,
    latency_ms: u32,
}

// ================================================================
// Generate Cards — POST /api/v1/ai/generate-cards
// ================================================================

#[derive(Serialize)]
struct CardGenOptionsReq {
    #[serde(skip_serializing_if = "Option::is_none")]
    max_cards: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    difficulty: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    card_type: Option<String>,
}

#[derive(Serialize)]
struct CardGenRequest {
    note: String,
    options: CardGenOptionsReq,
}

#[derive(Deserialize)]
struct FlashCardRes {
    front: String,
    back: String,
    #[serde(rename = "type")]
    card_type: String,
    confidence: f64,
}

#[derive(Deserialize)]
struct CardGenResponse {
    cards: Vec<FlashCardRes>,
    total_extracted: u32,
    model: String,
    tokens_used: u32,
}

// ================================================================
// Evaluate — POST /api/v1/ai/evaluate-explanation
// ================================================================

#[derive(Serialize)]
struct EvaluateRequest {
    concept: String,
    explanation: String,
}

#[derive(Deserialize)]
struct DimensionScoreRes {
    dimension: String,
    score: f64,
    feedback: String,
}

#[derive(Deserialize)]
struct EvaluationResponse {
    overall_score: f64,
    dimensions: Vec<DimensionScoreRes>,
    strengths: Vec<String>,
    improvements: Vec<String>,
    encouragement: String,
    model: String,
    tokens_used: u32,
    latency_ms: u32,
}

// ================================================================
// Recommend Duration — POST /api/v1/ai/recommend-duration
// ================================================================

#[derive(Serialize)]
struct FocusSessionReq {
    duration_minutes: u32,
    completed: bool,
    subject: String,
    timestamp: String,
}

/// 前端传入的 focus session（camelCase）
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionInput {
    duration_minutes: u32,
    completed: bool,
    subject: String,
    timestamp: String,
}

#[derive(Serialize)]
struct RecommendRequest {
    history: Vec<FocusSessionReq>,
}

#[derive(Deserialize)]
struct DurationConfigRes {
    recommended_minutes: u32,
    break_minutes: u32,
    reason: String,
    source: String,
    model: String,
    tokens_used: u32,
    latency_ms: u32,
}

// ================================================================
// 前端响应结构体（camelCase）
// ================================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeResult {
    summary: String,
    model: String,
    tokens_used: u32,
    latency_ms: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashcardOut {
    front: String,
    back: String,
    #[serde(rename = "type")]
    card_type: String,
    confidence: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashcardResult {
    cards: Vec<FlashcardOut>,
    total_extracted: u32,
    model: String,
    tokens_used: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DimensionOut {
    name: String,
    score: f64,
    feedback: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateResult {
    overall_score: f64,
    dimensions: Vec<DimensionOut>,
    strengths: Vec<String>,
    improvements: Vec<String>,
    encouragement: String,
    model: String,
    tokens_used: u32,
    latency_ms: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DurationResult {
    recommended_minutes: u32,
    break_minutes: u32,
    reason: String,
    source: String,
    is_local_fallback: bool,
    model: String,
    tokens_used: u32,
    latency_ms: u32,
}

// ================================================================
// 辅助函数
// ================================================================

fn gateway_url() -> String {
    std::env::var("VITE_AI_GATEWAY_URL").unwrap_or_else(|_| DEFAULT_GATEWAY_URL.to_string())
}

async fn post_json<Req: Serialize, Res: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    path: &str,
    body: &Req,
    auth_token: Option<&str>,
) -> Result<Res, String> {
    let url = format!("{}{}", gateway_url(), path);
    log::info!("POST {}", url);
    let mut req = client.post(&url).json(body);
    if let Some(token) = auth_token {
        req = req.header("Authorization", format!("Bearer {}", token));
    }
    let resp = req
        .send()
        .await
        .map_err(|e| {
            log::error!("HTTP request to {} failed: {}", url, e);
            format!("HTTP request failed: {e}")
        })?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let detail = resp
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".into());
        log::error!("HTTP {}: {}", status, detail);
        return Err(format!("HTTP {status}: {detail}"));
    }

    log::info!("POST {} -> {}", url, resp.status());
    resp.json::<Res>()
        .await
        .map_err(|e| {
            log::error!("Response parse error for {}: {}", url, e);
            format!("Response parse error: {e}")
        })
}

// ================================================================
// Tauri Commands
// ================================================================

#[tauri::command(rename_all = "camelCase")]
pub async fn ai_summarize(
    client: State<'_, reqwest::Client>,
    text: String,
    max_length: Option<u32>,
    style: Option<String>,
    language: Option<String>,
    auth_token: Option<String>,
) -> Result<SummarizeResult, String> {
    let req = SummarizeRequest {
        text,
        options: SummarizeOptionsReq {
            max_length,
            style,
            language,
        },
    };

    let resp: SummarizeResponse = post_json(&client, "/api/v1/ai/summarize", &req, auth_token.as_deref()).await?;

    Ok(SummarizeResult {
        summary: resp.summary,
        model: resp.model,
        tokens_used: resp.tokens_used,
        latency_ms: resp.latency_ms,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn ai_generate_cards(
    client: State<'_, reqwest::Client>,
    note: String,
    max_cards: Option<u32>,
    difficulty: Option<String>,
    card_type: Option<String>,
    auth_token: Option<String>,
) -> Result<FlashcardResult, String> {
    let req = CardGenRequest {
        note,
        options: CardGenOptionsReq {
            max_cards,
            difficulty,
            card_type,
        },
    };

    let resp: CardGenResponse =
        post_json(&client, "/api/v1/ai/generate-cards", &req, auth_token.as_deref()).await?;

    Ok(FlashcardResult {
        cards: resp
            .cards
            .into_iter()
            .map(|c| FlashcardOut {
                front: c.front,
                back: c.back,
                card_type: c.card_type,
                confidence: c.confidence,
            })
            .collect(),
        total_extracted: resp.total_extracted,
        model: resp.model,
        tokens_used: resp.tokens_used,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn ai_evaluate(
    client: State<'_, reqwest::Client>,
    concept: String,
    explanation: String,
    auth_token: Option<String>,
) -> Result<EvaluateResult, String> {
    let req = EvaluateRequest {
        concept,
        explanation,
    };

    let resp: EvaluationResponse =
        post_json(&client, "/api/v1/ai/evaluate-explanation", &req, auth_token.as_deref()).await?;

    Ok(EvaluateResult {
        overall_score: resp.overall_score,
        dimensions: resp
            .dimensions
            .into_iter()
            .map(|d| DimensionOut {
                name: d.dimension,
                score: d.score,
                feedback: d.feedback,
            })
            .collect(),
        strengths: resp.strengths,
        improvements: resp.improvements,
        encouragement: resp.encouragement,
        model: resp.model,
        tokens_used: resp.tokens_used,
        latency_ms: resp.latency_ms,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn ai_recommend_duration(
    client: State<'_, reqwest::Client>,
    history: Vec<FocusSessionInput>,
    auth_token: Option<String>,
) -> Result<DurationResult, String> {
    let req = RecommendRequest {
        history: history
            .into_iter()
            .map(|h| FocusSessionReq {
                duration_minutes: h.duration_minutes,
                completed: h.completed,
                subject: h.subject,
                timestamp: h.timestamp,
            })
            .collect(),
    };

    let resp: DurationConfigRes =
        post_json(&client, "/api/v1/ai/recommend-duration", &req, auth_token.as_deref()).await?;

    Ok(DurationResult {
        recommended_minutes: resp.recommended_minutes,
        break_minutes: resp.break_minutes,
        reason: resp.reason,
        source: resp.source.clone(),
        is_local_fallback: resp.source == "local_rule",
        model: resp.model,
        tokens_used: resp.tokens_used,
        latency_ms: resp.latency_ms,
    })
}
