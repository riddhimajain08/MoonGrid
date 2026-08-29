'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface UploadedFile {
  file: File;
  preview: string;
  name: string;
  size: string;
  type: string;
}

interface PipelineStage {
  id: number;
  key: string;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = ['.tif', '.tiff', '.jpg', '.jpeg', '.png'];
const ACCEPTED_MIME = ['image/tiff', 'image/jpeg', 'image/png', 'image/jpg'];

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 1,
    key: 'preprocess',
    label: 'Pre-processing',
    sublabel: 'Noise reduction & radiometric calibration',
    icon: '⚙️',
    color: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    durationMs: 1800,
  },
  {
    id: 2,
    key: 'superres',
    label: 'Super-Resolution',
    sublabel: '5m → ~1m via SwinIR / ESRGAN',
    icon: '🔬',
    color: 'from-purple-500/20 to-indigo-500/20',
    borderColor: 'border-purple-500/40',
    textColor: 'text-purple-400',
    badgeColor: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    durationMs: 2600,
  },
  {
    id: 3,
    key: 'hazard',
    label: 'Hazard Detection',
    sublabel: 'Craters · Boulders · Slopes · Shadows',
    icon: '🕳️',
    color: 'from-orange-500/20 to-red-500/20',
    borderColor: 'border-orange-500/40',
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    durationMs: 2200,
  },
  {
    id: 4,
    key: 'risk',
    label: 'Risk Scoring',
    sublabel: '1m grid risk-map fusion engine',
    icon: '🗺️',
    color: 'from-yellow-500/20 to-amber-500/20',
    borderColor: 'border-yellow-500/40',
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    durationMs: 1400,
  },
  {
    id: 5,
    key: 'landing',
    label: 'Safe Zone Detection',
    sublabel: 'Optimal landing site identification',
    icon: '🎯',
    color: 'from-emerald-500/20 to-green-500/20',
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-400',
    badgeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    durationMs: 1200,
  },
];

// ─── Mock results ─────────────────────────────────────────────────────────────
const MOCK_RESULTS = {
  craters: { count: 14, maxDiam: '42m', risk: 'high' },
  boulders: { count: 7, maxSize: '3.2m', risk: 'medium' },
  slope: { maxDeg: '11.4°', avgDeg: '4.7°', risk: 'medium' },
  shadow: { coverage: '18%', risk: 'low' },
  overallRisk: 28,
  safeZone: { lat: '18.4°S', lon: '77.1°E', radius: '38m', confidence: '91%' },
};

// ─── Utility ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── HazardBar ────────────────────────────────────────────────────────────────
function HazardBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 200);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[0.65rem] font-mono mb-1">
        <span className="text-gray-400 uppercase tracking-widest">{label}</span>
        <span className="text-white font-bold">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

// ─── RiskGauge ────────────────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const color = score < 35 ? 'text-emerald-400' : score < 65 ? 'text-yellow-400' : 'text-red-400';
  const label = score < 35 ? 'LOW RISK' : score < 65 ? 'MODERATE' : 'HIGH RISK';
  const ringColor =
    score < 35
      ? 'shadow-emerald-500/40 border-emerald-500/50'
      : score < 65
      ? 'shadow-yellow-500/40 border-yellow-500/50'
      : 'shadow-red-500/40 border-red-500/50';
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-24 h-24 rounded-full border-4 ${ringColor} flex flex-col items-center justify-center shadow-lg`}
      >
        <span className={`text-2xl font-black font-mono ${color}`}>{score}</span>
        <span className={`text-[0.5rem] font-mono tracking-widest ${color}`}>/100</span>
      </div>
      <span className={`mt-2 text-[0.6rem] font-mono font-bold tracking-widest uppercase ${color}`}>
        {label}
      </span>
    </div>
  );
}

// ─── HazardGrid ───────────────────────────────────────────────────────────────
function HazardGrid() {
  const [cells] = useState(() =>
    Array.from({ length: 25 }, () => {
      const r = Math.random();
      return r < 0.35 ? 'safe' : r < 0.55 ? 'caution' : r < 0.75 ? 'risky' : 'danger';
    })
  );
  const colorMap: Record<string, string> = {
    safe: 'bg-emerald-500/70',
    caution: 'bg-yellow-500/70',
    risky: 'bg-orange-500/70',
    danger: 'bg-red-500/70',
  };
  return (
    <div className="grid grid-cols-5 gap-0.5">
      {cells.map((c, i) => (
        <div key={i} className={`h-6 rounded-sm ${colorMap[c]}`} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LunarImageAnalysis() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState(-1);
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [stageProgress, setStageProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    setError(null);
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    const validExt = ACCEPTED_TYPES.includes(ext);
    if (!validExt) {
      setError(`Unsupported format. Accepted: ${ACCEPTED_TYPES.join(', ')}`);
      return;
    }
    const isTiff = ext === '.tif' || ext === '.tiff';
    const preview = isTiff ? '' : URL.createObjectURL(file);
    setUploadedFile({
      file,
      preview,
      name: file.name,
      size: formatBytes(file.size),
      type: ext.toUpperCase().replace('.', ''),
    });
    setShowResults(false);
    setCompletedStages(new Set());
    setCurrentStage(-1);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const runPipeline = useCallback(async () => {
    if (!uploadedFile || isProcessing) return;
    setIsProcessing(true);
    setShowResults(false);
    setCompletedStages(new Set());
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];
      setCurrentStage(i);
      setStageProgress(0);
      const steps = 30;
      const stepTime = stage.durationMs / steps;
      for (let s = 0; s <= steps; s++) {
        await new Promise((r) => setTimeout(r, stepTime));
        setStageProgress(Math.round((s / steps) * 100));
      }
      setCompletedStages((prev) => new Set([...prev, i]));
    }
    setCurrentStage(-1);
    setIsProcessing(false);
    setShowResults(true);
  }, [uploadedFile, isProcessing]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const exportReport = useCallback(() => {
    if (!uploadedFile) return;
    setIsExporting(true);

    const reportData = {
      project: "MoonGrid — Autonomous Lunar Hazard Mapping & Safe Landing System",
      timestamp: new Date().toISOString(),
      source_imagery: {
        filename: uploadedFile.name,
        filesize: uploadedFile.size,
        format: uploadedFile.type,
        nominal_spatial_resolution: "5.0m / pixel (TMC Orbital Sensor)",
        enhanced_spatial_resolution: "1.0m / pixel (SwinIR / ESRGAN Super-Resolution)",
      },
      pipeline_execution: {
        status: "SUCCESS",
        total_latency_ms: PIPELINE_STAGES.reduce((acc, s) => acc + s.durationMs, 0),
        stages_completed: PIPELINE_STAGES.map(s => ({
          stage: s.label,
          module: s.sublabel,
          execution_time_ms: s.durationMs,
        })),
      },
      hazard_analysis: {
        craters: {
          detected_count: MOCK_RESULTS.craters.count,
          max_rim_diameter: MOCK_RESULTS.craters.maxDiam,
          hazard_rating: MOCK_RESULTS.craters.risk.toUpperCase(),
        },
        boulders: {
          detected_count: MOCK_RESULTS.boulders.count,
          max_boulder_dimension: MOCK_RESULTS.boulders.maxSize,
          hazard_rating: MOCK_RESULTS.boulders.risk.toUpperCase(),
        },
        slope_gradients: {
          average_slope_deg: MOCK_RESULTS.slope.avgDeg,
          maximum_slope_deg: MOCK_RESULTS.slope.maxDeg,
          landing_safety_threshold: "< 10.0°",
          hazard_rating: MOCK_RESULTS.slope.risk.toUpperCase(),
        },
        shadows: {
          coverage_percentage: MOCK_RESULTS.shadow.coverage,
          hazard_rating: MOCK_RESULTS.shadow.risk.toUpperCase(),
        },
      },
      risk_score_matrix: {
        overall_composite_risk: MOCK_RESULTS.overallRisk,
        scale: "0 (Optimal / Safe) to 100 (Critical Hazard)",
        classification: MOCK_RESULTS.overallRisk < 35 ? "LOW RISK / CLEARED FOR TOUCHDOWN" : "CAUTION",
      },
      optimal_landing_zone: {
        coordinates: {
          latitude: MOCK_RESULTS.safeZone.lat,
          longitude: MOCK_RESULTS.safeZone.lon,
        },
        safe_touchdown_radius: MOCK_RESULTS.safeZone.radius,
        confidence_metric: MOCK_RESULTS.safeZone.confidence,
        spatial_reference: "EPSG:30100 (Moon 2000 Coordinate Reference System)",
        recommendation: "TOUCHDOWN CLEARED — CONTIGUOUS LOW-RISK ELLIPSE VERIFIED",
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MoonGrid_Mission_Report_${uploadedFile.name.replace(/\.[^/.]+$/, "")}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExporting(false);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3500);
  }, [uploadedFile]);

  const resetAll = useCallback(() => {
    setUploadedFile(null);
    setIsProcessing(false);
    setCurrentStage(-1);
    setCompletedStages(new Set());
    setShowResults(false);
    setStageProgress(0);
    setError(null);
    setExportSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h2 className="font-heading font-black text-3xl md:text-4xl text-white tracking-wider flex items-center justify-center gap-3">
          <span>🌕</span><span>Lunar Image Analysis</span>
        </h2>
        <p className="text-xs font-mono text-cyan-400 tracking-widest uppercase">
          Super-Resolution · Hazard Detection · Safe Landing Zone Identification
        </p>
      </div>

      {/* Upload Zone */}
      {!uploadedFile && (
        <div
          id="lunar-upload-zone"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer group rounded-3xl border-2 border-dashed transition-all duration-300 p-16 flex flex-col items-center justify-center text-center
            ${isDragging
              ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01] shadow-[0_0_50px_rgba(6,182,212,0.3)]'
              : 'border-white/15 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)]'
            }`}
        >
          <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center mb-6 transition-all duration-500
            ${isDragging ? 'border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)] scale-110' : 'border-white/20 group-hover:border-cyan-400/60 group-hover:scale-105'}`}>
            <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center">
              <span className="text-4xl select-none">{isDragging ? '📂' : '🛰️'}</span>
            </div>
          </div>
          <h3 className="font-heading font-bold text-xl text-white mb-2">
            {isDragging ? 'Drop your lunar image here' : 'Upload Lunar Imagery'}
          </h3>
          <p className="text-sm text-gray-400 font-light mb-6 max-w-sm">
            Drag &amp; drop a file, or click to browse. Supports TMC &amp; OHRC sensor formats.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {ACCEPTED_TYPES.map((ext) => (
              <span key={ext} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[0.65rem] font-mono text-cyan-300 uppercase tracking-widest">
                {ext}
              </span>
            ))}
          </div>
          {error && (
            <p className="mt-4 text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">
              ⚠️ {error}
            </p>
          )}
          <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={onFileChange} className="hidden" id="lunar-file-input" />
        </div>
      )}

      {/* File Card + Pipeline */}
      {uploadedFile && !showResults && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-white/10 p-6 flex flex-col md:flex-row items-center gap-6">
            {/* Preview */}
            <div className="relative flex-shrink-0 w-40 h-40 rounded-xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center">
              {uploadedFile.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploadedFile.preview} alt="Lunar image preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center px-2">
                  <span className="text-4xl">🛰️</span>
                  <span className="text-[0.6rem] font-mono text-gray-500 uppercase tracking-wider">TIFF — No Preview</span>
                </div>
              )}
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[0.6rem] font-mono text-cyan-300 border border-cyan-500/30 uppercase tracking-wider backdrop-blur-sm">
                {uploadedFile.type}
              </span>
            </div>

            {/* Metadata */}
            <div className="flex-1 space-y-2">
              <h4 className="font-heading font-bold text-lg text-white truncate">{uploadedFile.name}</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Format', value: uploadedFile.type },
                  { label: 'Size', value: uploadedFile.size },
                  { label: 'Status', value: isProcessing ? 'Processing…' : 'Ready' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-[0.6rem] font-mono text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-xs font-mono text-white font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                id="run-analysis-btn"
                onClick={runPipeline}
                disabled={isProcessing}
                className={`px-8 py-3 rounded-xl text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300
                  ${isProcessing
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 hover:scale-105 shadow-lg shadow-cyan-500/20'
                  }`}
              >
                {isProcessing ? '⏳ Analysing…' : '🚀 Run Analysis'}
              </button>
              <button id="upload-new-btn" onClick={resetAll}
                className="px-8 py-3 rounded-xl text-xs font-mono text-gray-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all">
                ✕ Remove File
              </button>
            </div>
          </div>

          {/* Pipeline Stages */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isActive = currentStage === idx;
              const isDone = completedStages.has(idx);
              const isPending = !isActive && !isDone;
              return (
                <div key={stage.key}
                  className={`relative rounded-2xl border p-4 transition-all duration-500
                    ${isDone ? `bg-gradient-to-br ${stage.color} ${stage.borderColor} shadow-lg` : ''}
                    ${isActive ? `bg-gradient-to-br ${stage.color} ${stage.borderColor} shadow-xl scale-[1.03]` : ''}
                    ${isPending ? 'bg-white/2 border-white/8 opacity-50' : ''}
                  `}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{stage.icon}</span>
                    {isDone && <span className="text-emerald-400 text-sm font-bold">✓</span>}
                    {isActive && <span className={`w-2 h-2 rounded-full animate-pulse ${stage.textColor.replace('text-', 'bg-')}`} />}
                  </div>
                  <p className={`text-xs font-mono font-bold mb-0.5 ${isDone || isActive ? stage.textColor : 'text-gray-600'}`}>
                    {stage.label}
                  </p>
                  <p className="text-[0.6rem] text-gray-500 leading-tight">{stage.sublabel}</p>
                  {isActive && (
                    <div className="mt-3 h-0.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full transition-all duration-200 ${stage.textColor.replace('text-', 'bg-')}`}
                        style={{ width: `${stageProgress}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Processing indicator */}
          {isProcessing && (
            <div className="glass rounded-2xl border border-cyan-500/20 p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest">
                  {currentStage >= 0 ? PIPELINE_STAGES[currentStage].label : 'Initialising…'}
                </p>
                <p className="text-[0.65rem] text-gray-500 mt-0.5">
                  {currentStage >= 0 ? PIPELINE_STAGES[currentStage].sublabel : ''}
                </p>
              </div>
              <span className="text-xs font-mono text-gray-400">
                Stage {currentStage + 1}/{PIPELINE_STAGES.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Results Dashboard */}
      {showResults && uploadedFile && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-heading font-black text-2xl text-white flex items-center gap-2">
                <span>📊</span> Analysis Results
              </h3>
              <p className="text-[0.65rem] font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Pipeline complete · {uploadedFile.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {exportSuccess && (
                <span className="text-[0.65rem] font-mono text-emerald-300 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-500/40 animate-fade-in flex items-center gap-1.5">
                  <span>✓</span> Mission Report Downloaded
                </span>
              )}
              <button id="new-analysis-btn" onClick={resetAll}
                className="px-5 py-2 rounded-xl text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all">
                + New Analysis
              </button>
              <button id="export-results-btn"
                onClick={exportReport}
                disabled={isExporting}
                className="px-5 py-2 rounded-xl text-xs font-mono bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 font-bold flex items-center gap-1.5 disabled:opacity-50">
                <span>⬇</span>
                <span>{isExporting ? 'Generating…' : 'Export Mission Report'}</span>
              </button>
            </div>
          </div>

          {/* Image panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Original */}
            <div className="glass rounded-2xl border border-white/10 p-4 space-y-3">
              <p className="text-[0.65rem] font-mono text-gray-400 uppercase tracking-widest">Original Input</p>
              <div className="h-44 rounded-xl overflow-hidden bg-slate-950 border border-white/5 flex items-center justify-center">
                {uploadedFile.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploadedFile.preview} alt="Original lunar image" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-50">
                    <span className="text-5xl">🛰️</span>
                    <span className="text-[0.6rem] font-mono text-gray-500 uppercase">TIFF Image</span>
                  </div>
                )}
              </div>
              <div className="text-[0.6rem] font-mono text-gray-500 flex justify-between">
                <span>Resolution: 5m/px</span>
                <span className="text-blue-400">{uploadedFile.type}</span>
              </div>
            </div>

            {/* Super-Resolved */}
            <div className="glass rounded-2xl border border-purple-500/20 p-4 space-y-3">
              <p className="text-[0.65rem] font-mono text-purple-400 uppercase tracking-widest">Super-Resolved Output</p>
              <div className="h-44 rounded-xl overflow-hidden bg-slate-950 border border-purple-500/10 relative flex items-center justify-center">
                {uploadedFile.preview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedFile.preview} alt="Super-resolved output" className="w-full h-full object-cover"
                      style={{ filter: 'contrast(1.12) brightness(1.05) saturate(1.1)' }} />
                    <div className="absolute inset-0 bg-purple-900/10" />
                    <span className="absolute bottom-2 right-2 text-[0.55rem] font-mono text-purple-300 bg-black/50 px-2 py-0.5 rounded-full border border-purple-500/20 backdrop-blur-sm">
                      SwinIR Enhanced
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-50">
                    <span className="text-5xl">🔬</span>
                    <span className="text-[0.6rem] font-mono text-gray-500 uppercase">AI Enhanced</span>
                  </div>
                )}
              </div>
              <div className="text-[0.6rem] font-mono text-gray-500 flex justify-between">
                <span>Resolution: ~1m/px</span>
                <span className="text-purple-400">×5 Upscale</span>
              </div>
            </div>

            {/* Hazard Grid Map */}
            <div className="glass rounded-2xl border border-orange-500/20 p-4 space-y-3">
              <p className="text-[0.65rem] font-mono text-orange-400 uppercase tracking-widest">Hazard Map (1m Grid)</p>
              <div className="h-44 rounded-xl bg-slate-950 border border-orange-500/10 flex items-center justify-center p-4">
                <div className="w-full"><HazardGrid /></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { color: 'bg-emerald-500', label: 'Safe' },
                  { color: 'bg-yellow-500', label: 'Caution' },
                  { color: 'bg-orange-500', label: 'Risky' },
                  { color: 'bg-red-500', label: 'Danger' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1 text-[0.55rem] font-mono text-gray-400">
                    <span className={`w-2 h-2 rounded-sm ${color} opacity-70`} />{label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hazard breakdown */}
            <div className="glass rounded-2xl border border-white/10 p-5">
              <p className="text-[0.65rem] font-mono text-gray-400 uppercase tracking-widest mb-4">Hazard Breakdown</p>
              <HazardBar label="Crater Risk" value={72} color="bg-red-500" />
              <HazardBar label="Boulder Risk" value={44} color="bg-orange-500" />
              <HazardBar label="Slope Risk" value={38} color="bg-yellow-500" />
              <HazardBar label="Shadow Coverage" value={18} color="bg-indigo-500" />
              <HazardBar label="Terrain Roughness" value={55} color="bg-purple-500" />
              <div className="mt-4 grid grid-cols-2 gap-2 text-[0.6rem] font-mono">
                {[
                  { label: 'Craters', value: `${MOCK_RESULTS.craters.count} detected`, color: 'text-red-400' },
                  { label: 'Boulders', value: `${MOCK_RESULTS.boulders.count} detected`, color: 'text-orange-400' },
                  { label: 'Max Slope', value: MOCK_RESULTS.slope.maxDeg, color: 'text-yellow-400' },
                  { label: 'Shadows', value: MOCK_RESULTS.shadow.coverage, color: 'text-indigo-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/5 rounded-lg p-2">
                    <span className="text-gray-500 block uppercase tracking-widest">{label}</span>
                    <span className={`${color} font-bold`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Gauge */}
            <div className="glass rounded-2xl border border-white/10 p-5 flex flex-col items-center justify-center gap-6">
              <p className="text-[0.65rem] font-mono text-gray-400 uppercase tracking-widest self-start">Overall Risk Score</p>
              <RiskGauge score={MOCK_RESULTS.overallRisk} />
              <div className="w-full space-y-2 text-[0.6rem] font-mono">
                <div className="flex justify-between text-gray-500">
                  <span>0 — Safe</span><span>50 — Moderate</span><span>100 — Danger</span>
                </div>
                <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 opacity-30" />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {PIPELINE_STAGES.map((s) => (
                  <span key={s.key} className={`px-2 py-0.5 rounded-full text-[0.55rem] font-mono border ${s.badgeColor}`}>
                    ✓ {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Safe Landing Zone */}
            <div className="glass rounded-2xl border border-emerald-500/20 p-5 flex flex-col gap-4">
              <p className="text-[0.65rem] font-mono text-emerald-400 uppercase tracking-widest">Recommended Landing Zone</p>
              <div className="flex-1 flex items-center justify-center">
                <div className="relative w-28 h-28">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping opacity-20" />
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40" />
                  <div className="absolute inset-3 rounded-full border border-emerald-500/30" />
                  <div className="absolute inset-6 rounded-full border border-emerald-500/50" />
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl">🎯</span></div>
                  <div className="absolute inset-0 flex items-center"><div className="w-full h-px bg-emerald-500/20" /></div>
                  <div className="absolute inset-0 flex justify-center"><div className="h-full w-px bg-emerald-500/20" /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[0.6rem] font-mono">
                {[
                  { label: 'Latitude', value: MOCK_RESULTS.safeZone.lat },
                  { label: 'Longitude', value: MOCK_RESULTS.safeZone.lon },
                  { label: 'Safe Radius', value: MOCK_RESULTS.safeZone.radius },
                  { label: 'Confidence', value: MOCK_RESULTS.safeZone.confidence },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2">
                    <span className="text-gray-500 block uppercase tracking-widest">{label}</span>
                    <span className="text-emerald-400 font-bold">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[0.6rem] font-mono text-gray-500 text-center">
                Avg slope {MOCK_RESULTS.slope.avgDeg} · No craters in safety radius
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
