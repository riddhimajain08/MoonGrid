'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window { CESIUM_BASE_URL?: string; Cesium?: any; }
}

interface LandingSite {
  id: string; name: string; lat: number; lon: number; alt: number;
  riskScore: string; slope: string; desc: string;
}

const LANDING_SITES: LandingSite[] = [
  { id: 'shackleton',     name: 'Shackleton Crater Rim (South Pole)', lat: -89.9, lon:   0.0, alt: 400000, riskScore: 'Low (0.12)',      slope: '2.4', desc: 'Prime candidate site near permanently shadowed regions with high water ice potential.' },
  { id: 'malapert',       name: 'Malapert Mountain (South Pole)',     lat: -84.9, lon:  12.9, alt: 350000, riskScore: 'Low (0.18)',      slope: '3.1', desc: 'Elevated plateau providing continuous Earth line-of-sight communication.' },
  { id: 'procellarum',    name: 'Oceanus Procellarum',                lat:  18.4, lon: -57.4, alt: 300000, riskScore: 'Very Low (0.08)', slope: '1.1', desc: 'Vast, flat basaltic lunar mare with minimal boulder obstruction.' },
  { id: 'tranquillitatis',name: 'Mare Tranquillitatis',               lat:   0.67, lon: 23.47, alt: 300000, riskScore: 'Low (0.15)',      slope: '1.8', desc: 'Equatorial region with rich titanium-bearing mare basalts.' },
];

const MARKER_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="%2338bdf8"/></svg>';
const ROCKET_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><polygon points="16,2 8,18 24,18" fill="%23f0f0f0" stroke="%2338bdf8" stroke-width="1.5"/><rect x="9" y="17" width="14" height="15" fill="%23ddd" rx="2" stroke="%23aaa" stroke-width="0.5"/><polygon points="5,32 9,17 5,17" fill="%23bbb"/><polygon points="27,32 23,17 27,17" fill="%23bbb"/><circle cx="16" cy="25" r="4" fill="%2338bdf8" opacity="0.9"/><rect x="12" y="31" width="8" height="5" fill="%23ccc" rx="1"/></svg>';

export default function LunarCesiumViewer() {
  const containerRef        = useRef<HTMLDivElement>(null);
  const viewerRef           = useRef<any>(null);
  const flyTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landerEntityRef     = useRef<any>(null);
  const trajectoryEntityRef = useRef<any>(null);
  const thrusterEntityRef   = useRef<any>(null);
  const trajectoryPtsRef    = useRef<any[]>([]);
  const simIntervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const simStepRef          = useRef<number>(0);

  const [isCesiumLoaded, setIsCesiumLoaded] = useState(false);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [activeSite,     setActiveSite]     = useState<LandingSite>(LANDING_SITES[0]);
  const [showRiskMap,    setShowRiskMap]    = useState(true);
  const [showSlope,      setShowSlope]      = useState(true);
  const [showCraters,    setShowCraters]    = useState(true);
  const [showShadows,    setShowShadows]    = useState(false);
  const [superResActive, setSuperResActive] = useState(true);
  const [isSimulating,   setIsSimulating]   = useState(false);
  const [telemetry, setTelemetry] = useState({
    altitude: 100000, velocity: 1680, slope: '2.4 deg',
    hazardScore: '0.12', status: 'ORBITAL ENTRY', fuel: 98,
  });
  const [telemetryHistory, setTelemetryHistory] = useState<{ alt: number; vel: number }[]>([
    { alt: 100000, vel: 1680 },
    { alt: 95000, vel: 1650 },
    { alt: 88000, vel: 1590 },
    { alt: 80000, vel: 1510 },
    { alt: 70000, vel: 1400 },
  ]);

  useEffect(() => {
    let destroyed = false;
    window.CESIUM_BASE_URL = '/cesium/';

    if (!document.getElementById('cesium-css')) {
      const link = document.createElement('link');
      link.id = 'cesium-css'; link.rel = 'stylesheet';
      link.href = '/cesium/Widgets/widgets.css';
      document.head.appendChild(link);
    }

    const initViewer = () => {
      if (destroyed || !containerRef.current || viewerRef.current || !window.Cesium) return;
      const Cesium = window.Cesium;

      try {
        // Moon ellipsoid (radius ~1737 km vs Earth 6371 km)
        const moonEllipsoid = Cesium.Ellipsoid.MOON ||
          new Cesium.Ellipsoid(1737400.0, 1737400.0, 1735800.0);

        const viewer = new Cesium.Viewer(containerRef.current, {
          // Use equirectangular Moon map as primary imagery texture
          imageryProvider: new Cesium.SingleTileImageryProvider({
            url: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Moon_map_with_names.jpg',
            credit: 'NASA / USGS / LROC'
          }),
          terrainProvider: new Cesium.EllipsoidTerrainProvider({ ellipsoid: moonEllipsoid }),
          skyAtmosphere:        false,
          skyBox:               false,
          timeline:             false,
          animation:            false,
          baseLayerPicker:      false,
          geocoder:             false,
          homeButton:           false,
          sceneModePicker:      false,
          navigationHelpButton: false,
          fullscreenButton:     false,
          infoBox:              false,
          selectionIndicator:   false,
        });

        viewerRef.current = viewer;
        const scene = viewer.scene;

        scene.globe.enableLighting       = true;
        scene.globe.showGroundAtmosphere = false;
        scene.backgroundColor            = Cesium.Color.BLACK;
        scene.globe.baseColor            = Cesium.Color.fromCssColorString('#888888');

        // Add landing site markers
        LANDING_SITES.forEach((site) => {
          viewer.entities.add({
            id:       site.id,
            position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 2000),
            billboard: {
              image:  MARKER_SVG,
              scale:  1.0,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text:         site.name,
              font:         '11px monospace',
              fillColor:    Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style:        Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset:  new Cesium.Cartesian2(0, -28),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        });

        // Initial orbital overview
        setTimeout(() => {
          if (destroyed || !viewerRef.current) return;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(0, -15, 3200000),
            orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
            duration: 2.5,
          });
        }, 600);

        if (!destroyed) setIsCesiumLoaded(true);
      } catch (err: any) {
        console.error('Cesium init error:', err);
        if (!destroyed) setLoadError(err?.message ?? 'Failed to initialize 3D viewer');
      }
    };

    if (window.Cesium) {
      initViewer();
    } else if (document.getElementById('cesium-js')) {
      document.getElementById('cesium-js')!.addEventListener('load', initViewer, { once: true });
    } else {
      const script   = document.createElement('script');
      script.id      = 'cesium-js';
      script.src     = '/cesium/Cesium.js';
      script.async   = true;
      script.onload  = () => initViewer();
      script.onerror = () => { if (!destroyed) setLoadError('Failed to load CesiumJS from /cesium/Cesium.js'); };
      document.head.appendChild(script);
    }

    return () => {
      destroyed = true;
      if (flyTimerRef.current)  clearTimeout(flyTimerRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // ── fly to site (debounced + cancelFlight) ──────────────────────────────
  const flyToSite = useCallback((site: LandingSite) => {
    setActiveSite(site);
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    try { viewer.camera.cancelFlight(); } catch {}

    flyTimerRef.current = setTimeout(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
      try {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, site.alt),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-55), roll: 0 },
          duration: 2.2,
          easingFunction: Cesium.EasingFunction.QUARTIC_IN_OUT,
        });
      } catch {}
    }, 60);
  }, []);

  // ── clear simulation entities ────────────────────────────────────────────
  const clearSimEntities = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const remove = (ref: React.MutableRefObject<any>) => {
      try { if (ref.current) viewer.entities.remove(ref.current); } catch {}
      ref.current = null;
    };
    remove(landerEntityRef);
    remove(trajectoryEntityRef);
    remove(thrusterEntityRef);
    trajectoryPtsRef.current = [];
    simStepRef.current = 0;
  }, []);

  // ── lander simulation ────────────────────────────────────────────────────
  const startLanderSimulation = useCallback(() => {
    if (!viewerRef.current || viewerRef.current.isDestroyed() || !window.Cesium || isSimulating) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    const site   = activeSite;

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    clearSimEntities();
    setIsSimulating(true);
    setTelemetryHistory([{ alt: 150000, vel: 1680 }]);

    const totalSteps = 180;
    simStepRef.current = 0;

    // ── Trajectory line ──
    const trajEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() =>
          trajectoryPtsRef.current.length >= 2
            ? trajectoryPtsRef.current
            : [
                Cesium.Cartesian3.fromDegrees(site.lon, site.lat + 0.5, 150000),
                Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 500),
              ]
        , false),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.7,
          taperPower: 0.6,
          color: Cesium.Color.CYAN.withAlpha(0.9),
        }),
        arcType: Cesium.ArcType.NONE,
      },
    });
    trajectoryEntityRef.current = trajEntity;

    // ── Lander billboard ──
    const initPos = Cesium.Cartesian3.fromDegrees(site.lon, site.lat + 0.5, 150000);
    const lander  = viewer.entities.add({
      id:       'lander_active',
      position: initPos,
      billboard: {
        image:          ROCKET_SVG,
        scale:          1.6,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    landerEntityRef.current = lander;

    // ── Thruster glow point ──
    const thruster = viewer.entities.add({
      id:       'thruster_active',
      position: initPos,
      point: {
        pixelSize:    24,
        color:        Cesium.Color.ORANGE.withAlpha(0.85),
        outlineColor: Cesium.Color.YELLOW.withAlpha(0.6),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    thrusterEntityRef.current = thruster;

    // Initial camera: wide orbital approach shot
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(site.lon - 1.0, site.lat + 1.2, 450000),
        orientation: { heading: Cesium.Math.toRadians(25), pitch: Cesium.Math.toRadians(-22), roll: 0 },
        duration: 1.8,
      });
    } catch {}

    const interval = setInterval(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) { clearInterval(interval); return; }

      simStepRef.current++;
      const s     = simStepRef.current;
      const p     = s / totalSteps;
      // Ease-in: faster from orbit, slows near surface
      const eased = 1 - Math.pow(1 - p, 2.8);
      const alt   = Math.max(100, 150_000 * (1 - eased));
      const lat   = site.lat + 0.5 * (1 - p);
      const vel   = Math.max(0, Math.floor(1680 * (1 - Math.sqrt(p))));
      const fuel  = Math.max(65, Math.floor(98 - p * 22));
      const phase =
        p < 0.30 ? 'DE-ORBIT BURN'    :
        p < 0.75 ? 'POWERED DESCENT'  : 'TOUCHDOWN HOVER';

      // Update positions
      try {
        const newPos       = Cesium.Cartesian3.fromDegrees(site.lon, lat, alt);
        const thrusterPos  = Cesium.Cartesian3.fromDegrees(site.lon, lat, Math.max(50, alt - 300));
        lander.position    = new Cesium.ConstantPositionProperty(newPos);
        thruster.position  = new Cesium.ConstantPositionProperty(thrusterPos);

        // Thruster color changes by phase
        const tc =
          p < 0.30 ? Cesium.Color.fromCssColorString('rgba(100,180,255,0.9)') :
          p < 0.75 ? Cesium.Color.fromCssColorString('rgba(255,150,30,0.95)') :
                     Cesium.Color.fromCssColorString('rgba(255,80,20,0.8)');
        thruster.point.color    = tc;
        thruster.point.pixelSize = 16 + Math.sin(s * 0.4) * 8;

        // Record trajectory every 2 steps
        if (s % 2 === 0) trajectoryPtsRef.current.push(newPos);

        // Camera follows — update every 6 steps to stay smooth
        if (s % 6 === 0) {
          const camDist = 6000 + alt * 0.42;
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              site.lon - 0.05,
              lat + (camDist / 111320) * 0.85,
              alt + camDist * 0.92
            ),
            orientation: {
              heading: Cesium.Math.toRadians(12),
              pitch:   Cesium.Math.toRadians(-22 - eased * 38),
              roll:    0,
            },
          });
        }
      } catch {}

      setTelemetry({ altitude: Math.floor(alt), velocity: vel, slope: `${site.slope} deg`, hazardScore: site.riskScore, status: phase, fuel });
      
      // Update telemetry history graph every 3 steps
      if (s % 3 === 0) {
        setTelemetryHistory(prev => [...prev.slice(-35), { alt: Math.floor(alt), vel }]);
      }

      if (s >= totalSteps) {
        clearInterval(interval);
        setIsSimulating(false);
        setTelemetry(prev => ({ ...prev, status: 'TOUCHDOWN SUCCESS -- LOW RISK ZONE', altitude: 0, velocity: 0 }));
        setTelemetryHistory(prev => [...prev, { alt: 0, vel: 0 }]);

        // Remove thruster glow
        try {
          if (thrusterEntityRef.current && !viewer.isDestroyed()) {
            viewer.entities.remove(thrusterEntityRef.current);
            thrusterEntityRef.current = null;
          }
        } catch {}

        // Dramatic close-up flyby of landing site
        try {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(site.lon + 0.04, site.lat + 0.03, 7500),
            orientation: { heading: Cesium.Math.toRadians(-18), pitch: Cesium.Math.toRadians(-48), roll: 0 },
            duration: 3.5,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
          });
        } catch {}
      }
    }, 80);

    simIntervalRef.current = interval;
  }, [activeSite, isSimulating, clearSimEntities]);

  // Compute SVG sparkline coordinates
  const svgWidth = 240;
  const svgHeight = 64;
  const maxGraphAlt = 150000;
  const maxGraphVel = 1680;

  const pointsCount = Math.max(telemetryHistory.length, 2);
  const altPathPoints = telemetryHistory.map((pt, i) => {
    const x = (i / (pointsCount - 1)) * svgWidth;
    const y = svgHeight - (Math.min(pt.alt, maxGraphAlt) / maxGraphAlt) * (svgHeight - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const velPathPoints = telemetryHistory.map((pt, i) => {
    const x = (i / (pointsCount - 1)) * svgWidth;
    const y = svgHeight - (Math.min(pt.vel, maxGraphVel) / maxGraphVel) * (svgHeight - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const latestPtIndex = telemetryHistory.length - 1;
  const latestX = ((latestPtIndex) / (pointsCount - 1)) * svgWidth;
  const latestAltY = svgHeight - (Math.min(telemetryHistory[latestPtIndex]?.alt ?? 0, maxGraphAlt) / maxGraphAlt) * (svgHeight - 10) - 5;
  const latestVelY = svgHeight - (Math.min(telemetryHistory[latestPtIndex]?.vel ?? 0, maxGraphVel) / maxGraphVel) * (svgHeight - 10) - 5;

  return (
    <div className="relative w-full h-[85vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black font-sans">
      <div ref={containerRef} className="w-full h-full" />

      {!isCesiumLoaded && !loadError && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
          <h3 className="text-xl font-heading font-bold text-white tracking-widest">INITIALIZING MOON ENGINE</h3>
          <p className="text-xs font-mono text-cyan-400 mt-2">Loading Lunar Ellipsoid and Imagery...</p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 gap-4">
          <span className="text-4xl">warning</span>
          <h3 className="text-lg font-heading font-bold text-rose-400">3D Viewer Failed to Load</h3>
          <p className="text-xs font-mono text-gray-400 max-w-sm text-center">{loadError}</p>
          <p className="text-xs font-mono text-gray-500">Ensure /public/cesium/ contains the CesiumJS build files.</p>
        </div>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-center z-20 gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap gap-2 p-2 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <button onClick={() => setShowRiskMap(v => !v)}  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${showRiskMap  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>Risk Heatmap</button>
          <button onClick={() => setShowSlope(v => !v)}    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${showSlope    ? 'bg-amber-500/20  border-amber-400  text-amber-300'   : 'bg-white/5 border-white/10 text-gray-400'}`}>Slopes</button>
          <button onClick={() => setShowCraters(v => !v)}  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${showCraters  ? 'bg-cyan-500/20   border-cyan-400   text-cyan-300'   : 'bg-white/5 border-white/10 text-gray-400'}`}>Craters</button>
          <button onClick={() => setShowShadows(v => !v)}  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${showShadows  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>Shadows</button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 p-2 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-xl">
          <span className="text-xs font-mono text-gray-300">Resolution:</span>
          <button onClick={() => setSuperResActive(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${superResActive ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-500/30' : 'bg-white/10 border-white/20 text-gray-300'}`}>
            {superResActive ? 'AI Super-Res (SwinIR)' : '5m Standard TMC'}
          </button>
        </div>
      </div>

      {/* Left Sidebar */}
      <div className="absolute top-20 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400">Candidate Landing Sites</h4>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          <p className="text-[0.7rem] text-gray-400 font-light mt-0.5">Click site to position 3D camera</p>
        </div>
        <div className="space-y-2">
          {LANDING_SITES.map((site) => (
            <button
              key={site.id}
              onClick={() => flyToSite(site)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${site.id === activeSite.id ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-gray-100 font-heading">{site.name}</span>
                <span className="text-[0.65rem] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{site.riskScore}</span>
              </div>
              <p className="text-[0.65rem] text-gray-400 mt-1 line-clamp-2">{site.desc}</p>
              <div className="flex gap-3 mt-2 text-[0.6rem] font-mono text-cyan-300">
                <span>Lat: {site.lat}</span><span>Lon: {site.lon}</span><span>Slope: {site.slope} deg</span>
              </div>
            </button>
          ))}
        </div>

        {isSimulating && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[0.65rem] font-mono text-cyan-300 uppercase tracking-wider">{telemetry.status}</span>
          </div>
        )}

        <button
          onClick={startLanderSimulation}
          disabled={isSimulating}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSimulating ? 'SIMULATING DESCENT...' : 'SIMULATE LANDER NAVIGATION'}
        </button>
      </div>

      {/* Right Sidebar: Telemetry */}
      <div className="absolute top-20 right-4 z-20 w-72 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400">DESCENT TELEMETRY HUD</h4>
          <span className={`text-[0.65rem] font-mono px-2 py-0.5 rounded border ${isSimulating ? 'text-amber-300 bg-amber-950/60 border-amber-500/40 animate-pulse' : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40'}`}>
            {telemetry.status}
          </span>
        </div>

        {/* Live Telemetry Descent Profile Graph */}
        <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
          <div className="flex justify-between items-center text-[0.6rem] font-mono">
            <span className="text-gray-400 uppercase tracking-wider">Descent Profile Live</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>Alt</span>
              <span className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Vel</span>
            </div>
          </div>

          <div className="w-full bg-slate-950/80 rounded-lg p-1 border border-white/5 relative overflow-hidden">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-14 overflow-visible">
              <defs>
                <linearGradient id="altGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="16" x2={svgWidth} y2="16" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="0" y1="36" x2={svgWidth} y2="36" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="0" y1="56" x2={svgWidth} y2="56" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

              {/* Altitude Line */}
              {altPathPoints.length > 1 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={altPathPoints.join(' ')}
                  />
                  <circle cx={latestX} cy={latestAltY} r="3" fill="#38bdf8" className="animate-ping" />
                  <circle cx={latestX} cy={latestAltY} r="2.5" fill="#ffffff" />
                </>
              )}

              {/* Velocity Line */}
              {velPathPoints.length > 1 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="2 1"
                    strokeLinecap="round"
                    points={velPathPoints.join(' ')}
                  />
                  <circle cx={latestX} cy={latestVelY} r="2.5" fill="#fbbf24" />
                </>
              )}
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10"><span className="text-[0.6rem] font-mono text-gray-400 uppercase">Altitude</span><div className="text-xs font-mono font-bold text-cyan-300 mt-0.5">{telemetry.altitude.toLocaleString()} m</div></div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/10"><span className="text-[0.6rem] font-mono text-gray-400 uppercase">Descent Speed</span><div className="text-xs font-mono font-bold text-amber-300 mt-0.5">{telemetry.velocity} m/s</div></div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/10"><span className="text-[0.6rem] font-mono text-gray-400 uppercase">Local Slope</span><div className="text-xs font-mono font-bold text-emerald-300 mt-0.5">{telemetry.slope}</div></div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/10"><span className="text-[0.6rem] font-mono text-gray-400 uppercase">Risk Index</span><div className="text-xs font-mono font-bold text-rose-300 mt-0.5">{telemetry.hazardScore}</div></div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[0.6rem] font-mono text-gray-400"><span>RCS Fuel Level</span><span>{telemetry.fuel}%</span></div>
          <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{ width: `${telemetry.fuel}%` }} />
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-[0.6rem] font-mono space-y-0.5">
          <div className="flex items-center justify-between text-blue-300 font-bold">
            <span>FastAPI ML Backend</span><span className="text-emerald-400">READY</span>
          </div>
          <p className="text-gray-400">Endpoint: <code className="text-cyan-300">/api/v1/hazard-map</code></p>
          <p className="text-gray-400">PostGIS: <code className="text-cyan-300">EPSG:30100 (Moon)</code></p>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-6 py-2 rounded-full bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-xs font-mono text-white">
        <span className="text-gray-400">Hazard Legend:</span>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /><span>Safe</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500" /><span>Caution</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500" /><span>Severe</span></div>
      </div>
    </div>
  );
}
