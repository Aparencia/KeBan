package models

import (
	"reflect"
	"strings"
	"testing"
)

// ────────────────────────────────────────────────────────────
// EntityVersion 模型测试
// ────────────────────────────────────────────────────────────

func TestEntityVersionFields(t *testing.T) {
	ev := EntityVersion{
		UserID:     "user-001",
		EntityType: "note",
		EntityID:   "note-001",
		Version:    5,
		Data:       `{"title":"test"}`,
	}

	if ev.UserID != "user-001" {
		t.Errorf("UserID = %q, want %q", ev.UserID, "user-001")
	}
	if ev.EntityType != "note" {
		t.Errorf("EntityType = %q, want %q", ev.EntityType, "note")
	}
	if ev.EntityID != "note-001" {
		t.Errorf("EntityID = %q, want %q", ev.EntityID, "note-001")
	}
	if ev.Version != 5 {
		t.Errorf("Version = %d, want 5", ev.Version)
	}
	if ev.Data != `{"title":"test"}` {
		t.Errorf("Data mismatch")
	}
}

func TestEntityVersionCompositeUniqueIndex(t *testing.T) {
	rt := reflect.TypeOf(EntityVersion{})

	// UserID, EntityType 和 EntityID 都应有 uniqueIndex:idx_user_entity
	for _, fieldName := range []string{"UserID", "EntityType", "EntityID"} {
		field, ok := rt.FieldByName(fieldName)
		if !ok {
			t.Fatalf("field %s not found", fieldName)
		}
		tag := field.Tag.Get("gorm")
		if !strings.Contains(tag, "uniqueIndex:idx_user_entity") {
			t.Errorf("%s gorm tag %q missing uniqueIndex:idx_user_entity", fieldName, tag)
		}
		if !strings.Contains(tag, "not null") {
			t.Errorf("%s gorm tag %q missing not null", fieldName, tag)
		}
	}
}

func TestEntityVersionJSONTags(t *testing.T) {
	rt := reflect.TypeOf(EntityVersion{})

	expected := map[string]string{
		"UserID":     "userId",
		"EntityType": "entityType",
		"EntityID":   "entityId",
		"Version":    "version",
		"Data":       "data",
	}

	for goName, wantJSON := range expected {
		field, ok := rt.FieldByName(goName)
		if !ok {
			t.Fatalf("field %s not found", goName)
		}
		tag := field.Tag.Get("json")
		if tag != wantJSON {
			t.Errorf("%s json tag = %q, want %q", goName, tag, wantJSON)
		}
	}
}

// ────────────────────────────────────────────────────────────
// Operation 模型测试
// ────────────────────────────────────────────────────────────

func TestOperationFields(t *testing.T) {
	op := Operation{
		ID:          1,
		ServerSeqNo: 42,
		DeviceID:    "device-abc",
		UserID:      "user-001",
		EntityType:  "note",
		EntityID:    "note-002",
		Operation:   "create",
		Version:     1,
		Patch:       "",
		Payload:     `{"content":"hello"}`,
		CreatedAt:   "2025-01-01T00:00:00Z",
	}

	if op.ServerSeqNo != 42 {
		t.Errorf("ServerSeqNo = %d, want 42", op.ServerSeqNo)
	}
	if op.DeviceID != "device-abc" {
		t.Errorf("DeviceID = %q, want %q", op.DeviceID, "device-abc")
	}
	if op.UserID != "user-001" {
		t.Errorf("UserID = %q, want %q", op.UserID, "user-001")
	}
	if op.Operation != "create" {
		t.Errorf("Operation = %q, want %q", op.Operation, "create")
	}
}

func TestOperationGormTags(t *testing.T) {
	rt := reflect.TypeOf(Operation{})

	tests := []struct {
		field    string
		contains string
	}{
		{"ID", "primaryKey"},
		{"ServerSeqNo", "uniqueIndex"},
		{"ServerSeqNo", "not null"},
		{"DeviceID", "index"},
		{"DeviceID", "not null"},
		{"UserID", "index:idx_op_user"},
		{"UserID", "not null"},
		{"EntityType", "index"},
		{"EntityType", "not null"},
		{"EntityID", "not null"},
		{"Operation", "not null"},
		{"Version", "not null"},
		{"Payload", "type:text"},
		{"CreatedAt", "not null"},
	}

	for _, tc := range tests {
		field, ok := rt.FieldByName(tc.field)
		if !ok {
			t.Fatalf("field %s not found", tc.field)
		}
		tag := field.Tag.Get("gorm")
		if !strings.Contains(tag, tc.contains) {
			t.Errorf("field %s: gorm tag %q does not contain %q", tc.field, tag, tc.contains)
		}
	}
}

func TestOperationJSONTags(t *testing.T) {
	rt := reflect.TypeOf(Operation{})

	expected := map[string]string{
		"ServerSeqNo": "serverSeqNo",
		"DeviceID":    "deviceId",
		"UserID":      "userId",
		"EntityType":  "entityType",
		"EntityID":    "entityId",
		"Operation":   "operation",
		"Version":     "version",
		"Patch":       "patch",
		"Payload":     "payload",
		"CreatedAt":   "createdAt",
	}

	for goName, wantJSON := range expected {
		field, ok := rt.FieldByName(goName)
		if !ok {
			t.Fatalf("field %s not found", goName)
		}
		tag := field.Tag.Get("json")
		if tag != wantJSON {
			t.Errorf("%s json tag = %q, want %q", goName, tag, wantJSON)
		}
	}
}

// ────────────────────────────────────────────────────────────
// GlobalSeqNo 模型测试
// ────────────────────────────────────────────────────────────

func TestGlobalSeqNoFields(t *testing.T) {
	g := GlobalSeqNo{
		ID:    1,
		SeqNo: 100,
	}

	if g.ID != 1 {
		t.Errorf("ID = %d, want 1", g.ID)
	}
	if g.SeqNo != 100 {
		t.Errorf("SeqNo = %d, want 100", g.SeqNo)
	}
}

func TestGlobalSeqNoGormTags(t *testing.T) {
	rt := reflect.TypeOf(GlobalSeqNo{})

	// ID 应是 primaryKey
	idField, _ := rt.FieldByName("ID")
	if !strings.Contains(idField.Tag.Get("gorm"), "primaryKey") {
		t.Errorf("ID gorm tag missing primaryKey")
	}

	// SeqNo 应有 not null 和 default:0
	seqNoField, _ := rt.FieldByName("SeqNo")
	tag := seqNoField.Tag.Get("gorm")
	if !strings.Contains(tag, "not null") {
		t.Errorf("SeqNo gorm tag missing not null: %q", tag)
	}
	if !strings.Contains(tag, "default:0") {
		t.Errorf("SeqNo gorm tag missing default:0: %q", tag)
	}
}

func TestGlobalSeqNoIncrement(t *testing.T) {
	// 模拟原子递增逻辑（与 nextSeqNo 一致）
	g := GlobalSeqNo{ID: 1, SeqNo: 0}

	for i := int64(1); i <= 10; i++ {
		g.SeqNo++
		if g.SeqNo != i {
			t.Errorf("after increment %d: SeqNo = %d, want %d", i, g.SeqNo, i)
		}
	}
}

// ────────────────────────────────────────────────────────────
// EntityVersion 无 gorm.Model 的 ID 冲突测试
// ────────────────────────────────────────────────────────────

func TestEntityVersionHasGormModel(t *testing.T) {
	rt := reflect.TypeOf(EntityVersion{})

	// EntityVersion 嵌入了 gorm.Model，应包含 ID, CreatedAt, UpdatedAt, DeletedAt
	for _, name := range []string{"ID", "CreatedAt", "UpdatedAt", "DeletedAt"} {
		_, ok := rt.FieldByName(name)
		if !ok {
			t.Errorf("EntityVersion missing gorm.Model field: %s", name)
		}
	}
}

func TestOperationDoesNotEmbedGormModel(t *testing.T) {
	rt := reflect.TypeOf(Operation{})

	// Operation 不应嵌入 gorm.Model（自己管理 CreatedAt）
	_, hasCreatedAt := rt.FieldByName("UpdatedAt")
	if hasCreatedAt {
		t.Error("Operation should not have UpdatedAt (does not embed gorm.Model)")
	}
}
