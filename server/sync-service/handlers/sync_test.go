package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ────────────────────────────────────────────────────────────
// toJSON / fromJSON 辅助函数
// ────────────────────────────────────────────────────────────

func TestToJSON_NilReturnsEmpty(t *testing.T) {
	result := toJSON(nil)
	if result != "" {
		t.Errorf("toJSON(nil) = %q, want empty string", result)
	}
}

func TestToJSON_ValidStruct(t *testing.T) {
	data := map[string]string{"key": "value"}
	result := toJSON(data)
	if result == "" {
		t.Fatal("toJSON returned empty for valid struct")
	}
	// 验证结果是合法 JSON
	var parsed map[string]string
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Errorf("toJSON output is not valid JSON: %v", err)
	}
	if parsed["key"] != "value" {
		t.Errorf("parsed JSON key = %q, want %q", parsed["key"], "value")
	}
}

func TestToJSON_NestedStruct(t *testing.T) {
	data := map[string]interface{}{
		"name": "test",
		"tags": []string{"a", "b"},
	}
	result := toJSON(data)
	if result == "" {
		t.Fatal("toJSON returned empty for nested struct")
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(result), &parsed); err != nil {
		t.Errorf("toJSON output is not valid JSON: %v", err)
	}
}

func TestFromJSON_EmptyStringReturnsNil(t *testing.T) {
	result := fromJSON("")
	if result != nil {
		t.Errorf("fromJSON(\"\") = %v, want nil", result)
	}
}

func TestFromJSON_ValidJSON(t *testing.T) {
	result := fromJSON(`{"key":"value"}`)
	if result == nil {
		t.Fatal("fromJSON returned nil for valid JSON")
	}
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("fromJSON returned %T, want map[string]interface{}", result)
	}
	if m["key"] != "value" {
		t.Errorf("parsed key = %v, want %q", m["key"], "value")
	}
}

func TestFromJSON_InvalidJSONReturnsString(t *testing.T) {
	result := fromJSON("not-json-{broken")
	if result == nil {
		t.Fatal("fromJSON returned nil for invalid JSON")
	}
	s, ok := result.(string)
	if !ok {
		t.Fatalf("fromJSON for invalid JSON returned %T, want string", result)
	}
	if s != "not-json-{broken" {
		t.Errorf("fromJSON fallback string = %q", s)
	}
}

func TestToJSON_FromJSON_Roundtrip(t *testing.T) {
	original := map[string]interface{}{
		"title":   "学习笔记",
		"version": float64(3),
	}
	jsonStr := toJSON(original)
	restored := fromJSON(jsonStr)

	m, ok := restored.(map[string]interface{})
	if !ok {
		t.Fatalf("roundtrip: restored type = %T", restored)
	}
	if m["title"] != "学习笔记" {
		t.Errorf("roundtrip title = %v", m["title"])
	}
}

// ────────────────────────────────────────────────────────────
// ConflictInfo 序列化
// ────────────────────────────────────────────────────────────

func TestConflictInfoJSON(t *testing.T) {
	ci := ConflictInfo{
		EntityType:    "note",
		EntityID:      "note-001",
		ServerVersion: 10,
		ServerData:    map[string]string{"title": "hello"},
	}

	b, err := json.Marshal(ci)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if parsed["entityType"] != "note" {
		t.Errorf("entityType = %v", parsed["entityType"])
	}
	if parsed["entityId"] != "note-001" {
		t.Errorf("entityId = %v", parsed["entityId"])
	}
	if parsed["serverVersion"] != float64(10) {
		t.Errorf("serverVersion = %v", parsed["serverVersion"])
	}
}

// ────────────────────────────────────────────────────────────
// Push handler — 请求验证（无 DB 依赖）
// ────────────────────────────────────────────────────────────

func TestPush_InvalidJSON(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/sync/push",
		bytes.NewBufferString("{invalid json}"))
	c.Request.Header.Set("Content-Type", "application/json")

	Push(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestPush_EmptyBody(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/sync/push",
		bytes.NewBufferString(""))
	c.Request.Header.Set("Content-Type", "application/json")

	Push(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ────────────────────────────────────────────────────────────
// Pull handler — 请求验证（无 DB 依赖）
// ────────────────────────────────────────────────────────────

func TestPull_InvalidSinceVersion(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/sync/pull?sinceVersion=abc&deviceId=d1", nil)
	c.Params = nil
	// 手动设置 query 参数
	c.Request.URL.RawQuery = "sinceVersion=abc&deviceId=d1"

	Pull(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ────────────────────────────────────────────────────────────
// Resolve handler — 请求验证（无 DB 依赖）
// ────────────────────────────────────────────────────────────

func TestResolve_InvalidJSON(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/sync/resolve",
		bytes.NewBufferString("{invalid"))
	c.Request.Header.Set("Content-Type", "application/json")

	Resolve(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestResolve_UnknownStrategy(t *testing.T) {
	// 如果 models.DB 未初始化，handler 中 remote 策略不会访问 DB，
	// 但 unknown strategy 会在 switch default 中被捕获
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	body := `{"entityType":"note","entityId":"n1","strategy":"unknown","version":1,"deviceId":"d1"}`
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/sync/resolve",
		bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	Resolve(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response not JSON: %v", err)
	}
	errMsg, ok := resp["error"].(string)
	if !ok {
		t.Fatalf("error field not string")
	}
	if errMsg == "" {
		t.Error("error message should not be empty")
	}
}

func TestResolve_RemoteStrategy(t *testing.T) {
	// "remote" 策略不需要 DB 操作（server wins, 无变更）
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	body := `{"entityType":"note","entityId":"n1","strategy":"remote","version":5,"deviceId":"d1"}`
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/sync/resolve",
		bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	Resolve(c)

	// remote 策略直接返回成功，不访问 DB
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body = %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response not JSON: %v", err)
	}
	if resp["resolved"] != true {
		t.Errorf("resolved = %v, want true", resp["resolved"])
	}
	if resp["strategy"] != "remote" {
		t.Errorf("strategy = %v, want remote", resp["strategy"])
	}
}

// ────────────────────────────────────────────────────────────
// pushRequest 结构解析
// ────────────────────────────────────────────────────────────

func TestPushRequestParsing(t *testing.T) {
	body := `{
		"deviceId": "device-001",
		"operations": [
			{
				"id": "op-1",
				"entityType": "note",
				"entityId": "note-abc",
				"operation": "create",
				"version": 1,
				"payload": {"title": "hello"},
				"createdAt": "2025-01-01T00:00:00Z"
			}
		]
	}`

	var req pushRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if req.DeviceID != "device-001" {
		t.Errorf("DeviceID = %q", req.DeviceID)
	}
	if len(req.Operations) != 1 {
		t.Fatalf("operations count = %d", len(req.Operations))
	}

	op := req.Operations[0]
	if op.ID != "op-1" {
		t.Errorf("op.ID = %q", op.ID)
	}
	if op.EntityType != "note" {
		t.Errorf("op.EntityType = %q", op.EntityType)
	}
	if op.Operation != "create" {
		t.Errorf("op.Operation = %q", op.Operation)
	}
	if op.Version != 1 {
		t.Errorf("op.Version = %d", op.Version)
	}
}

// ────────────────────────────────────────────────────────────
// resolveRequest 结构解析
// ────────────────────────────────────────────────────────────

func TestResolveRequestParsing(t *testing.T) {
	body := `{
		"entityType": "flashcard",
		"entityId": "card-001",
		"strategy": "local",
		"data": {"front": "Q", "back": "A"},
		"version": 3,
		"deviceId": "device-002"
	}`

	var req resolveRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if req.EntityType != "flashcard" {
		t.Errorf("EntityType = %q", req.EntityType)
	}
	if req.Strategy != "local" {
		t.Errorf("Strategy = %q", req.Strategy)
	}
	if req.Version != 3 {
		t.Errorf("Version = %d", req.Version)
	}
	if req.Data == nil {
		t.Error("Data should not be nil")
	}
}
