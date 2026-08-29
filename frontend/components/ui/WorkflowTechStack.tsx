'use client';

import { useState } from 'react';

const WORKFLOW_STEPS = [
  {
    id: 1,
    title: 'Data Ingestion',
    subtitle: '5m TMC Lunar Imagery',
    color: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/40',
    glowColor: 'shadow-blue-500/20',
    textColor: 'text-blue-400',
    bgBadge: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    desc: 'Importing high-resolution 5-meter Terrain Mapping Camera (TMC) lunar orbital datasets into PostGIS database clusters.',
    bulletPoints: [
      'Import 5m resolution TMC orbital imagery',
      'Geospatial metadata parsing & spatial indexing',
      'PostgreSQL / PostGIS raster cloud storage'
    ],
    tech: ['PostgreSQL', 'PostGIS', 'GDAL']
  },
  {
    id: 2,
    title: 'Preprocessing',
    subtitle: 'Noise & Spatial Alignment',
    color: 'from-cyan-500/20 to-teal-500/20',
    borderColor: 'border-cyan-500/40',
    glowColor: 'shadow-cyan-500/20',
    textColor: 'text-cyan-400',
    bgBadge: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    desc: 'Standardizing raw lunar raster tiles with automated radiometric normalization and terrain mesh alignment.',
    bulletPoints: [
      'Noise removal & radiometric calibration',
      'Histogram equalization & normalization',
      'Tile splitting & geospatial projection alignment'
    ],
    tech: ['GDAL', 'Rasterio', 'GeoPandas', 'Shapely']
  },
  {
    id: 3,
    title: 'Super-Resolution',
    subtitle: '5m → ~1m Resolution',
    color: 'from-purple-500/20 to-indigo-500/20',
    borderColor: 'border-purple-500/40',
    glowColor: 'shadow-purple-500/20',
    textColor: 'text-purple-400',
    bgBadge: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    desc: 'Deep learning upscaling models increase spatial fidelity to reveal sub-meter lunar surface details.',
    bulletPoints: [
      'Deep Residual Transformer models (SwinIR / ESRGAN)',
      'Sub-pixel feature reconstruction',
      'High-resolution terrain representation synthesis'
    ],
    tech: ['PyTorch', 'OpenCV', 'NumPy', 'SwinIR']
  },
  {
    id: 4,
    title: 'Hazard Detection',
    subtitle: 'Multi-class Surface Hazards',
    color: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/40',
    glowColor: 'shadow-amber-500/20',
    textColor: 'text-amber-400',
    bgBadge: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    desc: 'Computer vision segmentation networks classify micro-craters, steep slopes, boulder fields, and deep shadows.',
    bulletPoints: [
      'Detect steep slope gradients ≥ 10°',
      'Detect crater rims, depth & diameter profiles',
      'Detect boulder distribution & shadow occlusion layers'
    ],
    tech: ['YOLO', 'U-Net', 'SegFormer', 'OpenCV']
  },
  {
    id: 5,
    title: 'Risk Mapping',
    subtitle: 'Composite Safety Score Map',
    color: 'from-emerald-500/20 to-green-500/20',
    borderColor: 'border-emerald-500/40',
    glowColor: 'shadow-emerald-500/20',
    textColor: 'text-emerald-400',
    bgBadge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    desc: 'Aggregating individual hazard rasters into a weighted risk score matrix for every 1m grid cell.',
    bulletPoints: [
      '🟢 Low Risk Zones (Safe descent zones)',
      '🟡 Medium Risk Zones (Cautionary terrain)',
      '🔴 High Risk Zones (Severe hazard clusters)'
    ],
    tech: ['NumPy', 'GeoPandas', 'SciPy']
  },
  {
    id: 6,
    title: 'Landing Selection',
    subtitle: 'Safe Zone & Trajectory',
    color: 'from-rose-500/20 to-pink-500/20',
    borderColor: 'border-rose-500/40',
    glowColor: 'shadow-rose-500/20',
    textColor: 'text-rose-400',
    bgBadge: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    desc: 'Evaluating spatial continuity for optimal touchdown sites and rendering 3D lander guidance paths in CesiumJS.',
    bulletPoints: [
      'Identify contiguous low-risk landing ellipses',
      'Rank landing sites by slope & proximity constraint',
      'Simulate lander navigation trajectory in 3D CesiumJS'
    ],
    tech: ['PostgreSQL', 'PostGIS', 'CesiumJS']
  }
];

const TECH_STACK_CATEGORIES = [
  {
    category: 'AI / ML & Computer Vision',
    icon: '🧠',
    techs: ['PyTorch', 'SwinIR / ESRGAN', 'U-Net / SegFormer', 'YOLO v8', 'OpenCV', 'NumPy', 'Scikit-Learn']
  },
  {
    category: 'Geospatial & Database',
    icon: '🌍',
    techs: ['PostgreSQL', 'PostGIS', 'GDAL', 'Rasterio', 'GeoPandas', 'Shapely']
  },
  {
    category: 'Backend & APIs',
    icon: '⚡',
    techs: ['Python', 'FastAPI', 'REST APIs', 'Async Worker Queues']
  },
  {
    category: 'Frontend & 3D Visualization',
    icon: '🚀',
    techs: ['Next.js (React 19)', 'TypeScript', 'Tailwind CSS', 'CesiumJS 3D', 'Spline 3D']
  }
];

export default function WorkflowTechStack() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const stepData = WORKFLOW_STEPS.find(s => s.id === activeStep) || WORKFLOW_STEPS[0];

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 text-white">
      
      {/* Title Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md mb-4">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">System Architecture & Pipeline</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black font-heading tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-cyan-300">
          LUNAR HAZARD MAPPING WORKFLOW
        </h2>
        <p className="mt-3 text-gray-400 font-light max-w-2xl mx-auto text-sm md:text-base">
          End-to-End Geospatial AI Pipeline: From 5m orbital imagery ingestion to 1m super-resolution hazard detection and 3D lander navigation.
        </p>
      </div>

      {/* Step Selector Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {WORKFLOW_STEPS.map((step) => {
          const isActive = step.id === activeStep;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`relative p-4 rounded-xl border text-left transition-all duration-300 flex flex-col justify-between ${
                isActive
                  ? `bg-gradient-to-b ${step.color} ${step.borderColor} shadow-lg ${step.glowColor} scale-[1.03] z-10`
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-center w-full mb-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                  isActive ? 'bg-white text-gray-900 shadow-md' : 'bg-white/10 text-gray-400'
                }`}>
                  {step.id}
                </span>
                {isActive && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>}
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-200 line-clamp-1">{step.title}</h4>
                <p className="text-[0.65rem] text-gray-400 font-mono mt-0.5">{step.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Step Detailed View Card */}
      <div className={`p-8 rounded-2xl border ${stepData.borderColor} bg-gradient-to-br from-slate-950/80 via-slate-900/90 to-black/80 backdrop-blur-xl shadow-2xl transition-all duration-500 mb-16`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-mono border font-semibold ${stepData.bgBadge}`}>
                STEP {stepData.id} OF 6
              </span>
              <h3 className="text-2xl md:text-3xl font-heading font-bold text-white tracking-wide">
                {stepData.title} <span className="text-gray-400 font-normal text-lg">({stepData.subtitle})</span>
              </h3>
            </div>
            
            <p className="text-gray-300 text-sm md:text-base leading-relaxed font-light">
              {stepData.desc}
            </p>

            <div className="space-y-2 pt-2">
              <h5 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Key Workflow Objectives:</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stepData.bulletPoints.map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-200 bg-white/5 p-2.5 rounded-lg border border-white/5">
                    <span className="text-cyan-400 font-mono">▸</span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3">
              <span className="text-xs font-mono text-gray-400 mr-2 uppercase tracking-wider">Tech Stack Used:</span>
              {stepData.tech.map((t) => (
                <span key={t} className="px-3 py-1 rounded-md text-xs font-mono bg-white/10 text-cyan-200 border border-cyan-500/30">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Visual Graphic Simulation */}
          <div className="relative p-6 rounded-xl border border-white/10 bg-black/50 flex flex-col items-center justify-center min-h-[220px]">
            {stepData.id === 1 && (
              <div className="space-y-3 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center mx-auto animate-pulse">
                  <span className="text-3xl">📡</span>
                </div>
                <div className="text-xs font-mono text-blue-300">5m TMC Sensor Feed</div>
                <div className="text-[0.65rem] text-gray-400 bg-blue-950/60 px-3 py-1 rounded border border-blue-500/30">PostgreSQL / PostGIS Cloud Sync Active</div>
              </div>
            )}

            {stepData.id === 2 && (
              <div className="space-y-3 text-center w-full">
                <div className="grid grid-cols-3 gap-1.5 max-w-[150px] mx-auto opacity-80">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="aspect-square bg-cyan-500/20 border border-cyan-400/30 rounded flex items-center justify-center text-[0.6rem] font-mono text-cyan-300">
                      Tile {i+1}
                    </div>
                  ))}
                </div>
                <div className="text-xs font-mono text-cyan-300">Geospatial Tiling & Normalization</div>
              </div>
            )}

            {stepData.id === 3 && (
              <div className="space-y-3 text-center w-full">
                <div className="flex items-center justify-center gap-3">
                  <div className="px-3 py-2 bg-gray-800 rounded text-xs font-mono text-gray-400 border border-gray-700">5m Raw</div>
                  <span className="text-purple-400 font-bold">➔ SwinIR ➔</span>
                  <div className="px-3 py-2 bg-purple-900/60 rounded text-xs font-mono text-purple-200 border border-purple-400 animate-pulse">~1m High-Res</div>
                </div>
                <div className="text-xs font-mono text-purple-300">Super-Resolution Deep Learning</div>
              </div>
            )}

            {stepData.id === 4 && (
              <div className="space-y-2 text-center w-full">
                <div className="flex justify-center gap-2 text-xs font-mono">
                  <span className="px-2 py-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded">Slopes ≥10°</span>
                  <span className="px-2 py-1 bg-orange-500/20 border border-orange-400/40 text-orange-300 rounded">Craters</span>
                  <span className="px-2 py-1 bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 rounded">Boulders</span>
                </div>
                <div className="text-xs font-mono text-amber-300 mt-2">YOLO / SegFormer Multi-Class AI</div>
              </div>
            )}

            {stepData.id === 5 && (
              <div className="space-y-2 text-center w-full">
                <div className="flex justify-center items-center gap-3 font-mono text-xs">
                  <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded">Low Risk</span>
                  <span className="px-2 py-1 bg-yellow-500/20 border border-yellow-500 text-yellow-400 rounded">Med Risk</span>
                  <span className="px-2 py-1 bg-red-500/20 border border-red-500 text-red-400 rounded">High Risk</span>
                </div>
                <div className="text-xs font-mono text-emerald-300 mt-2">1m Grid Risk Score Matrix</div>
              </div>
            )}

            {stepData.id === 6 && (
              <div className="space-y-3 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-400 flex items-center justify-center mx-auto animate-bounce">
                  <span className="text-2xl">🛸</span>
                </div>
                <div className="text-xs font-mono text-rose-300">CesiumJS 3D Lander Trajectory</div>
                <span className="text-[0.65rem] bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/40 font-mono">
                  Safe Landing Target Locked
                </span>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Tech Stack Summary Section */}
      <div className="mt-16">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold font-heading tracking-wider text-white">
            PROJECT TECH STACK OVERVIEW
          </h3>
          <p className="text-xs font-mono text-gray-400 mt-1 uppercase tracking-widest">
            High-Performance Modular Tech Ecosystem
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TECH_STACK_CATEGORIES.map((cat, idx) => (
            <div key={idx} className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:border-cyan-500/40 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl group-hover:scale-125 transition-transform duration-300">{cat.icon}</span>
                  <h4 className="text-sm font-semibold font-heading text-gray-200 tracking-wider">{cat.category}</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cat.techs.map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded bg-black/60 border border-white/10 text-xs font-mono text-cyan-200 group-hover:border-cyan-500/30 transition-colors">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between text-[0.65rem] font-mono text-gray-400">
                <span>MODULE READY</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
