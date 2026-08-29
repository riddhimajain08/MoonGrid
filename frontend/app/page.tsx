'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import InteractiveSpace from '@/components/ui/InteractiveSpace';
import WorkflowTechStack from '@/components/ui/WorkflowTechStack';

// Dynamic import for Spline 3D Hero
const Spline = dynamic(() => import('@splinetool/react-spline'), { 
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#010103] z-0"></div>
});

// Dynamic import for CesiumJS 3D Lunar Hazard Viewer
const LunarCesiumViewer = dynamic(() => import('@/components/cesium/LunarCesiumViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[80vh] flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-white/10">
      <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
      <p className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Loading Cesium 3D Lunar Map Engine...</p>
    </div>
  )
});

type ViewMode = 'hero' | 'cesium' | 'workflow';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('hero');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Loading sequence
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <main 
      className="relative min-h-screen w-full overflow-x-hidden bg-[#010103] text-white selection:bg-cyan-500 selection:text-black" 
      onMouseMove={handleMouseMove}
      ref={containerRef}
    >
      {/* --- Interactive Meteor Space Canvas (Always running behind) --- */}
      <InteractiveSpace />

      {/* --- Loading Screen --- */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#010103] transition-opacity duration-1000">
          <div className="relative w-32 h-32 mb-8 animate-spin-slow">
            <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-[#4a90e2] opacity-50"></div>
            <div className="absolute inset-2 rounded-full border-b-2 border-l-2 border-[#8b5cf6] opacity-70"></div>
            <div className="absolute inset-4 rounded-full border-t-2 border-[#06b6d4] opacity-90"></div>
            {/* Center Moon representation */}
            <div className="absolute inset-8 rounded-full bg-gradient-to-tr from-gray-600 via-gray-300 to-white shadow-[0_0_25px_rgba(255,255,255,0.4)]"></div>
          </div>
          <h2 className="font-heading text-2xl tracking-[0.3em] text-white animate-pulse">INITIATING MoonGrid</h2>
          <p className="text-xs font-mono text-cyan-400 mt-2">Loading 3D Spline & Geospatial Modules...</p>
          <div className="w-64 h-1 mt-6 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#4a90e2] via-[#06b6d4] to-[#8b5cf6] w-full origin-left animate-[scale-x_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
      )}

      {/* --- Spline 3D Background with Balanced Ambient Lighting Mask --- */}
      {activeView === 'hero' && (
        <div className="spline-container transition-opacity duration-1000">
          {/* Ambient lighting mask dampens harsh light/dark spikes from rotating Spline light */}
          <div className="spline-lighting-balancer"></div>
          
          <Spline 
            scene="https://prod.spline.design/H0Ko7h5o9yS34lTv/scene.splinecode"
            onLoad={() => setSplineLoaded(true)}
          />
        </div>
      )}

      {/* --- Main UI Container Layer --- */}
      <div className={`relative z-10 flex flex-col justify-between min-h-screen transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Navigation Bar */}
        <header className="interactive glass sticky top-0 w-full flex justify-between items-center px-6 md:px-12 py-4 z-40 backdrop-blur-xl border-b border-white/10">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveView('hero')}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
              🌑
            </div>
            <div className="flex flex-col">
              <h1 className="font-heading font-black text-2xl md:text-3xl tracking-[8px] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                Moon<span className="text-cyan-400">Grid</span>
              </h1>
              <p className="text-[0.6rem] uppercase tracking-widest text-cyan-300 font-mono">
                Hazard Mapping & 3D Navigation
              </p>
            </div>
          </div>
          
          {/* Main Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-3 bg-slate-950/80 p-1.5 rounded-full border border-white/10 shadow-xl">
            <button 
              onClick={() => setActiveView('hero')}
              className={`px-4 py-2 rounded-full text-xs font-mono font-semibold uppercase tracking-wider transition-all duration-300 ${
                activeView === 'hero'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
               Home 
            </button>

            <button 
              onClick={() => setActiveView('cesium')}
              className={`px-4 py-2 rounded-full text-xs font-mono font-semibold uppercase tracking-wider transition-all duration-300 ${
                activeView === 'cesium'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white shadow-lg shadow-purple-500/20'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Cesium 3D Map
            </button>

            <button 
              onClick={() => setActiveView('workflow')}
              className={`px-4 py-2 rounded-full text-xs font-mono font-semibold uppercase tracking-wider transition-all duration-300 ${
                activeView === 'workflow'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
               ML detection
            </button>
          </nav>
        </header>

        {/* --- DYNAMIC VIEW SWITCHING CONTENT --- */}
        
        {/* VIEW 1: HERO VIEW */}
        {activeView === 'hero' && (
          <div className="flex-1 flex flex-col justify-between py-12 px-4 z-20">
            <main className="flex-1 flex flex-col items-center justify-center text-center my-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md mb-6 animate-fade-in">
              
                <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase"></span>
              </div>

              <div className="animate-slide-up delay-200">
                <h2 className="font-heading font-extrabold text-5xl sm:text-7xl md:text-8xl leading-tight text-gradient">
                  
                </h2>
                <h2 className="font-heading font-black text-6xl sm:text-8xl md:text-9xl leading-none text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]">
                  MoonGrid
                </h2>
              </div>
              
              <p className="mt-6 text-base md:text-lg text-gray-300 max-w-2xl font-light tracking-wide animate-slide-up delay-300">
                  
              </p>
              
              <div className="interactive mt-10 flex flex-col sm:flex-row gap-4 animate-slide-up delay-400">
                <button 
                  onClick={() => setActiveView('cesium')}
                  className="btn-primary glass px-8 py-4 rounded-full text-xs font-mono font-bold tracking-widest uppercase text-white shadow-xl flex items-center justify-center gap-2"
                >
                  <span>Launch 3D Cesium Map</span>
                  <span>➔</span>
                </button>
                <button 
                  onClick={() => setActiveView('workflow')}
                  className="btn-secondary px-8 py-4 rounded-full text-xs font-mono font-bold tracking-widest uppercase text-white flex items-center justify-center gap-2"
                >
                  <span>Explore Architecture</span>
                </button>
              </div>
            </main>

            {/* Bottom Stats & Telemetry Bar */}
            <div className="relative w-full px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center z-20 gap-4 mt-8">
              <div className="interactive glass p-4 rounded-2xl hidden md:flex gap-8 border border-white/10 animate-fade-in delay-500">
                <div className="flex flex-col">
                  <span className="text-[0.6rem] font-mono text-gray-400 tracking-widest uppercase mb-1">Lunar Distance</span>
                  <span className="font-mono text-xs font-bold text-cyan-300">384,400 km</span>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-[0.6rem] font-mono text-gray-400 tracking-widest uppercase mb-1">TMC Sensor Resolution</span>
                  <span className="font-mono text-xs font-bold text-purple-300">5m → 1m Super-Res</span>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-[0.6rem] font-mono text-gray-400 tracking-widest uppercase mb-1">ML Pipeline</span>
                  <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    FastAPI / PyTorch Active
                  </span>
                </div>
              </div>

              {/* Quick Switch Banner */}
              <div className="interactive flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="text-xs font-mono text-gray-400"></span>
                
                <span className="text-gray-600">•</span>
                
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: CESIUMJS 3D LUNAR MAP */}
        {activeView === 'cesium' && (
          <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full z-20 animate-fade-in">
            <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-heading font-black text-white tracking-wider flex items-center gap-3">
                  <span> CESIUMJS 3D LUNAR HAZARD EXPLORER</span>
                </h2>
                <p className="text-xs font-mono text-cyan-400 mt-1">
                  Interactive 3D Moon Surface • Dynamic Hazard Layers • Lander Descent Simulation
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('hero')}
                  className="px-4 py-2 rounded-xl text-xs font-mono bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all"
                >
                  ⬅ Back to 3D Spline Hero
                </button>
              </div>
            </div>

            <LunarCesiumViewer />
          </div>
        )}

        {/* VIEW 3: ML WORKFLOW & TECH STACK */}
        {activeView === 'workflow' && (
          <div className="flex-1 py-8 px-4 z-20 animate-fade-in">
            <WorkflowTechStack />
          </div>
        )}

      </div>

      {/* Mouse Follower Glow */}
      <div 
        className="pointer-events-none fixed z-50 w-8 h-8 rounded-full border border-cyan-400/40 bg-cyan-400/10 mix-blend-screen transition-transform duration-75 ease-out shadow-[0_0_20px_rgba(6,182,212,0.4)] hidden md:block"
        style={{
          transform: `translate(${mousePos.x - 16}px, ${mousePos.y - 16}px)`
        }}
      />
      <div 
        className="pointer-events-none fixed z-50 w-1.5 h-1.5 rounded-full bg-cyan-300 mix-blend-screen transition-transform duration-75 ease-out hidden md:block"
        style={{
          transform: `translate(${mousePos.x - 3}px, ${mousePos.y - 3}px)`
        }}
      />
    </main>
  );
}
