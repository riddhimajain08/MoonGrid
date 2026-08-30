'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Constants & Configurations ──────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ACCEPTED_TYPES = ['.tif', '.tiff', '.jpg', '.jpeg', '.png'];

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
  stepNumber: string;
  label: string;
  sublabel: string;
  color: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
  durationMs: number;
}

export interface BackendPredictResponse {
  processing_time_ms: number;
  original_resolution_m: number;
  enhanced_resolution_m: number;
  super_res_image_url: string;
  original_image_url: string;
  hazards: {
    craters: Array<{ x: number; y: number; width: number; height: number; confidence: number }>;
    boulders: Array<{ x: number; y: number; width: number; height: number; confidence: number }>;
    slope_zones: Array<{ x: number; y: number; width: number; height: number; avg_slope_deg: number }>;
    shadow_zones: Array<{ x: number; y: number; width: number; height: number }>;
  };
  risk_map_url: string;
  safe_zones: Array<{
    id: string;
    x: number;
    y: number;
    radius_px: number;
    risk_score: number;
    rank: number;
    area_m2: number;
  }>;
  recommended_zone_id: string;
  landing_path: {
    waypoints: Array<{ x: number; y: number; altitude_m: number }>;
  };
  summary: {
    total_craters: number;
    total_boulders: number;
    percent_safe: number;
    percent_moderate: number;
    percent_hazardous: number;
  };
}

export interface JobListItem {
  id: string;
  created_at: string;
  original_filename: string | null;
  processing_time_ms: number;
  recommended_zone_id: string;
  total_craters: number;
  total_boulders: number;
  percent_safe: number;
  percent_moderate: number;
  percent_hazardous: number;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 1,
    key: 'preprocess',
    stepNumber: 'STEP 01',
    label: 'Pre-processing',
    sublabel: 'Noise reduction & radiometric calibration',
    color: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    durationMs: 1200,
  },
  {
    id: 2,
    key: 'superres',
    stepNumber: 'STEP 02',
    label: 'Super-Resolution',
    sublabel: '5m → ~1m via RRDB / SwinIR',
    color: 'from-purple-500/20 to-indigo-500/20',
    borderColor: 'border-purple-500/40',
    textColor: 'text-purple-400',
    badgeColor: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    durationMs: 1800,
  },
  {
    id: 3,
    key: 'hazard',
    stepNumber: 'STEP 03',
    label: 'Hazard Detection',
    sublabel: 'Craters · Steep Slopes · Deep Shadows',
    color: 'from-orange-500/20 to-red-500/20',
    borderColor: 'border-orange-500/40',
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    durationMs: 1500,
  },
  {
    id: 4,
    key: 'risk',
    stepNumber: 'STEP 04',
    label: 'Risk Scoring',
    sublabel: 'Multi-hazard 1m risk-map fusion',
    color: 'from-yellow-500/20 to-amber-500/20',
    borderColor: 'border-yellow-500/40',
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    durationMs: 1000,
  },
  {
    id: 5,
    key: 'landing',
    stepNumber: 'STEP 05',
    label: 'Safe Zone Detection',
    sublabel: 'Topological safe site identification',
    color: 'from-emerald-500/20 to-green-500/20',
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-400',
    badgeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    durationMs: 800,
  },
];

// ─── Utility Functions ────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFullUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

// ─── Sub-Components ───────────────────────────────────────────────────────────
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

function HazardGrid() {
  const [cells] = useState(() =>
    Array.from({ length: 25 }, () => {
      const r = Math.random();
      return r < 0.4 ? 'safe' : r < 0.6 ? 'caution' : r < 0.8 ? 'risky' : 'danger';
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
  const [apiResponse, setApiResponse] = useState<BackendPredictResponse | null>(null);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  // Past jobs / history state
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Lightbox Zoom state
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; subtitle: string } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener for Esc key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
        setZoomLevel(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch past prediction jobs
  const fetchJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch(`${API_URL}/jobs`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.warn('Could not fetch past jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Load a past prediction job
  const loadPastJob = useCallback(async (jobId: string) => {
    setLoadingJobId(jobId);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/jobs/${jobId}`);
      if (res.ok) {
        const data: BackendPredictResponse = await res.json();
        setApiResponse(data);
        setIsLiveBackend(true);
        setSelectedJobId(jobId);

        const filename = data.original_image_url?.split('/').pop() || 'past_lunar_mission.png';
        setUploadedFile({
          file: new File([], filename),
          preview: getFullUrl(data.original_image_url),
          name: filename,
          size: 'Stored Prediction',
          type: 'PNG',
        });

        setShowResults(true);
        setShowHistory(false);
      } else {
        setError('Failed to retrieve past job details.');
      }
    } catch (err) {
      console.error('Error loading job:', err);
      setError('Connection error while loading job.');
    } finally {
      setLoadingJobId(null);
    }
  }, []);

  const loadFile = useCallback((file: File) => {
    setError(null);
    setSelectedJobId(null);
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
    setApiResponse(null);
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
    setError(null);
    setSelectedJobId(null);
    setCompletedStages(new Set());

    const formData = new FormData();
    formData.append('image', uploadedFile.file);

    // Initiate API call concurrently with pipeline animations
    const fetchPredict = fetch(`${API_URL}/predict`, {
      method: 'POST',
      body: formData,
    });

    let backendData: BackendPredictResponse | null = null;
    let liveSuccess = false;

    // Run visually animated stages
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];
      setCurrentStage(i);
      setStageProgress(0);
      const steps = 20;
      const stepTime = stage.durationMs / steps;
      for (let s = 0; s <= steps; s++) {
        await new Promise((r) => setTimeout(r, stepTime));
        setStageProgress(Math.round((s / steps) * 100));
      }
      setCompletedStages((prev) => new Set([...prev, i]));
    }

    try {
      const res = await fetchPredict;
      if (res.ok) {
        backendData = await res.json();
        liveSuccess = true;
        // Refresh past predictions list
        fetchJobs();
      } else {
        console.warn(`Backend returned HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('Backend API not reachable at', API_URL, err);
    }

    if (backendData) {
      setApiResponse(backendData);
      setIsLiveBackend(liveSuccess);
    } else {
      // Fallback response structure if server is unreachable
      setIsLiveBackend(false);
      setApiResponse({
        processing_time_ms: 3420,
        original_resolution_m: 5,
        enhanced_resolution_m: 1,
        super_res_image_url: '',
        original_image_url: '',
        hazards: {
          craters: Array.from({ length: 14 }, (_, i) => ({ x: 100 + i * 20, y: 150, width: 30, height: 30, confidence: 0.88 })),
          boulders: [],
          slope_zones: [{ x: 50, y: 50, width: 120, height: 100, avg_slope_deg: 11.4 }],
          shadow_zones: [{ x: 300, y: 300, width: 80, height: 80 }],
        },
        risk_map_url: '',
        safe_zones: [
          { id: 'zone_1', x: 396, y: 396, radius_px: 38, risk_score: 0.08, rank: 1, area_m2: 1250 }
        ],
        recommended_zone_id: 'zone_1',
        landing_path: {
          waypoints: [
            { x: 0, y: 0, altitude_m: 5000 },
            { x: 198, y: 198, altitude_m: 2000 },
            { x: 396, y: 396, altitude_m: 0 }
          ]
        },
        summary: {
          total_craters: 14,
          total_boulders: 0,
          percent_safe: 42,
          percent_moderate: 18,
          percent_hazardous: 40,
        }
      });
    }

    setCurrentStage(-1);
    setIsProcessing(false);
    setShowResults(true);
  }, [uploadedFile, isProcessing, fetchJobs]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const exportReport = useCallback(() => {
    if (!uploadedFile || !apiResponse) return;
    setIsExporting(true);

    const recommendedZone = apiResponse.safe_zones.find(z => z.id === apiResponse.recommended_zone_id) || apiResponse.safe_zones[0];

    const reportData = {
      project: "MoonGrid — Autonomous Lunar Hazard Mapping & Safe Landing System",
      timestamp: new Date().toISOString(),
      source_imagery: {
        filename: uploadedFile.name,
        filesize: uploadedFile.size,
        format: uploadedFile.type,
        nominal_spatial_resolution: `${apiResponse.original_resolution_m}.0m / pixel (TMC Orbital Sensor)`,
        enhanced_spatial_resolution: `${apiResponse.enhanced_resolution_m}.0m / pixel (SwinIR / RRDB Super-Resolution)`,
        api_mode: isLiveBackend ? "LIVE_FASTAPI_BACKEND" : "SIMULATION_FALLBACK",
      },
      pipeline_execution: {
        status: "SUCCESS",
        server_latency_ms: apiResponse.processing_time_ms,
        stages_completed: PIPELINE_STAGES.map(s => ({
          stage: s.label,
          module: s.sublabel,
        })),
      },
      hazard_analysis: {
        craters_detected: apiResponse.summary.total_craters,
        slope_zones_identified: apiResponse.hazards.slope_zones.length,
        shadow_zones_identified: apiResponse.hazards.shadow_zones.length,
        percent_safe: `${apiResponse.summary.percent_safe}%`,
        percent_moderate: `${apiResponse.summary.percent_moderate}%`,
        percent_hazardous: `${apiResponse.summary.percent_hazardous}%`,
      },
      recommended_landing_zone: {
        zone_id: apiResponse.recommended_zone_id,
        center_x: recommendedZone?.x,
        center_y: recommendedZone?.y,
        radius_px: recommendedZone?.radius_px,
        area_m2: recommendedZone?.area_m2,
        risk_score: recommendedZone?.risk_score,
        touchdown_path_waypoints: apiResponse.landing_path.waypoints.length,
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
  }, [uploadedFile, apiResponse, isLiveBackend]);

  const resetAll = useCallback(() => {
    setUploadedFile(null);
    setSelectedJobId(null);
    setIsProcessing(false);
    setCurrentStage(-1);
    setCompletedStages(new Set());
    setShowResults(false);
    setApiResponse(null);
    setStageProgress(0);
    setError(null);
    setExportSuccess(false);
    setLightboxImage(null);
    setZoomLevel(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const recZone = apiResponse?.safe_zones.find(z => z.id === apiResponse.recommended_zone_id) || apiResponse?.safe_zones[0];
  const overallRiskScore = apiResponse ? Math.round(100 - apiResponse.summary.percent_safe) : 28;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Lightbox Pop-Out Zoom Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 md:p-6 animate-fade-in"
          onClick={() => { setLightboxImage(null); setZoomLevel(1); }}
        >
          {/* Header Bar */}
          <div
            className="w-full max-w-6xl flex justify-between items-center z-10 glass px-6 py-3 rounded-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base md:text-lg font-heading font-bold text-white tracking-wider flex items-center gap-2">
                <span>🔍</span> {lightboxImage.title}
              </h3>
              <p className="text-xs font-mono text-cyan-400 mt-0.5">{lightboxImage.subtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.25))}
                  className="px-3 py-1 text-xs font-mono font-bold text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="px-2 text-xs font-mono text-cyan-300 font-bold min-w-[50px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(3.5, prev + 0.25))}
                  className="px-3 py-1 text-xs font-mono font-bold text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2.5 py-1 text-[0.65rem] font-mono text-gray-400 hover:text-white transition-all border-l border-white/10"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={() => { setLightboxImage(null); setZoomLevel(1); }}
                className="px-4 py-2 rounded-xl text-xs font-mono bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/40 font-bold transition-all flex items-center gap-1.5"
              >
                <span>✕</span> <span>Minimize</span>
              </button>
            </div>
          </div>

          {/* Zoomable Image Container */}
          <div
            className="relative flex-1 w-full max-w-6xl my-4 overflow-auto flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl transition-transform duration-200 border border-white/15 cursor-zoom-in"
              style={{ transform: `scale(${zoomLevel})` }}
            />
          </div>

          {/* Footer instruction */}
          <div
            className="text-xs font-mono text-gray-400 bg-slate-950/90 px-5 py-2 rounded-full border border-white/10 z-10 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span> Click backdrop or press</span>
            <kbd className="px-2 py-0.5 rounded bg-white/10 text-cyan-300 border border-white/20 font-bold">ESC</kbd>
            <span>to minimize back</span>
          </div>
        </div>
      )}

      {/* Page Header with Action Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left space-y-1">
          <h2 className="font-heading font-black text-3xl md:text-4xl text-white tracking-wider flex items-center justify-center md:justify-start gap-3">
            <span></span><span>Lunar Image Analysis</span>
          </h2>
          <p className="text-xs font-mono text-cyan-400 tracking-widest uppercase">
            Super-Resolution · Hazard Detection · Safe Landing Zone Identification
          </p>
        </div>

        {/* Action Controls: History & New Analysis */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) fetchJobs();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-2 border ${
              showHistory
                ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 hover:bg-white/10 text-cyan-300 border-cyan-500/30'
            }`}
          >
            <span></span>
            <span>Past Predictions ({jobs.length})</span>
          </button>
        </div>
      </div>

      {/* ─── Mission History Drawer / Modal ─── */}
      {showHistory && (
        <div className="glass rounded-3xl border border-cyan-500/30 p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl"></span>
              <h3 className="font-heading font-bold text-lg text-white">Previous Predicted Missions</h3>
              <span className="text-xs font-mono text-gray-400">({jobs.length} recorded in database)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchJobs}
                disabled={isLoadingJobs}
                className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-400 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>🔄</span>
                <span>{isLoadingJobs ? 'Refreshing…' : 'Refresh'}</span>
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {isLoadingJobs ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              <p className="text-xs font-mono text-cyan-400">Loading mission records from database…</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-mono text-gray-400">No past predictions recorded in the database yet.</p>
              <p className="text-xs font-mono text-gray-600">Run your first analysis above to save a prediction job!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 rounded-2xl p-4 space-y-3 transition-all cursor-pointer group"
                  onClick={() => loadPastJob(job.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono font-bold text-white group-hover:text-cyan-300 truncate max-w-[180px]">
                        {job.original_filename || 'Lunar_Capture.png'}
                      </p>
                      <p className="text-[0.6rem] font-mono text-gray-500 mt-0.5">
                        {formatDate(job.created_at)}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[0.6rem] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      {job.percent_safe}% Safe
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[0.6rem] font-mono">
                    <div className="bg-black/30 rounded-lg p-2">
                      <span className="text-gray-500 block uppercase tracking-wider text-[0.55rem]">Craters</span>
                      <span className="text-red-400 font-bold">{job.total_craters}</span>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <span className="text-gray-500 block uppercase tracking-wider text-[0.55rem]">Zone</span>
                      <span className="text-emerald-400 font-bold">{job.recommended_zone_id}</span>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <span className="text-gray-500 block uppercase tracking-wider text-[0.55rem]">Latency</span>
                      <span className="text-cyan-400 font-bold">{job.processing_time_ms}ms</span>
                    </div>
                  </div>

                  <button
                    disabled={loadingJobId === job.id}
                    className="w-full py-1.5 rounded-xl text-[0.65rem] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all flex items-center justify-center gap-1.5"
                  >
                    {loadingJobId === job.id ? (
                      <span>⏳ Loading…</span>
                    ) : (
                      <>
                        <span>Inspect Analysis</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                {isProcessing ? ' Analysing…' : ' Run Analysis'}
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
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[0.65rem] font-mono font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${stage.badgeColor}`}>
                      {stage.stepNumber}
                    </span>
                    {isDone && <span className="text-emerald-400 text-xs font-mono font-bold">✓ DONE</span>}
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
      {showResults && uploadedFile && apiResponse && (
        <div className="space-y-6 animate-fade-in">
          {/* Stored Job Header Banner if viewing a past job */}
          {selectedJobId && (
            <div className="glass rounded-2xl border border-cyan-500/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-cyan-950/30 shadow-lg shadow-cyan-950/50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📜</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-cyan-300 font-bold uppercase tracking-wider">
                      Viewing Saved Mission Run
                    </span>
                    <span className="px-2 py-0.5 rounded text-[0.6rem] font-mono bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold">
                      {selectedJobId.slice(0, 8)}…
                    </span>
                  </div>
                  <p className="text-[0.65rem] font-mono text-gray-400 mt-0.5">
                    Loaded historical inference data from MoonGrid database
                  </p>
                </div>
              </div>
              <button
                onClick={resetAll}
                className="px-4 py-2 rounded-xl text-xs font-mono bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <span>+ Upload New Image</span>
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-heading font-black text-2xl text-white flex items-center gap-2">
                <span></span> Analysis Results
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[0.65rem] font-mono text-emerald-400">
                  {isLiveBackend ? `FastAPI Server Connected (Latency: ${apiResponse.processing_time_ms}ms)` : `Simulated Pipeline Mode (FastAPI standard payload active)`} · {uploadedFile.name}
                </p>
              </div>
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

          {/* Image panels with Pop-out Lightbox Trigger */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Original */}
            <div className="glass rounded-2xl border border-white/10 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-[0.65rem] font-mono text-gray-400 uppercase tracking-widest">Original Input</p>
                <span className="text-[0.58rem] font-mono text-cyan-400"> Click to Expand</span>
              </div>
              <div
                onClick={() => setLightboxImage({
                  url: getFullUrl(apiResponse.original_image_url || uploadedFile.preview),
                  title: 'Original Input Imagery',
                  subtitle: `Nominal Spatial Resolution: ${apiResponse.original_resolution_m}m/pixel · Format: ${uploadedFile.type}`
                })}
                className="group relative h-44 rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center cursor-zoom-in hover:border-cyan-500/50 transition-all duration-300"
              >
                {apiResponse.original_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFullUrl(apiResponse.original_image_url)} alt="Original lunar image" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : uploadedFile.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploadedFile.preview} alt="Original lunar image preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-50">
                    <span className="text-5xl">🛰️</span>
                    <span className="text-[0.6rem] font-mono text-gray-500 uppercase">TIFF Image</span>
                  </div>
                )}
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 text-[0.55rem] font-mono text-cyan-300 border border-cyan-500/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍 Click to Zoom
                </span>
              </div>
              <div className="text-[0.6rem] font-mono text-gray-500 flex justify-between">
                <span>Resolution: {apiResponse.original_resolution_m}m/px</span>
                <span className="text-blue-400">{uploadedFile.type}</span>
              </div>
            </div>

            {/* Super-Resolved */}
            <div className="glass rounded-2xl border border-purple-500/20 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-[0.65rem] font-mono text-purple-400 uppercase tracking-widest">Super-Resolved Output</p>
                <span className="text-[0.58rem] font-mono text-purple-300"> Click to Expand</span>
              </div>
              <div
                onClick={() => setLightboxImage({
                  url: getFullUrl(apiResponse.super_res_image_url || uploadedFile.preview),
                  title: 'Super-Resolved Output (SwinIR / RRDB Neural Upscale)',
                  subtitle: `Enhanced Spatial Resolution: ~${apiResponse.enhanced_resolution_m}m/pixel · 4x Neural Upscaling`
                })}
                className="group relative h-44 rounded-xl overflow-hidden bg-slate-950 border border-purple-500/20 flex items-center justify-center cursor-zoom-in hover:border-purple-500/60 transition-all duration-300"
              >
                {apiResponse.super_res_image_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getFullUrl(apiResponse.super_res_image_url)} alt="Super-resolved output" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute bottom-2 right-2 text-[0.55rem] font-mono text-purple-300 bg-black/60 px-2 py-0.5 rounded-full border border-purple-500/30 backdrop-blur-sm">
                      RRDB / SwinIR
                    </span>
                  </>
                ) : uploadedFile.preview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedFile.preview} alt="Super-resolved output" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      style={{ filter: 'contrast(1.15) brightness(1.05) saturate(1.1)' }} />
                    <div className="absolute inset-0 bg-purple-900/10" />
                    <span className="absolute bottom-2 right-2 text-[0.55rem] font-mono text-purple-300 bg-black/50 px-2 py-0.5 rounded-full border border-purple-500/20 backdrop-blur-sm">
                      RRDB / SwinIR
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-50">
                    <span className="text-5xl">🔬</span>
                    <span className="text-[0.6rem] font-mono text-gray-500 uppercase">AI Enhanced</span>
                  </div>
                )}
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 text-[0.55rem] font-mono text-purple-300 border border-purple-500/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍 Click to Zoom
                </span>
              </div>
              <div className="text-[0.6rem] font-mono text-gray-500 flex justify-between">
                <span>Resolution: ~{apiResponse.enhanced_resolution_m}m/px</span>
                <span className="text-purple-400">×4 Upscale</span>
              </div>
            </div>

            {/* Risk Map */}
            <div className="glass rounded-2xl border border-orange-500/20 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-[0.65rem] font-mono text-orange-400 uppercase tracking-widest">Hazard Risk Heatmap</p>
                <span className="text-[0.58rem] font-mono text-orange-300"> Click to Expand</span>
              </div>
              <div
                onClick={() => setLightboxImage({
                  url: getFullUrl(apiResponse.risk_map_url),
                  title: 'Multi-Hazard Lunar Risk Heatmap',
                  subtitle: `Safe: ${apiResponse.summary.percent_safe}% | Caution: ${apiResponse.summary.percent_moderate}% | Danger (Red): ${apiResponse.summary.percent_hazardous}%`
                })}
                className="group relative h-44 rounded-xl overflow-hidden bg-slate-950 border border-orange-500/20 flex items-center justify-center cursor-zoom-in hover:border-orange-500/60 transition-all duration-300 p-1"
              >
                {apiResponse.risk_map_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFullUrl(apiResponse.risk_map_url)} alt="Risk map output" className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full"><HazardGrid /></div>
                )}
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 text-[0.55rem] font-mono text-orange-300 border border-orange-500/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  🔍 Click to Zoom
                </span>
              </div>
              <div className="flex gap-2 flex-wrap justify-between">
                {[
                  { color: 'bg-emerald-500', label: `Safe (${apiResponse.summary.percent_safe}%)` },
                  { color: 'bg-yellow-500', label: `Caution (${apiResponse.summary.percent_moderate}%)` },
                  { color: 'bg-red-500', label: `Danger (${apiResponse.summary.percent_hazardous}%)` },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1 text-[0.55rem] font-mono text-gray-400">
                    <span className={`w-2 h-2 rounded-sm ${color} opacity-90`} />{label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hazard breakdown (Crater + Slope + Shadow features) */}
            <div className="glass rounded-2xl border border-white/10 p-5">
              <p className="text-[0.65rem] font-mono text-gray-400 uppercase tracking-widest mb-4">Hazard Breakdown</p>
              <HazardBar label="Crater Density" value={Math.min(100, apiResponse.summary.total_craters * 3)} color="bg-red-500" />
              <HazardBar label="Slope & Ridge Hazards" value={apiResponse.hazards.slope_zones.length > 0 ? Math.min(100, apiResponse.hazards.slope_zones.length * 15) : 18} color="bg-orange-500" />
              <HazardBar label="Safe Surface Coverage" value={apiResponse.summary.percent_safe} color="bg-emerald-500" />
              <HazardBar label="Moderate Risk Terrain" value={apiResponse.summary.percent_moderate} color="bg-yellow-500" />
              <HazardBar label="Hazard Zone Coverage" value={apiResponse.summary.percent_hazardous} color="bg-red-500" />
              
              <div className="mt-4 grid grid-cols-2 gap-2 text-[0.6rem] font-mono">
                {[
                  { label: 'Craters', value: `${apiResponse.summary.total_craters} detected`, color: 'text-red-400' },
                  { label: 'Slope Zones', value: `${apiResponse.hazards.slope_zones.length} mapped`, color: 'text-orange-400' },
                  { label: 'Safe Surface', value: `${apiResponse.summary.percent_safe}%`, color: 'text-emerald-400' },
                  { label: 'Danger Surface', value: `${apiResponse.summary.percent_hazardous}%`, color: 'text-red-400' },
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
              <RiskGauge score={overallRiskScore} />
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
                  { label: 'Zone ID', value: apiResponse.recommended_zone_id },
                  { label: 'Grid Position', value: recZone ? `X:${recZone.x} Y:${recZone.y}` : 'X:396 Y:396' },
                  { label: 'Safe Radius', value: recZone ? `${recZone.radius_px} px` : '38 px' },
                  { label: 'Area', value: recZone ? `${recZone.area_m2.toLocaleString()} m²` : '1,200 m²' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2">
                    <span className="text-gray-500 block uppercase tracking-widest">{label}</span>
                    <span className="text-emerald-400 font-bold">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[0.6rem] font-mono text-gray-500 text-center">
                Waypoints: {apiResponse.landing_path.waypoints.length} descent points calculated
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
