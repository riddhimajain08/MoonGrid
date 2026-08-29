'use client';

import { useEffect, useRef, useState } from 'react';

// Declarations for Cesium global on window
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
    Cesium?: any;
  }
}

interface LandingSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  riskScore: string;
  slope: string;
  desc: string;
}

const LANDING_SITES: LandingSite[] = [
  {
    id: 'shackleton',
    name: 'Shackleton Crater Rim (South Pole)',
    lat: -89.9,
    lon: 0.0,
    alt: 25000,
    riskScore: 'Low (0.12)',
    slope: '2.4°',
    desc: 'Prime candidate site near permanently shadowed regions with high water ice potential.'
  },
  {
    id: 'malapert',
    name: 'Malapert Mountain (South Pole)',
    lat: -84.9,
    lon: 12.9,
    alt: 28000,
    riskScore: 'Low (0.18)',
    slope: '3.1°',
    desc: 'Elevated plateau providing continuous Earth line-of-sight communication.'
  },
  {
    id: 'procellarum',
    name: 'Oceanus Procellarum',
    lat: 18.4,
    lon: -57.4,
    alt: 35000,
    riskScore: 'Very Low (0.08)',
    slope: '1.1°',
    desc: 'Vast, flat basaltic lunar mare with minimal boulder obstruction.'
  },
  {
    id: 'tranquillitatis',
    name: 'Mare Tranquillitatis',
    lat: 0.67,
    lon: 23.47,
    alt: 30000,
    riskScore: 'Low (0.15)',
    slope: '1.8°',
    desc: 'Equatorial region with rich titanium-bearing mare basalts.'
  }
];

export default function LunarCesiumViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isCesiumLoaded, setIsCesiumLoaded] = useState(false);
  const [activeSite, setActiveSite] = useState<LandingSite>(LANDING_SITES[0]);
  
  // Layer toggles
  const [showRiskMap, setShowRiskMap] = useState(true);
  const [showSlope, setShowSlope] = useState(true);
  const [showCraters, setShowCraters] = useState(true);
  const [showBoulders, setShowBoulders] = useState(false);
  const [showShadows, setShowShadows] = useState(false);
  const [superResActive, setSuperResActive] = useState(true);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [telemetry, setTelemetry] = useState({
    altitude: 100000,
    velocity: 1680,
    slope: '2.4°',
    hazardScore: '0.12',
    status: 'ORBITAL ENTRY',
    fuel: 98
  });

  // Dynamic script/CSS loader for CesiumJS
  useEffect(() => {
    window.CESIUM_BASE_URL = '/cesium/';

    // Load Cesium CSS if not loaded
    if (!document.getElementById('cesium-css')) {
      const link = document.createElement('link');
      link.id = 'cesium-css';
      link.rel = 'stylesheet';
      link.href = '/cesium/Widgets/widgets.css';
      document.head.appendChild(link);
    }

    // Function to initialize viewer once script is ready
    const initViewer = () => {
      if (!containerRef.current || viewerRef.current || !window.Cesium) return;

      const Cesium = window.Cesium;

      // Custom Moon ellipsoid & terrain initialization
      const viewer = new Cesium.Viewer(containerRef.current, {
        terrainProvider: new Cesium.EllipsoidTerrainProvider({
          ellipsoid: Cesium.Ellipsoid.MOON
        }),
        imageryProvider: new Cesium.SingleTileImageryProvider({
          url: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Moon_map_with_names.jpg',
          credit: 'NASA / LROC / USGS'
        }),
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      });

      viewerRef.current = viewer;

      // Configure Moon view settings
      const scene = viewer.scene;
      scene.globe.showGroundAtmosphere = false;
      scene.globe.enableLighting = true;
      scene.backgroundColor = Cesium.Color.BLACK;

      // Add custom landing site markers
      LANDING_SITES.forEach((site) => {
        const cartographic = Cesium.Cartographic.fromDegrees(site.lon, site.lat, 5000);
        
        // Entity pin marker
        viewer.entities.add({
          id: site.id,
          position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 2000),
          billboard: {
            image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="%2338bdf8"/></svg>',
            scale: 1.0,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          },
          label: {
            text: site.name,
            font: '12px monospace',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -25),
          },
        });
      });

      // Fly camera to first site
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(activeSite.lon, activeSite.lat, 1500000),
        duration: 2.0
      });

      setIsCesiumLoaded(true);
    };

    if (window.Cesium) {
      initViewer();
    } else {
      const script = document.createElement('script');
      script.id = 'cesium-js';
      script.src = '/cesium/Cesium.js';
      script.onload = () => initViewer();
      document.head.appendChild(script);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Fly to site when active site changes
  const flyToSite = (site: LandingSite) => {
    setActiveSite(site);
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;

    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, site.alt),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60),
        roll: 0.0
      },
      duration: 2.5
    });
  };

  // Launch Lander Simulation
  const startLanderSimulation = () => {
    if (!viewerRef.current || !window.Cesium || isSimulating) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    setIsSimulating(true);

    // Initial high orbit view
    const targetLon = activeSite.lon;
    const targetLat = activeSite.lat;

    let step = 0;
    const totalSteps = 100;

    const interval = setInterval(() => {
      step += 1;
      const progress = step / totalSteps;

      const currentAlt = 100000 * (1 - progress) + 300;
      const currentVel = Math.max(0, Math.floor(1680 * (1 - Math.pow(progress, 0.5))));
      const currentFuel = Math.max(65, Math.floor(98 - progress * 20));

      setTelemetry({
        altitude: Math.floor(currentAlt),
        velocity: currentVel,
        slope: activeSite.slope,
        hazardScore: activeSite.riskScore,
        status: progress < 0.3 ? 'DE-ORBIT BURN' : progress < 0.8 ? 'POWERED DESCENT' : 'TOUCHDOWN HOVER',
        fuel: currentFuel
      });

      // Move camera smoothly down trajectory
      const offsetLat = targetLat + (0.5 * (1 - progress));
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(targetLon, offsetLat, currentAlt),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45 - progress * 40),
          roll: 0
        }
      });

      if (step >= totalSteps) {
        clearInterval(interval);
        setIsSimulating(false);
        setTelemetry(prev => ({ ...prev, status: 'TOUCHDOWN SUCCESS - LOW RISK ZONE' }));
      }
    }, 80);
  };

  return (
    <div className="relative w-full h-[85vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black font-sans">
      
      {/* 3D Cesium Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {!isCesiumLoaded && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
          <h3 className="text-xl font-heading font-bold text-white tracking-widest">INITIALIZING CESIUMJS 3D MOON ENGINE</h3>
          <p className="text-xs font-mono text-cyan-400 mt-2">Loading Lunar Ellipsoid & Spatial Raster Layers...</p>
        </div>
      )}

      {/* Top Floating View Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-center z-20 gap-3 pointer-events-none">
        
        {/* Layer Toggles Ribbon */}
        <div className="pointer-events-auto flex flex-wrap gap-2 p-2 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <button
            onClick={() => setShowRiskMap(!showRiskMap)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              showRiskMap ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
             Risk Heatmap
          </button>

          <button
            onClick={() => setShowSlope(!showSlope)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              showSlope ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
             Slopes
          </button>

          <button
            onClick={() => setShowCraters(!showCraters)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              showCraters ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
             Craters
          </button>

          

          <button
            onClick={() => setShowShadows(!showShadows)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              showShadows ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300' : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            Shadows
          </button>
        </div>

        {/* Super Resolution Toggle */}
        <div className="pointer-events-auto flex items-center gap-2 p-2 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <span className="text-xs font-mono text-gray-300">Resolution Mode:</span>
          <button
            onClick={() => setSuperResActive(!superResActive)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
              superResActive 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-500/30' 
                : 'bg-white/10 border-white/20 text-gray-300'
            }`}
          >
            {superResActive ? '⚡ 1m AI Super-Res (SwinIR)' : '5m Standard TMC'}
          </button>
        </div>

      </div>

      {/* Left Sidebar: Landing Zone Candidates Selector */}
      <div className="absolute top-20 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400">Candidate Landing Sites</h4>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          </div>
          <p className="text-[0.7rem] text-gray-400 font-light mt-0.5">Click site to position 3D camera</p>
        </div>

        <div className="space-y-2">
          {LANDING_SITES.map((site) => {
            const isSelected = site.id === activeSite.id;
            return (
              <button
                key={site.id}
                onClick={() => flyToSite(site)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-gray-100 font-heading">{site.name}</span>
                  <span className="text-[0.65rem] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {site.riskScore}
                  </span>
                </div>
                <p className="text-[0.65rem] text-gray-400 mt-1 line-clamp-2">{site.desc}</p>
                <div className="flex gap-3 mt-2 text-[0.6rem] font-mono text-cyan-300">
                  <span>Lat: {site.lat}°</span>
                  <span>Lon: {site.lon}°</span>
                  <span>Slope: {site.slope}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Button: Simulate Navigation */}
        <button
          onClick={startLanderSimulation}
          disabled={isSimulating}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50"
        >
          {isSimulating ? '🚀 SIMULATING DESCENT TRAJECTORY...' : '🛸 SIMULATE LANDER NAVIGATION'}
        </button>
      </div>

      {/* Right Sidebar: Real-time Flight Telemetry HUD */}
      <div className="absolute top-20 right-4 z-20 w-72 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400">DESCENT TELEMETRY HUD</h4>
          <span className="text-[0.65rem] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
            {telemetry.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-[0.65rem] font-mono text-gray-400 uppercase">Altitude</span>
            <div className="text-sm font-mono font-bold text-cyan-300 mt-0.5">
              {telemetry.altitude.toLocaleString()} m
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-[0.65rem] font-mono text-gray-400 uppercase">Descent Speed</span>
            <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
              {telemetry.velocity} m/s
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-[0.65rem] font-mono text-gray-400 uppercase">Local Slope</span>
            <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
              {telemetry.slope}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-[0.65rem] font-mono text-gray-400 uppercase">Risk Index</span>
            <div className="text-sm font-mono font-bold text-rose-300 mt-0.5">
              {telemetry.hazardScore}
            </div>
          </div>
        </div>

        {/* Fuel Gauge */}
        <div className="space-y-1">
          <div className="flex justify-between text-[0.65rem] font-mono text-gray-400">
            <span>RCS Fuel Level</span>
            <span>{telemetry.fuel}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" 
              style={{ width: `${telemetry.fuel}%` }}
            />
          </div>
        </div>

        {/* ML & Backend FastAPI API Contract Banner */}
        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-[0.65rem] font-mono space-y-1">
          <div className="flex items-center justify-between text-blue-300 font-bold">
            <span>FastAPI ML Backend</span>
            <span className="text-emerald-400">● READY</span>
          </div>
          <p className="text-gray-400">Endpoints: <code className="text-cyan-300">/api/v1/hazard-map</code></p>
          <p className="text-gray-400">PostGIS Index: <code className="text-cyan-300">EPSG:30100 (Moon)</code></p>
        </div>

      </div>

      {/* Bottom Hazard Legend Ribbon */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-6 py-2 rounded-full bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-xs font-mono text-white">
        <span className="text-gray-400">Hazard Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span>Safe (&lt;0.2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span>Caution (0.2 - 0.5)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500"></span>
          <span>Severe Hazard (&gt;0.5)</span>
        </div>
      </div>

    </div>
  );
}
