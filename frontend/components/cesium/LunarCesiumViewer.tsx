'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window { CESIUM_BASE_URL?: string; Cesium?: any; }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CraterDef   { lat: number; lon: number; radius_km: number; depth_m?: number; }
interface ZoneDef     { lat: number; lon: number; radius_km: number; avg_slope_deg?: number; area_km2?: number; }
interface WaypointDef { lat: number; lon: number; alt_km: number; }

interface LandingSite {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  risk_score: number;
  risk_label: string;
  slope_deg: number;
  description: string;
  hazards: {
    craters:     CraterDef[];
    slope_zones: ZoneDef[];
    shadow_zones: ZoneDef[];
    safe_zones:  ZoneDef[];
  };
  descent_waypoints: WaypointDef[];
}

// Fallback sites used if the backend is unreachable
const FALLBACK_SITES: LandingSite[] = [
  {
    id: 'shackleton', name: 'Shackleton Crater Rim', region: 'South Pole',
    lat: -89.54, lon: 0.0, risk_score: 0.12, risk_label: 'Low', slope_deg: 2.4,
    description: 'Prime candidate site near permanently shadowed regions with high water ice potential.',
    hazards: {
      craters: [
        { lat: -89.60, lon: 5.0, radius_km: 0.8 }, { lat: -89.45, lon: -10.0, radius_km: 0.5 }, { lat: -89.70, lon: 15.0, radius_km: 1.2 },
      ],
      slope_zones: [{ lat: -89.55, lon: -5.0, radius_km: 1.5, avg_slope_deg: 12.4 }],
      shadow_zones: [{ lat: -89.80, lon: 0.0, radius_km: 4.0 }],
      safe_zones: [{ lat: -89.50, lon: 2.0, radius_km: 0.6 }],
    },
    descent_waypoints: [
      { lat: -89.0, lon: 0.0, alt_km: 150 }, { lat: -89.25, lon: 0.5, alt_km: 60 },
      { lat: -89.40, lon: 1.0, alt_km: 20 }, { lat: -89.50, lon: 2.0, alt_km: 2 }, { lat: -89.50, lon: 2.0, alt_km: 0 },
    ],
  },
  {
    id: 'malapert', name: 'Malapert Mountain', region: 'South Pole',
    lat: -84.9, lon: 12.9, risk_score: 0.18, risk_label: 'Low', slope_deg: 3.1,
    description: 'Elevated plateau providing continuous Earth line-of-sight communication.',
    hazards: {
      craters: [{ lat: -85.1, lon: 13.5, radius_km: 0.6 }, { lat: -84.7, lon: 12.0, radius_km: 0.4 }],
      slope_zones: [{ lat: -84.85, lon: 12.8, radius_km: 2.0, avg_slope_deg: 15.2 }],
      shadow_zones: [],
      safe_zones: [{ lat: -84.9, lon: 12.9, radius_km: 0.5 }],
    },
    descent_waypoints: [
      { lat: -83.5, lon: 12.9, alt_km: 150 }, { lat: -84.0, lon: 12.9, alt_km: 60 },
      { lat: -84.5, lon: 12.9, alt_km: 15 }, { lat: -84.9, lon: 12.9, alt_km: 2 }, { lat: -84.9, lon: 12.9, alt_km: 0 },
    ],
  },
  {
    id: 'procellarum', name: 'Oceanus Procellarum', region: 'Near Side — Western Mare',
    lat: 18.4, lon: -57.4, risk_score: 0.08, risk_label: 'Very Low', slope_deg: 1.1,
    description: 'Vast, flat basaltic lunar mare with minimal crater obstruction.',
    hazards: {
      craters: [{ lat: 18.8, lon: -56.8, radius_km: 1.4 }, { lat: 17.9, lon: -58.2, radius_km: 0.9 }],
      slope_zones: [],
      shadow_zones: [],
      safe_zones: [{ lat: 18.4, lon: -57.4, radius_km: 2.0 }],
    },
    descent_waypoints: [
      { lat: 20.0, lon: -57.4, alt_km: 150 }, { lat: 19.5, lon: -57.4, alt_km: 60 },
      { lat: 19.0, lon: -57.4, alt_km: 15 }, { lat: 18.4, lon: -57.4, alt_km: 2 }, { lat: 18.4, lon: -57.4, alt_km: 0 },
    ],
  },
  {
    id: 'tranquillitatis', name: 'Mare Tranquillitatis', region: 'Near Side — Equatorial',
    lat: 0.67, lon: 23.47, risk_score: 0.15, risk_label: 'Low', slope_deg: 1.8,
    description: 'Apollo 11 heritage site — equatorial mare with titanium-rich basalts.',
    hazards: {
      craters: [
        { lat: 1.2, lon: 24.0, radius_km: 1.0 }, { lat: 0.3, lon: 22.8, radius_km: 0.7 }, { lat: 1.0, lon: 23.0, radius_km: 0.4 },
      ],
      slope_zones: [{ lat: 0.8, lon: 23.5, radius_km: 1.2, avg_slope_deg: 8.5 }],
      shadow_zones: [],
      safe_zones: [{ lat: 0.67, lon: 23.47, radius_km: 0.8 }],
    },
    descent_waypoints: [
      { lat: 2.0, lon: 23.47, alt_km: 150 }, { lat: 1.5, lon: 23.47, alt_km: 60 },
      { lat: 1.0, lon: 23.47, alt_km: 15 }, { lat: 0.67, lon: 23.47, alt_km: 2 }, { lat: 0.67, lon: 23.47, alt_km: 0 },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function LunarCesiumViewer() {
  const containerRef        = useRef<HTMLDivElement>(null);
  const viewerRef           = useRef<any>(null);
  const flyTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simIntervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const simStepRef          = useRef<number>(0);
  const landerEntityRef     = useRef<any>(null);
  const thrusterEntityRef   = useRef<any>(null);
  const trajectoryEntityRef = useRef<any>(null);
  const trajectoryPtsRef    = useRef<any[]>([]);

  // Per-layer entity collections, keyed by siteId
  const craterEntitiesRef  = useRef<any[]>([]);
  const slopeEntitiesRef   = useRef<any[]>([]);
  const shadowEntitiesRef  = useRef<any[]>([]);
  const safeEntitiesRef    = useRef<any[]>([]);
  const pathEntityRef      = useRef<any>(null);

  const [isCesiumLoaded, setIsCesiumLoaded] = useState(false);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [sites,          setSites]          = useState<LandingSite[]>(FALLBACK_SITES);
  const [activeSite,     setActiveSite]     = useState<LandingSite>(FALLBACK_SITES[0]);
  const [showCraters,    setShowCraters]    = useState(true);
  const [showSlopes,     setShowSlopes]     = useState(true);
  const [showShadows,    setShowShadows]    = useState(true);
  const [showSafe,       setShowSafe]       = useState(true);
  const [isSimulating,   setIsSimulating]   = useState(false);
  const [telemetry, setTelemetry] = useState({
    altitude: 150000, velocity: 1680, slope_deg: '2.4',
    risk_score: '0.12', status: 'STANDBY', fuel: 98,
  });
  const [telemetryHistory, setTelemetryHistory] = useState<{ alt: number; vel: number }[]>([
    { alt: 150000, vel: 1680 }, { alt: 140000, vel: 1620 }, { alt: 125000, vel: 1530 },
    { alt: 108000, vel: 1410 }, { alt: 90000, vel: 1260 },
  ]);
  const [backendConnected, setBackendConnected] = useState(false);

  // ── Load sites from backend ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/lunar-sites`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setSites(data);
          setActiveSite(data[0]);
          setBackendConnected(true);
        }
      })
      .catch(() => setBackendConnected(false));
  }, []);

  // ── Build layer entities for the active site ────────────────────────────────
  const buildSiteLayers = useCallback((Cesium: any, viewer: any, site: LandingSite) => {
    // Clear old layer entities
    const removeAll = (arr: any[]) => {
      arr.forEach(e => { try { viewer.entities.remove(e); } catch {} });
      arr.length = 0;
    };
    removeAll(craterEntitiesRef.current);
    removeAll(slopeEntitiesRef.current);
    removeAll(shadowEntitiesRef.current);
    removeAll(safeEntitiesRef.current);
    try { if (pathEntityRef.current) viewer.entities.remove(pathEntityRef.current); } catch {}
    pathEntityRef.current = null;

    // ── Crater rings (red) ──
    site.hazards.craters.forEach((c, i) => {
      // Cesium ellipses take metres directly; radius_km → metres
      const e = viewer.entities.add({
        id: `crater_${site.id}_${i}`,
        position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 400),
        ellipse: {
          semiMinorAxis: c.radius_km * 1000,
          semiMajorAxis: c.radius_km * 1000,
          height: 200,
          material: Cesium.Color.fromCssColorString('rgba(220,40,40,0.28)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(255,70,70,0.95)'),
          outlineWidth: 2.5,
        },
      });
      craterEntitiesRef.current.push(e);
      // Inner ring
      const e2 = viewer.entities.add({
        id: `crater_inner_${site.id}_${i}`,
        position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 400),
        ellipse: {
          semiMinorAxis: c.radius_km * 400,
          semiMajorAxis: c.radius_km * 400,
          height: 300,
          material: Cesium.Color.fromCssColorString('rgba(255,30,30,0.10)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(255,100,100,0.60)'),
          outlineWidth: 1,
        },
      });
      craterEntitiesRef.current.push(e2);
    });

    // ── Slope warning zones (amber) ──
    site.hazards.slope_zones.forEach((z, i) => {
      const e = viewer.entities.add({
        id: `slope_${site.id}_${i}`,
        position: Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 350),
        ellipse: {
          semiMinorAxis: z.radius_km * 1000,
          semiMajorAxis: z.radius_km * 1000,
          height: 150,
          material: Cesium.Color.fromCssColorString('rgba(251,191,36,0.22)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(251,191,36,0.90)'),
          outlineWidth: 2,
        },
      });
      slopeEntitiesRef.current.push(e);
    });

    // ── Shadow zones (indigo) ──
    site.hazards.shadow_zones.forEach((z, i) => {
      const e = viewer.entities.add({
        id: `shadow_${site.id}_${i}`,
        position: Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 300),
        ellipse: {
          semiMinorAxis: z.radius_km * 1000,
          semiMajorAxis: z.radius_km * 1000,
          height: 100,
          material: Cesium.Color.fromCssColorString('rgba(99,60,180,0.30)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(139,92,246,0.85)'),
          outlineWidth: 2,
        },
      });
      shadowEntitiesRef.current.push(e);
    });

    // ── Safe landing zones (emerald with triple ring) ──
    site.hazards.safe_zones.forEach((z, i) => {
      const radii = [z.radius_km * 1000, z.radius_km * 700, z.radius_km * 400];
      radii.forEach((r, ri) => {
        const e = viewer.entities.add({
          id: `safe_${site.id}_${i}_r${ri}`,
          position: Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 500 + ri * 50),
          ellipse: {
            semiMinorAxis: r,
            semiMajorAxis: r,
            height: 200 + ri * 50,
            material: ri === 0
              ? Cesium.Color.fromCssColorString('rgba(16,185,129,0.12)')
              : Cesium.Color.fromCssColorString('rgba(16,185,129,0.05)'),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(`rgba(16,185,129,${ri === 0 ? 0.95 : 0.45})`),
            outlineWidth: ri === 0 ? 3 : 1.5,
          },
        });
        safeEntitiesRef.current.push(e);
      });
      // Center point
      const ep = viewer.entities.add({
        id: `safe_center_${site.id}_${i}`,
        position: Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 800),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('rgba(16,185,129,1.0)'),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.6),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      safeEntitiesRef.current.push(ep);
    });

    // ── Descent path polyline ──
    if (site.descent_waypoints.length >= 2) {
      const positions = site.descent_waypoints.map(w =>
        Cesium.Cartesian3.fromDegrees(w.lon, w.lat, w.alt_km * 1000)
      );
      const pe = viewer.entities.add({
        id: `path_${site.id}`,
        polyline: {
          positions,
          width: 2.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.5,
            taperPower: 0.8,
            color: Cesium.Color.fromCssColorString('rgba(6,182,212,0.9)'),
          }),
          arcType: Cesium.ArcType.NONE,
        },
      });
      pathEntityRef.current = pe;
    }
  }, []);

  // ── Update entity visibility on toggle ──────────────────────────────────────
  const applyLayerVisibility = useCallback(() => {
    craterEntitiesRef.current.forEach(e => { if (e) e.show = showCraters; });
    slopeEntitiesRef.current.forEach(e => { if (e) e.show = showSlopes; });
    shadowEntitiesRef.current.forEach(e => { if (e) e.show = showShadows; });
    safeEntitiesRef.current.forEach(e => { if (e) e.show = showSafe; });
  }, [showCraters, showSlopes, showShadows, showSafe]);

  useEffect(() => { applyLayerVisibility(); }, [applyLayerVisibility]);

  // ── Init CesiumJS ───────────────────────────────────────────────────────────
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
        // Moon-specific imagery: use NASA/USGS Lunar WMS tile service (no CORS issues)
        // Primary: tiled Moon Nomenclature WMS. Fallback: Cesium OSM placeholder.
        let imageryProvider: any;
        try {
          // NASA Scientific Visualization Studio Moon LRO-WAC Global Mosaic
          imageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
            maximumLevel: 7,
            credit: 'NASA LRO WAC Global Mosaic',
          });
        } catch {
          // Fallback to single tile equirectangular moon
          imageryProvider = new Cesium.SingleTileImageryProvider({
            url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.jpg',
            credit: 'NASA SVS',
          });
        }

        const viewer = new Cesium.Viewer(containerRef.current, {
          imageryProvider,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
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
          requestRenderMode:    false,
        });

        viewerRef.current = viewer;
        const scene = viewer.scene;

        scene.globe.enableLighting       = true;
        scene.globe.showGroundAtmosphere = false;
        scene.backgroundColor            = Cesium.Color.BLACK;
        scene.globe.baseColor            = Cesium.Color.fromCssColorString('#6b6b6b');

        // Initial orbital overview
        setTimeout(() => {
          if (destroyed || !viewerRef.current) return;
          try {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(0, -15, 3500000),
              orientation: { heading: 0, pitch: Cesium.Math.toRadians(-28), roll: 0 },
              duration: 2.5,
            });
          } catch {}
        }, 700);

        if (!destroyed) setIsCesiumLoaded(true);

        // Build initial layers after a short delay
        setTimeout(() => {
          if (destroyed || !viewerRef.current) return;
          const currentSite = activeSite;
          buildSiteLayers(Cesium, viewer, currentSite);
          applyLayerVisibility();
        }, 1200);
      } catch (err: any) {
        console.error('Cesium init error:', err);
        if (!destroyed) setLoadError(err?.message ?? 'Failed to initialize 3D viewer');
      }
    };

    if (window.Cesium) {
      initViewer();
    } else if (document.getElementById('cesium-js')) {
      const existing = document.getElementById('cesium-js')!;
      existing.addEventListener('load', initViewer, { once: true });
      // In case it already loaded
      if ((window as any).Cesium) initViewer();
    } else {
      const script   = document.createElement('script');
      script.id      = 'cesium-js';
      script.src     = '/cesium/Cesium.js';
      script.async   = true;
      script.onload  = () => initViewer();
      script.onerror = () => {
        if (!destroyed) setLoadError('Failed to load CesiumJS from /cesium/Cesium.js. Ensure the public/cesium/ directory exists.');
      };
      document.head.appendChild(script);
    }

    return () => {
      destroyed = true;
      if (flyTimerRef.current)    clearTimeout(flyTimerRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      // Clean up entities before destroy
      try {
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          craterEntitiesRef.current.forEach(e => { try { viewerRef.current.entities.remove(e); } catch {} });
          slopeEntitiesRef.current.forEach(e => { try { viewerRef.current.entities.remove(e); } catch {} });
          shadowEntitiesRef.current.forEach(e => { try { viewerRef.current.entities.remove(e); } catch {} });
          safeEntitiesRef.current.forEach(e => { try { viewerRef.current.entities.remove(e); } catch {} });
          try { viewerRef.current.destroy(); } catch {}
          viewerRef.current = null;
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fly to site & rebuild layers ────────────────────────────────────────────
  const flyToSite = useCallback((site: LandingSite) => {
    setActiveSite(site);
    setTelemetry(prev => ({
      ...prev,
      slope_deg: String(site.slope_deg),
      risk_score: String(site.risk_score),
      status: 'STANDBY',
    }));

    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    try { viewer.camera.cancelFlight(); } catch {}

    // Rebuild hazard layers for this site
    buildSiteLayers(Cesium, viewer, site);
    setTimeout(() => applyLayerVisibility(), 50);

    flyTimerRef.current = setTimeout(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
      try {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, site.id.includes('south') || site.lat < -60 ? 600000 : 350000),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-50), roll: 0 },
          duration: 2.5,
          easingFunction: Cesium.EasingFunction.QUARTIC_IN_OUT,
        });
      } catch {}
    }, 60);
  }, [buildSiteLayers, applyLayerVisibility]);

  // ── Clear simulation entities ────────────────────────────────────────────────
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

  // ── Lander descent simulation ────────────────────────────────────────────────
  const startLanderSimulation = useCallback(() => {
    if (!viewerRef.current || viewerRef.current.isDestroyed() || !window.Cesium || isSimulating) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    const site   = activeSite;

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    clearSimEntities();
    setIsSimulating(true);
    setTelemetryHistory([{ alt: 150000, vel: 1680 }]);

    const totalSteps = 200;
    simStepRef.current = 0;

    // Use the first waypoint of descent path as start position
    const startLat = site.descent_waypoints[0]?.lat ?? site.lat + 1.5;
    const startLon = site.descent_waypoints[0]?.lon ?? site.lon;
    const endLat   = site.hazards.safe_zones[0]?.lat ?? site.lat;
    const endLon   = site.hazards.safe_zones[0]?.lon ?? site.lon;

    // Trajectory line entity
    const trajEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() =>
          trajectoryPtsRef.current.length >= 2
            ? trajectoryPtsRef.current
            : [
                Cesium.Cartesian3.fromDegrees(startLon, startLat, 150000),
                Cesium.Cartesian3.fromDegrees(endLon, endLat, 500),
              ]
        , false),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.6,
          taperPower: 0.7,
          color: Cesium.Color.CYAN.withAlpha(0.85),
        }),
        arcType: Cesium.ArcType.NONE,
      },
    });
    trajectoryEntityRef.current = trajEntity;

    // Lander billboard
    const ROCKET_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><polygon points="16,2 8,18 24,18" fill="%23f0f0f0" stroke="%2338bdf8" stroke-width="1.5"/><rect x="9" y="17" width="14" height="15" fill="%23ddd" rx="2" stroke="%23aaa" stroke-width="0.5"/><polygon points="5,32 9,17 5,17" fill="%23bbb"/><polygon points="27,32 23,17 27,17" fill="%23bbb"/><circle cx="16" cy="25" r="4" fill="%2338bdf8" opacity="0.9"/><rect x="12" y="31" width="8" height="5" fill="%23ccc" rx="1"/></svg>';
    const initPos = Cesium.Cartesian3.fromDegrees(startLon, startLat, 150000);
    const lander  = viewer.entities.add({
      id: 'lander_active',
      position: initPos,
      billboard: {
        image: ROCKET_SVG,
        scale: 1.6,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    landerEntityRef.current = lander;

    // Thruster glow
    const thruster = viewer.entities.add({
      id: 'thruster_active',
      position: initPos,
      point: {
        pixelSize: 22,
        color: Cesium.Color.ORANGE.withAlpha(0.85),
        outlineColor: Cesium.Color.YELLOW.withAlpha(0.5),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    thrusterEntityRef.current = thruster;

    // Orbital approach camera
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(site.lon - 0.8, startLat + 1.0, 380000),
        orientation: { heading: Cesium.Math.toRadians(20), pitch: Cesium.Math.toRadians(-25), roll: 0 },
        duration: 2.0,
      });
    } catch {}

    const interval = setInterval(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) { clearInterval(interval); return; }

      simStepRef.current++;
      const s     = simStepRef.current;
      const p     = s / totalSteps;
      const eased = 1 - Math.pow(1 - p, 2.8);
      const alt   = Math.max(50, 150_000 * (1 - eased));
      const lat   = startLat + (endLat - startLat) * p;
      const lon   = startLon + (endLon - startLon) * p;
      const vel   = Math.max(0, Math.floor(1680 * (1 - Math.sqrt(p))));
      const fuel  = Math.max(62, Math.floor(98 - p * 24));
      const phase =
        p < 0.28 ? 'DE-ORBIT BURN'    :
        p < 0.72 ? 'POWERED DESCENT'  : 'TOUCHDOWN HOVER';

      try {
        const newPos      = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        const thrusterPos = Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(30, alt - 250));
        lander.position   = new Cesium.ConstantPositionProperty(newPos);
        thruster.position = new Cesium.ConstantPositionProperty(thrusterPos);

        const tc =
          p < 0.28 ? Cesium.Color.fromCssColorString('rgba(100,180,255,0.9)') :
          p < 0.72 ? Cesium.Color.fromCssColorString('rgba(255,150,30,0.95)') :
                     Cesium.Color.fromCssColorString('rgba(255,80,20,0.80)');
        thruster.point.color     = tc;
        thruster.point.pixelSize = 16 + Math.sin(s * 0.4) * 8;

        if (s % 2 === 0) trajectoryPtsRef.current.push(newPos);

        if (s % 5 === 0) {
          const camDist = 5000 + alt * 0.40;
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              lon - 0.04,
              lat + (camDist / 111320) * 0.9,
              alt + camDist * 0.88
            ),
            orientation: {
              heading: Cesium.Math.toRadians(12),
              pitch:   Cesium.Math.toRadians(-20 - eased * 40),
              roll:    0,
            },
          });
        }
      } catch {}

      setTelemetry({
        altitude: Math.floor(alt), velocity: vel,
        slope_deg: `${site.slope_deg}`, risk_score: `${site.risk_score}`,
        status: phase, fuel,
      });

      if (s % 3 === 0) {
        setTelemetryHistory(prev => [...prev.slice(-40), { alt: Math.floor(alt), vel }]);
      }

      if (s >= totalSteps) {
        clearInterval(interval);
        setIsSimulating(false);
        setTelemetry(prev => ({ ...prev, status: 'TOUCHDOWN SUCCESS', altitude: 0, velocity: 0, fuel: 74 }));
        setTelemetryHistory(prev => [...prev, { alt: 0, vel: 0 }]);

        try {
          if (thrusterEntityRef.current && !viewer.isDestroyed()) {
            viewer.entities.remove(thrusterEntityRef.current);
            thrusterEntityRef.current = null;
          }
        } catch {}

        // Close-up landing flyover
        try {
          const targetLat = site.hazards.safe_zones[0]?.lat ?? site.lat;
          const targetLon = site.hazards.safe_zones[0]?.lon ?? site.lon;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(targetLon + 0.03, targetLat + 0.02, 6500),
            orientation: { heading: Cesium.Math.toRadians(-20), pitch: Cesium.Math.toRadians(-50), roll: 0 },
            duration: 3.5,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
          });
        } catch {}
      }
    }, 80);

    simIntervalRef.current = interval;
  }, [activeSite, isSimulating, clearSimEntities]);

  // ── Telemetry graph coords ───────────────────────────────────────────────────
  const svgW = 240; const svgH = 64;
  const maxAlt = 150000; const maxVel = 1680;
  const ptCount = Math.max(telemetryHistory.length, 2);
  const altPts = telemetryHistory.map((pt, i) => {
    const x = (i / (ptCount - 1)) * svgW;
    const y = svgH - (Math.min(pt.alt, maxAlt) / maxAlt) * (svgH - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const velPts = telemetryHistory.map((pt, i) => {
    const x = (i / (ptCount - 1)) * svgW;
    const y = svgH - (Math.min(pt.vel, maxVel) / maxVel) * (svgH - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const li = telemetryHistory.length - 1;
  const lx = (li / (ptCount - 1)) * svgW;
  const lay = svgH - (Math.min(telemetryHistory[li]?.alt ?? 0, maxAlt) / maxAlt) * (svgH - 10) - 5;
  const lvy = svgH - (Math.min(telemetryHistory[li]?.vel ?? 0, maxVel) / maxVel) * (svgH - 10) - 5;

  const riskColor = activeSite.risk_score < 0.12 ? 'text-emerald-400'
    : activeSite.risk_score < 0.20 ? 'text-yellow-400' : 'text-orange-400';

  return (
    <div className="relative w-full h-[85vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black font-sans">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!isCesiumLoaded && !loadError && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            <div className="absolute inset-5 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-base">🌕</span>
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-heading font-bold text-white tracking-widest">INITIALISING MOON ENGINE</h3>
            <p className="text-xs font-mono text-cyan-400 mt-1">Loading Lunar 3D Terrain &amp; Hazard Layers…</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 gap-4 p-8 text-center">
          <span className="text-5xl">⚠️</span>
          <h3 className="text-lg font-heading font-bold text-rose-400">3D Viewer Failed to Load</h3>
          <p className="text-xs font-mono text-gray-400 max-w-sm">{loadError}</p>
          <p className="text-xs font-mono text-gray-500">Ensure <code className="text-cyan-300">/public/cesium/</code> contains the CesiumJS build files.</p>
        </div>
      )}

      {/* ── Top Controls ── */}
      {isCesiumLoaded && (
        <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-center z-20 gap-2 pointer-events-none">
          {/* Layer toggles */}
          <div className="pointer-events-auto flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-xl">
            <span className="text-[0.6rem] font-mono text-gray-500 uppercase tracking-widest self-center pr-1">Layers:</span>
            {[
              { label: '🔴 Craters',  active: showCraters, toggle: () => setShowCraters(v => !v), on: 'bg-red-500/20 border-red-400 text-red-300'     },
              { label: '🟡 Slopes',   active: showSlopes,  toggle: () => setShowSlopes(v => !v),  on: 'bg-amber-500/20 border-amber-400 text-amber-300' },
              { label: '🟣 Shadows',  active: showShadows, toggle: () => setShowShadows(v => !v), on: 'bg-indigo-500/20 border-indigo-400 text-indigo-300' },
              { label: '🟢 Safe Zones', active: showSafe, toggle: () => setShowSafe(v => !v),    on: 'bg-emerald-500/20 border-emerald-400 text-emerald-300' },
            ].map(({ label, active, toggle, on }) => (
              <button
                key={label}
                onClick={toggle}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                  active ? on : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status / backend indicator */}
          <div className="pointer-events-auto flex items-center gap-2 p-2 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-xl">
            <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[0.65rem] font-mono text-gray-300">
              {backendConnected ? 'Live Backend' : 'Offline Fallback'}
            </span>
            <span className="text-[0.6rem] font-mono text-cyan-400">· {sites.length} Sites Loaded</span>
          </div>
        </div>
      )}

      {/* ── Left Sidebar: Landing Sites ── */}
      {isCesiumLoaded && (
        <div className="absolute top-20 left-4 z-20 w-80 max-w-[calc(50vw-2rem)] p-4 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400">Candidate Landing Sites</h4>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[0.65rem] text-gray-500 font-light mt-0.5">Click site to fly 3D camera &amp; reload hazard layers</p>
          </div>

          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => flyToSite(site)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all duration-300 ${
                  site.id === activeSite.id
                    ? 'bg-cyan-500/15 border-cyan-400/70 shadow-md shadow-cyan-500/15'
                    : 'bg-white/4 border-white/8 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-bold text-gray-100 font-heading leading-tight">{site.name}</span>
                  <span className={`flex-shrink-0 text-[0.6rem] font-mono px-1.5 py-0.5 rounded border ${
                    site.risk_score < 0.12 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                    site.risk_score < 0.20 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                    'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  }`}>{site.risk_label} ({site.risk_score})</span>
                </div>
                <p className="text-[0.6rem] text-gray-400 mt-0.5 line-clamp-1">{site.region}</p>
                <div className="flex gap-2 mt-1 text-[0.58rem] font-mono text-cyan-300/70">
                  <span>🕳 {site.hazards.craters.length} craters</span>
                  <span>⛰ slope {site.slope_deg}°</span>
                  <span>🟢 {site.hazards.safe_zones.length} safe zone{site.hazards.safe_zones.length !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Simulation status */}
          {isSimulating && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[0.65rem] font-mono text-cyan-300 uppercase tracking-wider">{telemetry.status}</span>
            </div>
          )}

          <button
            onClick={startLanderSimulation}
            disabled={isSimulating}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSimulating
              ? <><div className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" /> Simulating Descent…</>
              : <><span>🚀</span><span>Simulate Lander Descent</span></>
            }
          </button>
        </div>
      )}

      {/* ── Right Sidebar: Telemetry HUD ── */}
      {isCesiumLoaded && (
        <div className="absolute top-20 right-4 z-20 w-72 max-w-[calc(50vw-2rem)] p-4 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400">Descent Telemetry HUD</h4>
            <span className={`text-[0.6rem] font-mono px-2 py-0.5 rounded border ${
              telemetry.status === 'TOUCHDOWN SUCCESS'
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40'
                : isSimulating
                ? 'text-amber-300 bg-amber-950/60 border-amber-500/40 animate-pulse'
                : 'text-gray-400 bg-white/5 border-white/10'
            }`}>
              {telemetry.status}
            </span>
          </div>

          {/* Descent profile graph */}
          <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
            <div className="flex justify-between items-center text-[0.6rem] font-mono">
              <span className="text-gray-400 uppercase tracking-wider">Descent Profile</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />Alt</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Vel</span>
              </div>
            </div>
            <div className="w-full bg-slate-950/80 rounded-lg p-1 border border-white/5">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-14 overflow-visible">
                <defs>
                  <linearGradient id="altGradFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="16" x2={svgW} y2="16" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="36" x2={svgW} y2="36" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="56" x2={svgW} y2="56" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                {altPts.length > 1 && (
                  <>
                    <polyline fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={altPts.join(' ')} />
                    <circle cx={lx} cy={lay} r="3" fill="#38bdf8" opacity="0.7" className="animate-ping" />
                    <circle cx={lx} cy={lay} r="2.5" fill="#ffffff" />
                  </>
                )}
                {velPts.length > 1 && (
                  <>
                    <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2 1.5" strokeLinecap="round" points={velPts.join(' ')} />
                    <circle cx={lx} cy={lvy} r="2.5" fill="#fbbf24" />
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Altitude',  value: `${telemetry.altitude.toLocaleString()} m`,  color: 'text-cyan-300'    },
              { label: 'Speed',     value: `${telemetry.velocity} m/s`,                  color: 'text-amber-300'   },
              { label: 'Local Slope', value: `${telemetry.slope_deg}°`,                  color: 'text-emerald-300' },
              { label: 'Risk Index',value: telemetry.risk_score,                          color: 'text-rose-300'    },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-2 rounded-lg bg-white/5 border border-white/8">
                <span className="text-[0.58rem] font-mono text-gray-400 uppercase tracking-wider">{label}</span>
                <div className={`text-xs font-mono font-bold mt-0.5 ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Fuel bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[0.6rem] font-mono text-gray-400">
              <span>RCS Fuel Level</span>
              <span className={telemetry.fuel < 70 ? 'text-amber-400' : 'text-cyan-400'}>{telemetry.fuel}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  telemetry.fuel < 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                }`}
                style={{ width: `${telemetry.fuel}%` }}
              />
            </div>
          </div>

          {/* Backend status */}
          <div className="p-2 rounded-xl bg-blue-950/30 border border-blue-500/20 text-[0.6rem] font-mono space-y-0.5">
            <div className="flex items-center justify-between text-blue-300 font-bold">
              <span>MoonGrid FastAPI ML Backend</span>
              <span className={backendConnected ? 'text-emerald-400' : 'text-amber-400'}>
                {backendConnected ? '● LIVE' : '○ OFFLINE'}
              </span>
            </div>
            <p className="text-gray-500">Endpoint: <code className="text-cyan-300">/lunar-sites</code> · <code className="text-cyan-300">/jobs</code></p>
          </div>
        </div>
      )}

      {/* ── Bottom Legend ── */}
      {isCesiumLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2 rounded-full bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-[0.65rem] font-mono text-white">
          <span className="text-gray-500">Hazard Layers:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-80" />Craters</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-80" />Slopes</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 opacity-80" />Shadows</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 opacity-80" />Safe Zone</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-cyan-400 border-dashed" />Descent Path</span>
        </div>
      )}
    </div>
  );
}
