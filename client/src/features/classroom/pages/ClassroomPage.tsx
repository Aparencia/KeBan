/**
 * ClassroomPage — 课堂助手（回声定位）独立全页模块
 * 左侧窄栏：窗口选择 + 路径/模式 + 控制 + 设置
 * 右侧宽区：提取结果 / 智能时间轴 / 录制面板 / 分析预览
 */
import { useRef, useEffect } from 'react';
import {
  Monitor, Play, Pause, Square, Eye, Mic, Layers,
  Settings2, ChevronDown, ChevronRight, Plus, ListPlus,
  Clock, CheckCircle2, XCircle, Loader2, Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClassroomCapture } from '../hooks/useClassroomCapture';
import { SmartCapturePanel } from '@/features/notes/components/SmartCapturePanel';
import { AnalysisPreview } from '@/features/notes/components/AnalysisPreview';
import { VideoRecordPanel } from '@/features/notes/components/VideoRecordPanel';
import type { WindowInfo, ExtractedSegment, CaptureMode, SessionStatus, CaptureSidebarConfig } from '@/lib/capture';
import type { CapturePath } from '@/lib/capture';

// ================================================================
// 子组件
// ================================================================

const MODE_OPTIONS: { value: CaptureMode; label: string; icon: typeof Eye }[] = [
  { value: 'vision', label: '视觉', icon: Eye },
  { value: 'audio', label: '音频', icon: Mic },
  { value: 'mixed', label: '混合', icon: Layers },
];

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; icon: typeof Play }> = {
  idle: { label: '空闲', color: 'text-text-tertiary', icon: Clock },
  capturing: { label: '采集中', color: 'text-semantic-error', icon: Loader2 },
  processing: { label: '处理中', color: 'text-brand-600', icon: Loader2 },
  paused: { label: '已暂停', color: 'text-semantic-warning', icon: Pause },
  error: { label: '错误', color: 'text-semantic-error', icon: XCircle },
};

const LANGUAGE_OPTIONS: { value: CaptureSidebarConfig['language']; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'mixed', label: '混合' },
];

function WindowSelector({ windows, selected, onSelect, onRefresh, loading }: {
  windows: WindowInfo[]; selected: WindowInfo | null;
  onSelect: (w: WindowInfo) => void; onRefresh: () => void; loading: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-b3 font-medium text-text-tertiary">目标窗口</span>
        <button onClick={onRefresh} disabled={loading}
          className="text-b3 text-brand-600 hover:text-brand-700 disabled:opacity-50">
          {loading ? '加载中...' : '↻ 刷新'}
        </button>
      </div>
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
        {windows.length === 0 && !loading && (
          <p className="text-b3 text-text-tertiary py-2 text-center">未检测到可捕获窗口</p>
        )}
        {windows.map((win) => (
          <button key={win.id} onClick={() => onSelect(win)}
            className={cn(
              'flex items-center gap-2 p-2 rounded-kb-sm text-left transition-colors',
              selected?.id === win.id
                ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                : 'hover:bg-bg-tertiary text-text-secondary hover:text-text-primary',
            )}>
            {win.thumbnail && (
              <img src={win.thumbnail} alt="" className="w-14 h-8 rounded-kb-xs object-cover border border-border/30" />
            )}
            <span className="text-b3 leading-tight line-clamp-1">{win.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SegmentList({ segments, selectedIds, onToggleSelect, onInsertSelected, onInsertAll }: {
  segments: ExtractedSegment[]; selectedIds: Set<string>;
  onToggleSelect: (id: string) => void; onInsertSelected: () => void; onInsertAll: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segments.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <span className="text-b2 font-medium text-text-secondary">提取结果 ({segments.length})</span>
        <div className="flex items-center gap-2">
          <button onClick={onInsertSelected} disabled={selectedIds.size === 0}
            className={cn('inline-flex items-center gap-1 px-2.5 py-1.5 rounded-kb-sm text-b3 font-medium transition-all',
              selectedIds.size > 0 ? 'bg-brand-50 text-brand-600 hover:bg-brand-100' : 'text-text-tertiary cursor-not-allowed')}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} /> 插入选中
          </button>
          <button onClick={onInsertAll} disabled={segments.length === 0}
            className={cn('inline-flex items-center gap-1 px-2.5 py-1.5 rounded-kb-sm text-b3 font-medium transition-all',
              segments.length > 0 ? 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary' : 'text-text-tertiary cursor-not-allowed')}>
            <ListPlus className="w-3.5 h-3.5" strokeWidth={2} /> 全部插入
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {segments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Eye className="w-12 h-12 mb-3 opacity-20" strokeWidth={1} />
            <p className="text-b2">采集开始后提取结果将在此显示</p>
            <p className="text-b3 mt-1 opacity-60">选择目标窗口并点击"开始"</p>
          </div>
        )}
        {segments.map((seg) => {
          const isSelected = selectedIds.has(seg.id);
          const sourceLabel = seg.source === 'vision' ? '视觉' : seg.source === 'audio' ? '音频' : 'UI';
          const sourceColor = seg.source === 'vision'
            ? 'bg-accent-500/10 text-accent-600'
            : seg.source === 'audio' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600';
          return (
            <div key={seg.id} onClick={() => onToggleSelect(seg.id)}
              className={cn('group p-3 rounded-kb-md cursor-pointer transition-all border border-transparent',
                isSelected ? 'bg-brand-50/50 border-brand-200/50' : 'hover:bg-bg-tertiary/50')}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn('px-1.5 py-0.5 rounded-kb-xs text-[10px] font-medium', sourceColor)}>{sourceLabel}</span>
                <span className="text-[10px] text-text-tertiary">{new Date(seg.timestamp).toLocaleTimeString()}</span>
                {isSelected && <CheckCircle2 className="ml-auto w-4 h-4 text-brand-500" strokeWidth={1.5} />}
              </div>
              <p className="text-b2 text-text-primary leading-relaxed">{seg.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================
// 主页面
// ================================================================

export default function ClassroomPage() {
  const capture = useClassroomCapture();
  const statusCfg = STATUS_CONFIG[capture.status];
  const StatusIcon = statusCfg.icon;

  const handleInsertSelected = () => {
    // 全页模式下暂无笔记编辑器目标，复制到剪贴板
    const texts = capture.segments.filter((s) => capture.selectedIds.has(s.id)).map((s) => s.text).join('\n\n');
    if (texts) navigator.clipboard.writeText(texts);
  };
  const handleInsertAll = () => {
    const texts = capture.segments.map((s) => s.text).join('\n\n');
    if (texts) navigator.clipboard.writeText(texts);
  };

  return (
    <div className="flex h-full min-h-0">
      {/* ── 左侧控制面板 ── */}
      <div className="w-80 flex-shrink-0 border-r border-border/30 flex flex-col overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border/30">
          <Clapperboard className="w-5 h-5 text-brand-500" strokeWidth={1.5} />
          <h1 className="text-b1 font-semibold text-text-primary">回声定位</h1>
          {capture.status === 'capturing' && (
            <span className="ml-auto w-2.5 h-2.5 rounded-full bg-semantic-error animate-pulse" />
          )}
        </div>

        <div className="p-4 space-y-5">
          {/* 窗口选择 */}
          <WindowSelector
            windows={capture.windows}
            selected={capture.selectedWindow}
            onSelect={capture.setSelectedWindow}
            onRefresh={capture.refreshWindows}
            loading={capture.windowsLoading}
          />

          {/* 路径选择 */}
          <div>
            <span className="text-b3 font-medium text-text-tertiary block mb-2">采集路径</span>
            <div className="flex items-center gap-1">
              {([
                { value: 'fine' as CapturePath, label: '精细' },
                { value: 'smart' as CapturePath, label: '智能' },
                { value: 'full_record' as CapturePath, label: '录制' },
              ]).map(({ value, label }) => (
                <button key={value} onClick={() => capture.setCapturePath(value)}
                  disabled={capture.status === 'capturing' || capture.status === 'processing'}
                  className={cn('flex-1 py-2 rounded-kb-sm text-b3 font-medium transition-all',
                    capture.capturePath === value
                      ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200/50'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary/50',
                    (capture.status === 'capturing' || capture.status === 'processing') && 'opacity-50 cursor-not-allowed')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 状态 + 控制 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className={cn('flex items-center gap-1.5 text-b3 font-medium', statusCfg.color)}>
                <StatusIcon className={cn('w-4 h-4', capture.status === 'capturing' && 'animate-spin')} strokeWidth={1.5} />
                {statusCfg.label}
              </div>
              <div className="flex items-center gap-3 text-b3 text-text-tertiary">
                <span>帧 {capture.stats.frames}</span>
                <span>段 {capture.stats.extracted}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {capture.status !== 'capturing' ? (
                <button onClick={capture.handleStart} disabled={!capture.canStart}
                  className={cn('inline-flex items-center gap-1.5 px-4 py-2 rounded-kb-md text-b3 font-medium',
                    'bg-semantic-success/10 text-semantic-success hover:bg-semantic-success/20',
                    'active:scale-95 transition-all', !capture.canStart && 'opacity-50 cursor-not-allowed')}>
                  <Play className="w-4 h-4" strokeWidth={1.5} /> 开始
                </button>
              ) : (
                <button onClick={capture.handlePause}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-kb-md text-b3 font-medium bg-semantic-warning/10 text-semantic-warning hover:bg-semantic-warning/20 active:scale-95 transition-all">
                  <Pause className="w-4 h-4" strokeWidth={1.5} /> 暂停
                </button>
              )}
              {capture.status !== 'idle' && capture.status !== 'error' && (
                <button onClick={capture.handleStop}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-kb-md text-b3 font-medium bg-bg-secondary text-text-secondary border border-border/50 hover:bg-bg-tertiary hover:text-text-primary active:scale-95 transition-all">
                  <Square className="w-4 h-4" strokeWidth={1.5} /> 停止
                </button>
              )}
            </div>
          </div>

          {/* 模式切换 */}
          <div className="flex items-center gap-1">
            {MODE_OPTIONS.map(({ value, label, icon: ModeIcon }) => (
              <button key={value} onClick={() => capture.handleModeChange(value)}
                disabled={capture.status === 'capturing' || capture.status === 'processing'}
                className={cn('flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-kb-sm text-b3 font-medium transition-all',
                  capture.mode === value
                    ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200/50'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary/50',
                  (capture.status === 'capturing' || capture.status === 'processing') && 'opacity-50 cursor-not-allowed')}>
                <ModeIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> {label}
              </button>
            ))}
          </div>

          {/* 设置 */}
          <SettingsSection config={capture.config} onChange={capture.handleConfigChange} />
        </div>
      </div>

      {/* ── 右侧内容区 ── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* 错误提示 */}
        {capture.extractionError && (
          <div className="mx-4 mt-3 p-3 rounded-kb-lg bg-semantic-error/5 border border-semantic-error/10">
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 text-semantic-error" strokeWidth={1.5} />
              <div>
                <p className="text-b3 text-semantic-error font-medium">{capture.extractionError}</p>
                <p className="text-b3 text-text-tertiary mt-0.5">请在设置中检查AI网关配置</p>
              </div>
            </div>
          </div>
        )}

        {/* 条件渲染内容 */}
        {capture.capturePath === 'fine' && (
          <SegmentList
            segments={capture.segments}
            selectedIds={capture.selectedIds}
            onToggleSelect={capture.handleToggleSelect}
            onInsertSelected={handleInsertSelected}
            onInsertAll={handleInsertAll}
          />
        )}

        {capture.capturePath === 'smart' && (
          <SmartCapturePanel bundle={capture.smartBundle} isRecording={capture.status === 'capturing'} />
        )}

        {capture.capturePath === 'full_record' && (
          <VideoRecordPanel recordingStatus={capture.recordingStatus} isRecording={capture.status === 'capturing'} />
        )}

        {/* 分析预览 */}
        {(capture.isAnalyzing || capture.analysisResult || capture.analysisError) && (
          <AnalysisPreview
            result={capture.analysisResult}
            isAnalyzing={capture.isAnalyzing}
            error={capture.analysisError}
            onInsert={() => capture.handleDismissAnalysis()}
            onDismiss={capture.handleDismissAnalysis}
            onRetry={capture.handleAnalyze}
          />
        )}
      </div>
    </div>
  );
}

// ================================================================
// 设置区（内联）
// ================================================================

function SettingsSection({ config, onChange }: {
  config: CaptureSidebarConfig;
  onChange: (patch: Partial<CaptureSidebarConfig>) => void;
}) {
  return (
    <div className="space-y-3 pt-3 border-t border-border/20">
      <div className="flex items-center gap-2 text-b3 text-text-tertiary">
        <Settings2 className="w-4 h-4" strokeWidth={1.5} />
        <span className="font-medium">设置</span>
      </div>
      <div>
        <label className="text-b3 text-text-tertiary mb-1 block">截图间隔: {config.screenshotInterval / 1000}s</label>
        <input type="range" min={1} max={30} value={config.screenshotInterval / 1000}
          onChange={(e) => onChange({ screenshotInterval: Number(e.target.value) * 1000 })}
          className="w-full accent-brand-600" />
      </div>
      <div>
        <label className="text-b3 text-text-tertiary mb-1 block">识别语言</label>
        <div className="flex gap-1">
          {LANGUAGE_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => onChange({ language: value })}
              className={cn('flex-1 py-1.5 rounded-kb-sm text-b3 font-medium transition-all',
                config.language === value
                  ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200/50'
                  : 'text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary')}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
