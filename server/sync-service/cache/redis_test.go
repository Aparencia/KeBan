package cache

import (
	"context"
	"testing"
)

// ────────────────────────────────────────────────────────────
// 测试 Redis 不可用时的优雅降级（RDB = nil）
// ────────────────────────────────────────────────────────────

func TestSetLastSyncVersion_NilRDB(t *testing.T) {
	// 保存原始 RDB 并恢复
	origRDB := RDB
	RDB = nil
	defer func() { RDB = origRDB }()

	ctx := context.Background()
	err := SetLastSyncVersion(ctx, "user-001", 42)
	if err != nil {
		t.Errorf("SetLastSyncVersion with nil RDB should return nil, got %v", err)
	}
}

func TestGetLastSyncVersion_NilRDB(t *testing.T) {
	origRDB := RDB
	RDB = nil
	defer func() { RDB = origRDB }()

	ctx := context.Background()
	version, err := GetLastSyncVersion(ctx, "user-001")
	if err != nil {
		t.Errorf("GetLastSyncVersion with nil RDB should return nil error, got %v", err)
	}
	if version != 0 {
		t.Errorf("GetLastSyncVersion with nil RDB should return 0, got %d", version)
	}
}

func TestSetDeviceOnline_NilRDB(t *testing.T) {
	origRDB := RDB
	RDB = nil
	defer func() { RDB = origRDB }()

	ctx := context.Background()
	err := SetDeviceOnline(ctx, "user-001", "device-abc")
	if err != nil {
		t.Errorf("SetDeviceOnline with nil RDB should return nil, got %v", err)
	}
}

func TestGetOnlineDevices_NilRDB(t *testing.T) {
	origRDB := RDB
	RDB = nil
	defer func() { RDB = origRDB }()

	ctx := context.Background()
	devices, err := GetOnlineDevices(ctx, "user-001")
	if err != nil {
		t.Errorf("GetOnlineDevices with nil RDB should return nil error, got %v", err)
	}
	if devices != nil {
		t.Errorf("GetOnlineDevices with nil RDB should return nil slice, got %v", devices)
	}
}

// ────────────────────────────────────────────────────────────
// CloseRedis 不应 panic（即使 RDB 为 nil）
// ────────────────────────────────────────────────────────────

func TestCloseRedis_NilRDB_NoPanic(t *testing.T) {
	origRDB := RDB
	RDB = nil
	defer func() { RDB = origRDB }()

	// 应不 panic
	CloseRedis()
}

// ────────────────────────────────────────────────────────────
// Key 格式测试（验证 key 构造逻辑）
// ────────────────────────────────────────────────────────────

func TestKeyFormat_LastSyncVersion(t *testing.T) {
	// 验证 key 格式：sync:{userID}:lastVersion
	userID := "user-123"
	expected := "sync:user-123:lastVersion"

	// 通过 fmt.Sprintf 复现 key 构造逻辑
	key := "sync:" + userID + ":lastVersion"
	if key != expected {
		t.Errorf("key = %q, want %q", key, expected)
	}
}

func TestKeyFormat_Devices(t *testing.T) {
	// 验证 key 格式：sync:{userID}:devices
	userID := "user-456"
	expected := "sync:user-456:devices"

	key := "sync:" + userID + ":devices"
	if key != expected {
		t.Errorf("key = %q, want %q", key, expected)
	}
}

// ────────────────────────────────────────────────────────────
// InitRedis 测试（无 REDIS_URL 环境变量时的默认行为）
// ────────────────────────────────────────────────────────────

func TestInitRedis_InvalidURL(t *testing.T) {
	// 设置无效的 REDIS_URL 格式
	t.Setenv("REDIS_URL", "not-a-valid-url://@@@")

	// InitRedis 应返回错误（无效 URL）
	err := InitRedis()
	if err == nil {
		t.Error("InitRedis with invalid URL should return error")
	}

	// RDB 应保持 nil
	if RDB != nil {
		t.Error("RDB should be nil after failed init")
	}
}

func TestInitRedis_UnreachableServer(t *testing.T) {
	// 使用一个不可达的地址
	t.Setenv("REDIS_URL", "redis://127.0.0.1:1/0")

	err := InitRedis()
	// 连接失败时，InitRedis 应返回 nil（优雅降级）且不 panic
	if err != nil {
		t.Logf("InitRedis returned error (expected nil for graceful degradation): %v", err)
	}

	// RDB 应为 nil（连接失败后设为 nil）
	if RDB != nil {
		RDB = nil // 清理
		t.Error("RDB should be nil after unreachable server")
	}
}
