'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Application } from '@splinetool/runtime';
import InteractiveSpace from '@/components/ui/InteractiveSpace';
import LunarImageAnalysis from '@/components/ui/LunarImageAnalysis';

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
  const [activeView, setActiveView] = useState<ViewMode>('hero');
  const mousePosRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const splineAppRef = useRef<Application | null>(null);

  // Loading sequence
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  return (
    <main
      className="relative min-h-screen w-full overflow-x-hidden bg-[#010103] text-white selection:bg-cyan-500 selection:text-black"
      onMouseMove={handleMouseMove}
      ref={containerRef}
    >
      {/* --- Interactive Meteor Space Canvas --- */}
      <InteractiveSpace />

      {/* --- Loading Screen --- */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020408]">
          <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-sky-400/40 animate-spin-slow"></div>
            <div className="absolute -inset-2 rounded-full border border-slate-500/30 animate-[spin-slow_15s_linear_infinite_reverse]"></div>
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/30 shadow-[0_0_35px_rgba(56,189,248,0.35)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png"
                alt="MoonGrid Logo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <h2 className="font-heading text-2xl tracking-[0.3em] text-white animate-pulse">INITIATING MoonGrid</h2>
          <div className="w-64 h-1 mt-6 bg-slate-800/80 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-slate-400 via-sky-400 to-slate-200 w-full origin-left animate-[scale-x_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
      )}

      {/* --- Spline 3D Background (Magnetic Moon Rotation) --- */}
      {activeView === 'hero' && (
        <div className="spline-container transition-opacity duration-1000">
          <div className="spline-lighting-balancer"></div>
          <Spline
            scene="https://prod.spline.design/H0Ko7h5o9yS34lTv/scene.splinecode"
            onLoad={(app: Application) => {
              splineAppRef.current = app;
            }}
          />
        </div>
      )}

      {/* --- Main UI Container Layer --- */}
      <div className={`relative z-10 flex flex-col justify-between min-h-screen transition-opacity duration-700 pointer-events-none ${isLoading ? 'opacity-0' : 'opacity-100'}`}>

        {/* Navigation Bar */}
        <header className="interactive pointer-events-auto glass sticky top-0 w-full flex justify-between items-center px-6 md:px-12 py-4 z-40 backdrop-blur-xl border-b border-white/10">
          <div
            className="flex items-center gap-3.5 cursor-pointer group"
            onClick={() => setActiveView('hero')}
          >
            <div className="relative w-11 h-11 rounded-full overflow-hidden border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.35)] group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(255,255,255,0.7)] transition-all duration-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.png"
                alt="MoonGrid MG Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="font-serif font-bold text-4xl md:text-3xl tracking-wide text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.75)]">
                MoonGrid
              </h1>

            </div>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-950/85 p-1.5 rounded-full border border-white/10 shadow-xl">
            <button
              onClick={() => setActiveView('hero')}
              className={`px-4 py-2 rounded-full text-xs font-mono font-semibold uppercase tracking-wider transition-all duration-300 ${activeView === 'hero'
                ? 'bg-sky-500/20 border border-sky-400/40 text-sky-200 shadow-md shadow-sky-500/15'
                : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              Home
            </button>

            <button
              onClick={() => setActiveView('cesium')}
              className={`px-4 py-2 rounded-full text-xs font-mono font-semibold uppercase tracking-wider transition-all duration-300 ${activeView === 'cesium'
                ? 'bg-sky-500/20 border border-sky-400/40 text-sky-200 shadow-md shadow-sky-500/15'
                : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              3D Map
            </button>

            <button
              onClick={() => setActiveView('workflow')}
              className={`px-4 py-2 rounded-full text-xs font-mono font-semibold uppercase tracking-wider transition-all duration-300 ${activeView === 'workflow'
                ? 'bg-sky-500/20 border border-sky-400/40 text-sky-200 shadow-md shadow-sky-500/15'
                : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
            >
              Image Analysis
            </button>
          </nav>
        </header>

        {/* --- DYNAMIC VIEW SWITCHING CONTENT --- */}

        {/* VIEW 1: HERO */}
        {activeView === 'hero' && (
          <div className="flex-1 flex flex-col justify-between py-12 px-4 z-20 pointer-events-none">
            <main className="flex-1 flex flex-col items-center justify-center text-center my-auto">
              <div className="animate-slide-up delay-200">
                <h2 className="font-heading font-black text-6xl sm:text-8xl md:text-9xl leading-none text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]">
                  MoonGrid
                </h2>
              </div>

              <p className="mt-6 text-base md:text-lg text-gray-300 max-w-2xl font-light tracking-wide animate-slide-up delay-300">
                AI-powered lunar hazard mapping &amp; safe landing zone detection
              </p>

              <div className="interactive pointer-events-auto mt-10 flex flex-col sm:flex-row gap-4 animate-slide-up delay-400">
                <button
                  onClick={() => setActiveView('cesium')}
                  className="btn-secondary px-8 py-4 rounded-full text-xs font-mono font-bold tracking-widest uppercase text-white flex items-center justify-center gap-2"
                >
                  <span>Launch 3D Map</span>
                  <span></span>
                </button>
                <button
                  onClick={() => setActiveView('workflow')}
                  className="btn-secondary px-8 py-4 rounded-full text-xs font-mono font-bold tracking-widest uppercase text-white flex items-center justify-center gap-2"
                >
                  <span> Image Analysis</span>
                </button>
              </div>
            </main>

            {/* Bottom Stats Bar */}
            <div className="relative w-full px-4 md:px-8 py-4 flex justify-start items-center z-20 mt-8 pointer-events-none">
              <div className="interactive pointer-events-auto glass px-6 py-3 rounded-2xl hidden md:flex border border-white/10 animate-fade-in delay-500">
                <div className="flex flex-col">
                  <span className="text-[0.6rem] font-mono text-gray-400 tracking-widest uppercase mb-1">Lunar Distance</span>
                  <span className="font-mono text-xs font-bold text-cyan-300">384,400 km</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: CESIUMJS 3D LUNAR MAP */}
        {activeView === 'cesium' && (
          <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full z-20 animate-fade-in pointer-events-auto">
            <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-heading font-black text-white tracking-wider flex items-center gap-3">
                  <span>3D LUNAR HAZARD EXPLORER</span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('hero')}
                  className="btn-secondary px-6 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-white border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-1.5 shadow-lg"
                >
                  ⬅ Home
                </button>
              </div>
            </div>

            <LunarCesiumViewer />
          </div>
        )}

        {/* VIEW 3: LUNAR IMAGE ANALYSIS */}
        {activeView === 'workflow' && (
          <div className="flex-1 py-8 px-4 z-20 animate-fade-in pointer-events-auto">
            <LunarImageAnalysis />
          </div>
        )}

      </div>
    </main>
  );
}
