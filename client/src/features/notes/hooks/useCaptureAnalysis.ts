import { useState, useCallback } from 'react';
import { analyzeSession, analyzeVideo } from '@/lib/ai/sessionAnalyzer';
import type { AnalyzeResult } from '@/lib/ai/sessionAnalyzer';
import type { SessionBundle, RecordingStatus } from '@/lib/capture';

// ================================================================
// useCaptureAnalysis — AI 多模态分析状态与调用
// ================================================================

interface UseCaptureAnalysisParams {
  smartBundle: Partial<SessionBundle>;
  videoFilePath: string | null;
  recordingStatus: RecordingStatus | null;
  language: 'zh' | 'en' | 'mixed';
}

export function useCaptureAnalysis({
  smartBundle, videoFilePath, recordingStatus, language,
}: UseCaptureAnalysisParams) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!smartBundle.keyframes || smartBundle.keyframes.length === 0) return;
    setIsAnalyzing(true); setAnalysisError(null); setAnalysisResult(null);
    try {
      const fullBundle: SessionBundle = {
        keyframes: smartBundle.keyframes, audioSegments: smartBundle.audioSegments ?? [],
        timeline: smartBundle.timeline ?? [], duration: smartBundle.duration ?? 0,
      };
      setAnalysisResult(await analyzeSession(fullBundle, { language }));
    } catch (err) { setAnalysisError(err instanceof Error ? err.message : '未知分析错误'); }
    finally { setIsAnalyzing(false); }
  }, [smartBundle, language]);

  const handleVideoAnalyze = useCallback(async (filePath?: string) => {
    const targetPath = filePath ?? videoFilePath; if (!targetPath) return;
    setIsAnalyzing(true); setAnalysisError(null); setAnalysisResult(null);
    try {
      setAnalysisResult(await analyzeVideo(targetPath, { duration: recordingStatus?.duration, language }));
    } catch (err) { setAnalysisError(err instanceof Error ? err.message : '未知分析错误'); }
    finally { setIsAnalyzing(false); }
  }, [videoFilePath, recordingStatus?.duration, language]);

  const handleDismissAnalysis = useCallback(() => {
    setAnalysisResult(null); setAnalysisError(null); setIsAnalyzing(false);
  }, []);

  return { isAnalyzing, analysisResult, analysisError, handleAnalyze, handleVideoAnalyze, handleDismissAnalysis };
}
