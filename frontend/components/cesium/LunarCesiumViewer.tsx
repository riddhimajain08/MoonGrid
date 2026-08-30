'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
    Cesium?: any;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const MOON_RADIUS = 1737400.0; // Lunar radius in meters

// ─── Types ───────────────────────────────────────────────────────────────────
interface CraterDef { lat: number; lon: number; radius_km: number; depth_m?: number; }
interface ZoneDef { lat: number; lon: number; radius_km: number; avg_slope_deg?: number; area_km2?: number; }
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
    craters: CraterDef[];
    slope_zones: ZoneDef[];
    shadow_zones: ZoneDef[];
    safe_zones: ZoneDef[];
  };
  descent_waypoints: WaypointDef[];
}

// Fallback sites used if the backend is unreachable
const FALLBACK_SITES: LandingSite[] = [
  {
    id: 'shackleton',
    name: 'Shackleton Crater Rim',
    region: 'South Pole (89.54° S)',
    lat: -89.54,
    lon: 0.0,
    risk_score: 0.12,
    risk_label: 'Low',
    slope_deg: 2.4,
    description: 'Prime candidate site near permanently shadowed regions (PSR) with high water ice potential.',
    hazards: {
      craters: [
        { lat: -89.60, lon: 5.0, radius_km: 0.8, depth_m: 120 },
        { lat: -89.45, lon: -10.0, radius_km: 0.5, depth_m: 80 },
        { lat: -89.70, lon: 15.0, radius_km: 1.2, depth_m: 200 },
      ],
      slope_zones: [
        { lat: -89.55, lon: -5.0, radius_km: 1.5, avg_slope_deg: 12.4 },
      ],
      shadow_zones: [
        { lat: -89.80, lon: 0.0, radius_km: 3.5 },
      ],
      safe_zones: [
        { lat: -89.50, lon: 2.0, radius_km: 0.6, area_km2: 1.13 },
      ],
    },
    descent_waypoints: [
      { lat: -89.0, lon: 0.0, alt_km: 150 },
      { lat: -89.25, lon: 0.5, alt_km: 60 },
      { lat: -89.40, lon: 1.0, alt_km: 20 },
      { lat: -89.50, lon: 2.0, alt_km: 2 },
      { lat: -89.50, lon: 2.0, alt_km: 0 },
    ],
  },
  {
    id: 'malapert',
    name: 'Malapert Mountain',
    region: 'South Pole (84.9° S)',
    lat: -84.9,
    lon: 12.9,
    risk_score: 0.18,
    risk_label: 'Low',
    slope_deg: 3.1,
    description: 'Elevated plateau providing continuous Earth line-of-sight communication and solar power.',
    hazards: {
      craters: [
        { lat: -85.1, lon: 13.5, radius_km: 0.6, depth_m: 90 },
        { lat: -84.7, lon: 12.0, radius_km: 0.4, depth_m: 60 },
      ],
      slope_zones: [
        { lat: -84.85, lon: 12.8, radius_km: 1.8, avg_slope_deg: 15.2 },
      ],
      shadow_zones: [
        { lat: -85.05, lon: 12.3, radius_km: 2.0 },
      ],
      safe_zones: [
        { lat: -84.9, lon: 12.9, radius_km: 0.5, area_km2: 0.78 },
      ],
    },
    descent_waypoints: [
      { lat: -83.5, lon: 12.9, alt_km: 150 },
      { lat: -84.0, lon: 12.9, alt_km: 60 },
      { lat: -84.5, lon: 12.9, alt_km: 15 },
      { lat: -84.9, lon: 12.9, alt_km: 2 },
      { lat: -84.9, lon: 12.9, alt_km: 0 },
    ],
  },
  {
    id: 'procellarum',
    name: 'Oceanus Procellarum',
    region: 'Near Side — Western Mare',
    lat: 18.4,
    lon: -57.4,
    risk_score: 0.08,
    risk_label: 'Very Low',
    slope_deg: 1.1,
    description: 'Vast, flat basaltic lunar mare with minimal obstacle obstruction and smooth touchdown zones.',
    hazards: {
      craters: [
        { lat: 18.8, lon: -56.8, radius_km: 1.4, depth_m: 180 },
        { lat: 17.9, lon: -58.2, radius_km: 0.9, depth_m: 130 },
      ],
      slope_zones: [
        { lat: 18.6, lon: -56.5, radius_km: 1.1, avg_slope_deg: 6.8 },
      ],
      shadow_zones: [
        { lat: 18.2, lon: -58.0, radius_km: 1.5 },
      ],
      safe_zones: [
        { lat: 18.4, lon: -57.4, radius_km: 2.0, area_km2: 12.6 },
      ],
    },
    descent_waypoints: [
      { lat: 20.0, lon: -57.4, alt_km: 150 },
      { lat: 19.5, lon: -57.4, alt_km: 60 },
      { lat: 19.0, lon: -57.4, alt_km: 15 },
      { lat: 18.4, lon: -57.4, alt_km: 2 },
      { lat: 18.4, lon: -57.4, alt_km: 0 },
    ],
  },
  {
    id: 'tranquillitatis',
    name: 'Mare Tranquillitatis',
    region: 'Near Side — Equatorial',
    lat: 0.67,
    lon: 23.47,
    risk_score: 0.15,
    risk_label: 'Low',
    slope_deg: 1.8,
    description: 'Apollo 11 heritage site — equatorial mare with titanium-rich basalt bedrock.',
    hazards: {
      craters: [
        { lat: 1.2, lon: 24.0, radius_km: 1.0, depth_m: 150 },
        { lat: 0.3, lon: 22.8, radius_km: 0.7, depth_m: 100 },
        { lat: 1.0, lon: 23.0, radius_km: 0.4, depth_m: 50 },
      ],
      slope_zones: [
        { lat: 0.8, lon: 23.5, radius_km: 1.2, avg_slope_deg: 8.5 },
      ],
      shadow_zones: [
        { lat: 0.4, lon: 23.8, radius_km: 1.0 },
      ],
      safe_zones: [
        { lat: 0.67, lon: 23.47, radius_km: 0.8, area_km2: 2.0 },
      ],
    },
    descent_waypoints: [
      { lat: 2.0, lon: 23.47, alt_km: 150 },
      { lat: 1.5, lon: 23.47, alt_km: 60 },
      { lat: 1.0, lon: 23.47, alt_km: 15 },
      { lat: 0.67, lon: 23.47, alt_km: 2 },
      { lat: 0.67, lon: 23.47, alt_km: 0 },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function LunarCesiumViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const moonEllipsoidRef = useRef<any>(null);
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simStepRef = useRef<number>(0);
  const landerEntityRef = useRef<any>(null);
  const thrusterEntityRef = useRef<any>(null);
  const trajectoryEntityRef = useRef<any>(null);
  const trajectoryPtsRef = useRef<any[]>([]);

  // Per-layer entity collections
  const craterEntitiesRef = useRef<any[]>([]);
  const slopeEntitiesRef = useRef<any[]>([]);
  const shadowEntitiesRef = useRef<any[]>([]);
  const safeEntitiesRef = useRef<any[]>([]);
  const pathEntityRef = useRef<any>(null);
  const waypointEntitiesRef = useRef<any[]>([]);

  const [isCesiumLoaded, setIsCesiumLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sites, setSites] = useState<LandingSite[]>(FALLBACK_SITES);
  const [activeSite, setActiveSite] = useState<LandingSite>(FALLBACK_SITES[0]);
  const [showCraters, setShowCraters] = useState(true);
  const [showSlopes, setShowSlopes] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [showSafe, setShowSafe] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isLoadingSites, setIsLoadingSites] = useState(true);

  const [telemetry, setTelemetry] = useState({
    altitude: 150000,
    velocity: 1680,
    slope_deg: '2.4',
    risk_score: '0.12',
    status: 'STANDBY',
    fuel: 98,
  });

  const [telemetryHistory, setTelemetryHistory] = useState<{ alt: number; vel: number }[]>([
    { alt: 150000, vel: 1680 },
    { alt: 140000, vel: 1620 },
    { alt: 125000, vel: 1530 },
    { alt: 108000, vel: 1410 },
    { alt: 90000, vel: 1260 },
  ]);

  // ── Load sites from backend API (GET /lunar-sites) ───────────────────────────
  const fetchSites = useCallback(async () => {
    setIsLoadingSites(true);
    try {
      const res = await fetch(`${API_URL}/lunar-sites`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSites(data);
        setActiveSite(prev => {
          const match = data.find(s => s.id === prev.id);
          return match || data[0];
        });
        setBackendConnected(true);
      }
    } catch {
      setBackendConnected(false);
    } finally {
      setIsLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // ── Build layer entities for the active site ────────────────────────────────
  const buildSiteLayers = useCallback((Cesium: any, viewer: any, site: LandingSite, ellipsoid: any) => {
    if (!viewer || viewer.isDestroyed()) return;

    // Clear old layer entities safely
    const removeAll = (arr: any[]) => {
      arr.forEach(e => {
        try {
          if (e && viewer && !viewer.isDestroyed()) viewer.entities.remove(e);
        } catch { }
      });
      arr.length = 0;
    };

    removeAll(craterEntitiesRef.current);
    removeAll(slopeEntitiesRef.current);
    removeAll(shadowEntitiesRef.current);
    removeAll(safeEntitiesRef.current);
    removeAll(waypointEntitiesRef.current);

    try {
      if (pathEntityRef.current && viewer && !viewer.isDestroyed()) {
        viewer.entities.remove(pathEntityRef.current);
      }
    } catch { }
    pathEntityRef.current = null;

    // ── 1. Crater hazard rings (Red) ──
    site.hazards.craters.forEach((c, i) => {
      const craterPos = Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 20, ellipsoid);
      const e = viewer.entities.add({
        id: `crater_${site.id}_${i}`,
        position: craterPos,
        ellipse: {
          semiMinorAxis: Math.max(150, c.radius_km * 1000),
          semiMajorAxis: Math.max(150, c.radius_km * 1000),
          material: Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.45)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(248, 113, 113, 1.0)'),
          outlineWidth: 3,
        },
      });
      craterEntitiesRef.current.push(e);

      // Inner crater point marker + badge
      const ep = viewer.entities.add({
        id: `crater_inner_${site.id}_${i}`,
        position: craterPos,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#ef4444'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `🔴 Crater (${c.radius_km}km)`,
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.fromCssColorString('#fca5a5'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      craterEntitiesRef.current.push(ep);
    });

    // ── 2. Slope warning zones (Amber) ──
    site.hazards.slope_zones.forEach((z, i) => {
      const slopePos = Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 30, ellipsoid);
      const e = viewer.entities.add({
        id: `slope_${site.id}_${i}`,
        position: slopePos,
        ellipse: {
          semiMinorAxis: Math.max(200, z.radius_km * 1000),
          semiMajorAxis: Math.max(200, z.radius_km * 1000),
          material: Cesium.Color.fromCssColorString('rgba(245, 158, 11, 0.50)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(251, 191, 36, 1.0)'),
          outlineWidth: 3,
        },
      });
      slopeEntitiesRef.current.push(e);

      // Slope caution point & badge
      const ep = viewer.entities.add({
        id: `slope_marker_${site.id}_${i}`,
        position: slopePos,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#f59e0b'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `⚠️ Slope (${z.avg_slope_deg || 12}°)`,
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.fromCssColorString('#fde68a'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      slopeEntitiesRef.current.push(ep);
    });

    // ── 3. Shadow zones (Indigo / Violet) ──
    site.hazards.shadow_zones.forEach((z, i) => {
      const shadowPos = Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 30, ellipsoid);
      const e = viewer.entities.add({
        id: `shadow_${site.id}_${i}`,
        position: shadowPos,
        ellipse: {
          semiMinorAxis: Math.max(200, z.radius_km * 1000),
          semiMajorAxis: Math.max(200, z.radius_km * 1000),
          material: Cesium.Color.fromCssColorString('rgba(147, 51, 234, 0.55)'),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(192, 132, 252, 1.0)'),
          outlineWidth: 3,
        },
      });
      shadowEntitiesRef.current.push(e);

      // Shadow point & badge
      const ep = viewer.entities.add({
        id: `shadow_marker_${site.id}_${i}`,
        position: shadowPos,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#a855f7'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `🌑 Shadow (${z.radius_km}km)`,
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.fromCssColorString('#e9d5ff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      shadowEntitiesRef.current.push(ep);
    });

    // ── 4. Safe landing zones (Emerald Green with Target concentric rings) ──
    site.hazards.safe_zones.forEach((z, i) => {
      const safePos = Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 35, ellipsoid);
      const radii = [z.radius_km * 1000, z.radius_km * 600, z.radius_km * 300];

      radii.forEach((r, ri) => {
        const e = viewer.entities.add({
          id: `safe_${site.id}_${i}_r${ri}`,
          position: safePos,
          ellipse: {
            semiMinorAxis: Math.max(100, r),
            semiMajorAxis: Math.max(100, r),
            material: ri === 0
              ? Cesium.Color.fromCssColorString('rgba(16, 185, 129, 0.40)')
              : Cesium.Color.fromCssColorString('rgba(16, 185, 129, 0.15)'),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(`rgba(52, 211, 153, ${ri === 0 ? 1.0 : 0.7})`),
            outlineWidth: ri === 0 ? 4 : 2,
          },
        });
        safeEntitiesRef.current.push(e);
      });

      // Center point & beacon label
      const ep = viewer.entities.add({
        id: `safe_center_${site.id}_${i}`,
        position: Cesium.Cartesian3.fromDegrees(z.lon, z.lat, 60, ellipsoid),
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#10b981'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `🎯 SAFE ZONE (${z.radius_km}km)`,
          font: 'bold 12px monospace',
          fillColor: Cesium.Color.fromCssColorString('#6ee7b7'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      safeEntitiesRef.current.push(ep);
    });

    // ── 5. Descent trajectory path & Waypoints ──
    if (site.descent_waypoints && site.descent_waypoints.length >= 2) {
      const positions = site.descent_waypoints.map(w =>
        Cesium.Cartesian3.fromDegrees(w.lon, w.lat, w.alt_km * 1000, ellipsoid)
      );

      const pe = viewer.entities.add({
        id: `path_${site.id}`,
        polyline: {
          positions,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.5,
            taperPower: 0.8,
            color: Cesium.Color.fromCssColorString('rgba(6, 182, 212, 0.95)'),
          }),
          arcType: Cesium.ArcType.NONE,
        },
      });
      pathEntityRef.current = pe;

      // Waypoint markers
      site.descent_waypoints.forEach((w, idx) => {
        const wpPos = Cesium.Cartesian3.fromDegrees(w.lon, w.lat, w.alt_km * 1000, ellipsoid);
        const we = viewer.entities.add({
          id: `wp_${site.id}_${idx}`,
          position: wpPos,
          point: {
            pixelSize: 7,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `WP${idx + 1} (${w.alt_km}km)`,
            font: 'bold 10px monospace',
            fillColor: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 8),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        waypointEntitiesRef.current.push(we);
      });
    }
  }, []);

  // ── Update entity visibility on toggle ──────────────────────────────────────
  const applyLayerVisibility = useCallback(() => {
    craterEntitiesRef.current.forEach(e => { if (e) e.show = showCraters; });
    slopeEntitiesRef.current.forEach(e => { if (e) e.show = showSlopes; });
    shadowEntitiesRef.current.forEach(e => { if (e) e.show = showShadows; });
    safeEntitiesRef.current.forEach(e => { if (e) e.show = showSafe; });
    if (pathEntityRef.current) pathEntityRef.current.show = showSafe;
    waypointEntitiesRef.current.forEach(e => { if (e) e.show = showSafe; });
  }, [showCraters, showSlopes, showShadows, showSafe]);

  useEffect(() => {
    applyLayerVisibility();
  }, [applyLayerVisibility]);

  // ── Clear simulation entities ────────────────────────────────────────────────
  const clearSimEntities = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    try {
      viewer.trackedEntity = undefined;
    } catch { }
    const remove = (ref: React.MutableRefObject<any>) => {
      try {
        if (ref.current && !viewer.isDestroyed()) viewer.entities.remove(ref.current);
      } catch { }
      ref.current = null;
    };
    remove(landerEntityRef);
    remove(trajectoryEntityRef);
    remove(thrusterEntityRef);
    trajectoryPtsRef.current = [];
    simStepRef.current = 0;
  }, []);

  // ── Init CesiumJS with Moon Ellipsoid & Offline Texture ──────────────────────
  useEffect(() => {
    let destroyed = false;
    window.CESIUM_BASE_URL = '/cesium/';

    if (!document.getElementById('cesium-css')) {
      const link = document.createElement('link');
      link.id = 'cesium-css';
      link.rel = 'stylesheet';
      link.href = '/cesium/Widgets/widgets.css';
      document.head.appendChild(link);
    }

    const initViewer = async () => {
      if (destroyed || !containerRef.current || viewerRef.current || !window.Cesium) return;
      const Cesium = window.Cesium;

      try {
        // Moon Ellipsoid configuration (1,737.4 km radius)
        const moonEllipsoid = new Cesium.Ellipsoid(MOON_RADIUS, MOON_RADIUS, MOON_RADIUS);
        moonEllipsoidRef.current = moonEllipsoid;

        // Base Imagery Layer using 4K HD Lunar equirectangular map
        const baseLayer = Cesium.ImageryLayer.fromProviderAsync(
          Cesium.SingleTileImageryProvider.fromUrl('/moon_hd.jpg', {
            ellipsoid: moonEllipsoid,
            rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
          })
        );

        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer,
          ellipsoid: moonEllipsoid,
          terrainProvider: new Cesium.EllipsoidTerrainProvider({ ellipsoid: moonEllipsoid }),
          skyAtmosphere: false,
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
          requestRenderMode: false,
        });

        viewerRef.current = viewer;
        const scene = viewer.scene;

        // Visual enhancement: crystal-clear rendering
        viewer.resolutionScale = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        scene.globe.enableLighting = false; // Clean, uniform lunar surface illumination
        scene.globe.showGroundAtmosphere = false;
        scene.backgroundColor = Cesium.Color.BLACK;
        scene.globe.baseColor = Cesium.Color.fromCssColorString('#14141c');
        if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;

        // Initial Overview camera (glides smoothly to overview of active site)
        const initSite = activeSite;
        setTimeout(() => {
          if (destroyed || !viewerRef.current || viewerRef.current.isDestroyed()) return;
          try {
            const isPolar = Math.abs(initSite.lat) > 60;
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(
                initSite.lon,
                initSite.lat > 0 ? initSite.lat - 1.5 : initSite.lat + 1.5,
                isPolar ? 180000 : 140000,
                moonEllipsoid
              ),
              orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(isPolar ? -60 : -45),
                roll: 0,
              },
              duration: 1.8,
              maximumHeight: 250000,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
            });
          } catch { }
        }, 500);

        if (!destroyed) setIsCesiumLoaded(true);

        // Build initial hazard layers
        setTimeout(() => {
          if (destroyed || !viewerRef.current || viewerRef.current.isDestroyed()) return;
          buildSiteLayers(Cesium, viewer, initSite, moonEllipsoid);
          applyLayerVisibility();
        }, 800);

      } catch (err: any) {
        console.error('Cesium init error:', err);
        if (!destroyed) setLoadError(err?.message ?? 'Failed to initialize 3D viewer');
      }
    };

    if (window.Cesium) {
      initViewer();
    } else if (document.getElementById('cesium-js')) {
      const existing = document.getElementById('cesium-js')!;
      existing.addEventListener('load', () => initViewer(), { once: true });
      if ((window as any).Cesium) initViewer();
    } else {
      const script = document.createElement('script');
      script.id = 'cesium-js';
      script.src = '/cesium/Cesium.js';
      script.async = true;
      script.onload = () => initViewer();
      script.onerror = () => {
        if (!destroyed) setLoadError('Failed to load CesiumJS from /cesium/Cesium.js. Ensure public/cesium/ contains the library build.');
      };
      document.head.appendChild(script);
    }

    return () => {
      destroyed = true;
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      try {
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
      } catch { }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fly to site & rebuild layers (Smooth glide without messy zoom out) ──────
  const flyToSite = useCallback((site: LandingSite) => {
    setActiveSite(site);
    setTelemetry(prev => ({
      ...prev,
      slope_deg: String(site.slope_deg),
      risk_score: String(site.risk_score),
      status: 'STANDBY',
    }));

    if (!viewerRef.current || viewerRef.current.isDestroyed() || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    const ellipsoid = moonEllipsoidRef.current || new Cesium.Ellipsoid(MOON_RADIUS, MOON_RADIUS, MOON_RADIUS);

    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    try { viewer.camera.cancelFlight(); } catch { }

    // Rebuild hazard layers for this site immediately
    buildSiteLayers(Cesium, viewer, site, ellipsoid);
    applyLayerVisibility();

    // Smooth, clean camera glide with capped maximumHeight to eliminate disorienting zoom out
    flyTimerRef.current = setTimeout(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
      try {
        const isSouthPolar = site.lat < -60;
        const targetLat = isSouthPolar ? site.lat + 1.2 : (site.lat > 0 ? site.lat - 0.8 : site.lat + 0.8);
        const targetAlt = isSouthPolar ? 170000 : 130000;

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(site.lon, targetLat, targetAlt, ellipsoid),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(isSouthPolar ? -60 : -45),
            roll: 0,
          },
          duration: 1.4,
          maximumHeight: 240000, // Clamps flight arc: no deep-space zoom out!
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        });
      } catch { }
    }, 40);
  }, [buildSiteLayers, applyLayerVisibility]);

  // ── Lander descent simulation (Smooth 60fps with fixed cinematic framing) ──
  const startLanderSimulation = useCallback(() => {
    if (!viewerRef.current || viewerRef.current.isDestroyed() || !window.Cesium || isSimulating) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    const site = activeSite;
    const ellipsoid = moonEllipsoidRef.current || new Cesium.Ellipsoid(MOON_RADIUS, MOON_RADIUS, MOON_RADIUS);

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    clearSimEntities();
    setIsSimulating(true);
    setTelemetryHistory([{ alt: 150000, vel: 1680 }]);

    const totalSteps = 180;
    simStepRef.current = 0;

    // Start coordinates from descent path waypoint, touchdown at safe zone center
    const startLat = site.descent_waypoints[0]?.lat ?? (site.lat > 0 ? site.lat + 1.5 : site.lat - 1.5);
    const startLon = site.descent_waypoints[0]?.lon ?? site.lon;
    const endLat = site.hazards.safe_zones[0]?.lat ?? site.lat;
    const endLon = site.hazards.safe_zones[0]?.lon ?? site.lon;

    // Midpoint calculation for framing the entire descent corridor
    const midLat = (startLat + endLat) / 2;
    const midLon = (startLon + endLon) / 2;
    const isPolar = Math.abs(midLat) > 60;

    // Trajectory line entity
    const trajEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() =>
          trajectoryPtsRef.current.length >= 2
            ? trajectoryPtsRef.current
            : [
              Cesium.Cartesian3.fromDegrees(startLon, startLat, 150000, ellipsoid),
              Cesium.Cartesian3.fromDegrees(endLon, endLat, 500, ellipsoid),
            ]
          , false),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.5,
          taperPower: 0.7,
          color: Cesium.Color.CYAN.withAlpha(0.95),
        }),
        arcType: Cesium.ArcType.NONE,
      },
    });
    trajectoryEntityRef.current = trajEntity;

    // Lander billboard (Rocket Icon)
    const ROCKET_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><polygon points="16,2 8,18 24,18" fill="%23ffffff" stroke="%2338bdf8" stroke-width="1.5"/><rect x="9" y="17" width="14" height="15" fill="%23e2e8f0" rx="2" stroke="%2394a3b8" stroke-width="0.5"/><polygon points="5,32 9,17 5,17" fill="%2364748b"/><polygon points="27,32 23,17 27,17" fill="%2364748b"/><circle cx="16" cy="25" r="4" fill="%2338bdf8" opacity="0.9"/><rect x="12" y="31" width="8" height="5" fill="%23cbd5e1" rx="1"/></svg>';
    const initPos = Cesium.Cartesian3.fromDegrees(startLon, startLat, 150000, ellipsoid);
    const lander = viewer.entities.add({
      id: 'lander_active',
      position: initPos,
      viewFrom: new Cesium.Cartesian3(-32000, -32000, 22000), // Offsets camera to comfortably frame rocket in center
      billboard: {
        image: ROCKET_SVG,
        scale: 1.2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    landerEntityRef.current = lander;

    // Lock camera onto lander so it stays centered and follows rocket as it descends!
    viewer.trackedEntity = lander;

    // Thruster exhaust flame
    const thruster = viewer.entities.add({
      id: 'thruster_active',
      position: initPos,
      point: {
        pixelSize: 16,
        color: Cesium.Color.ORANGE.withAlpha(0.9),
        outlineColor: Cesium.Color.YELLOW.withAlpha(0.6),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    thrusterEntityRef.current = thruster;

    // Smooth step interval
    const interval = setInterval(() => {
      if (!viewerRef.current || viewerRef.current.isDestroyed()) {
        clearInterval(interval);
        return;
      }

      simStepRef.current++;
      const s = simStepRef.current;
      const p = s / totalSteps;
      const eased = 1 - Math.pow(1 - p, 2.6);
      const alt = Math.max(50, 150000 * (1 - eased));
      const lat = startLat + (endLat - startLat) * p;
      const lon = startLon + (endLon - startLon) * p;
      const vel = Math.max(0, Math.floor(1680 * (1 - Math.sqrt(p))));
      const fuel = Math.max(68, Math.floor(98 - p * 22));
      const phase =
        p < 0.28 ? 'DE-ORBIT BURN' :
          p < 0.75 ? 'POWERED DESCENT' : 'TOUCHDOWN HOVER';

      try {
        const newPos = Cesium.Cartesian3.fromDegrees(lon, lat, alt, ellipsoid);
        const thrusterPos = Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(10, alt - 100), ellipsoid);
        lander.position = new Cesium.ConstantPositionProperty(newPos);
        thruster.position = new Cesium.ConstantPositionProperty(thrusterPos);

        const tc =
          p < 0.28 ? Cesium.Color.fromCssColorString('rgba(56, 189, 248, 0.95)') :
            p < 0.75 ? Cesium.Color.fromCssColorString('rgba(251, 146, 60, 0.95)') :
              Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.90)');
        thruster.point.color = tc;
        thruster.point.pixelSize = 12 + Math.sin(s * 0.4) * 6;

        if (s % 2 === 0) trajectoryPtsRef.current.push(newPos);
      } catch { }

      setTelemetry({
        altitude: Math.floor(alt),
        velocity: vel,
        slope_deg: `${site.slope_deg}`,
        risk_score: `${site.risk_score}`,
        status: phase,
        fuel,
      });

      if (s % 4 === 0) {
        setTelemetryHistory(prev => [...prev.slice(-35), { alt: Math.floor(alt), vel }]);
      }

      if (s >= totalSteps) {
        clearInterval(interval);
        setIsSimulating(false);
        setTelemetry(prev => ({
          ...prev,
          status: 'TOUCHDOWN SUCCESS',
          altitude: 0,
          velocity: 0,
          fuel: 76,
        }));
        setTelemetryHistory(prev => [...prev, { alt: 0, vel: 0 }]);

        try {
          if (thrusterEntityRef.current && !viewer.isDestroyed()) {
            viewer.entities.remove(thrusterEntityRef.current);
            thrusterEntityRef.current = null;
          }
        } catch { }

        // Touchdown: release tracking and hold framed view of the safe landing zone
        try {
          viewer.trackedEntity = undefined;
          const finalCamLat = isPolar ? endLat + 0.35 : (endLat > 0 ? endLat - 0.25 : endLat + 0.25);
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              endLon + 0.15,
              finalCamLat,
              42000, // 42 km altitude: perfectly frames the entire green safe zone and surrounding craters
              ellipsoid
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(isPolar ? -60 : -45),
              roll: 0,
            },
            duration: 2.0,
            maximumHeight: 60000,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
          });
        } catch { }
      }
    }, 50);

    simIntervalRef.current = interval;
  }, [activeSite, isSimulating, clearSimEntities]);

  // ── Telemetry SVG Graph Coords ───────────────────────────────────────────────
  const svgW = 240; const svgH = 60;
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

  return (
    <div className="relative w-full h-[85vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black font-sans select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {!isCesiumLoaded && !loadError && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div
              className="absolute inset-2 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
            <div className="absolute inset-5 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-base">🌕</span>
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-heading font-bold text-white tracking-widest">INITIALISING MOON ENGINE</h3>
            <p className="text-xs font-mono text-cyan-400 mt-1">Calibrating Lunar Ellipsoid &amp; 3D Hazard Map…</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 gap-4 p-8 text-center">
          <span className="text-5xl">⚠️</span>
          <h3 className="text-lg font-heading font-bold text-rose-400">3D Cesium Viewer Failed to Load</h3>
          <p className="text-xs font-mono text-gray-400 max-w-sm">{loadError}</p>
          <p className="text-xs font-mono text-gray-500">Ensure <code className="text-cyan-300">/public/cesium/</code> contains the CesiumJS build files.</p>
        </div>
      )}

      {/* ── Top Header Controls ── */}
      {isCesiumLoaded && (
        <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-center z-20 gap-2 pointer-events-none">
          {/* Layer toggles */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-xl">
            <span className="text-[0.6rem] font-mono text-gray-500 uppercase tracking-widest pr-1">Hazard Layers:</span>
            {[
              { label: '🔴 Craters', active: showCraters, toggle: () => setShowCraters(v => !v), on: 'bg-red-500/20 border-red-400 text-red-300 shadow-sm shadow-red-500/20' },
              { label: '🟡 Slopes', active: showSlopes, toggle: () => setShowSlopes(v => !v), on: 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/20' },
              { label: '🟣 Shadows', active: showShadows, toggle: () => setShowShadows(v => !v), on: 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-sm shadow-indigo-500/20' },
              { label: '🟢 Safe Zones', active: showSafe, toggle: () => setShowSafe(v => !v), on: 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/20' },
            ].map(({ label, active, toggle, on }) => (
              <button
                key={label}
                onClick={toggle}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${active ? on : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Backend Connection Status (GET /lunar-sites) */}
          <div className="pointer-events-auto flex items-center gap-2.5 p-2 px-3 rounded-xl bg-slate-950/85 backdrop-blur-xl border border-white/10 shadow-xl">
            <button
              onClick={fetchSites}
              title="Refresh /lunar-sites from FastAPI backend"
              className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            >
              <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`} />
              <span className="text-[0.68rem] font-mono text-gray-300 group-hover:text-white">
                {backendConnected ? 'lunar-sites: Live' : 'Offline Fallback Active'}
              </span>
            </button>
            <span className="text-[0.62rem] font-mono text-cyan-400 border-l border-white/10 pl-2">
              {isLoadingSites ? 'Syncing…' : `${sites.length} Sites`}
            </span>
          </div>
        </div>
      )}

      {/* ── Left Sidebar: Candidate Landing Sites ── */}
      {isCesiumLoaded && (
        <div className="absolute top-20 left-4 z-20 w-80 max-w-[calc(50vw-2rem)] p-4 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-3 pointer-events-auto">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Candidate Landing Sites</h4>
              <span className="text-[0.6rem] font-mono text-gray-400">GET /lunar-sites</span>
            </div>
            <p className="text-[0.65rem] text-gray-400 font-light mt-0.5">Click a site to fly 3D Moon camera &amp; view real-time hazards</p>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {sites.map((site) => {
              const isSelected = site.id === activeSite.id;
              return (
                <button
                  key={site.id}
                  onClick={() => flyToSite(site)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all duration-300 ${isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-white/4 border-white/8 hover:bg-white/10 hover:border-white/20'
                    }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-gray-100 font-heading leading-tight">{site.name}</span>
                    <span className={`flex-shrink-0 text-[0.6rem] font-mono px-1.5 py-0.5 rounded border ${site.risk_score < 0.12 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                      site.risk_score < 0.20 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                        'bg-orange-500/20 text-orange-300 border-orange-500/40'
                      }`}>
                      {site.risk_label} ({site.risk_score})
                    </span>
                  </div>
                  <p className="text-[0.62rem] text-gray-400 mt-0.5 line-clamp-1">{site.region}</p>
                  <div className="flex gap-2.5 mt-1 text-[0.58rem] font-mono text-cyan-300/80">
                    <span>🕳 {site.hazards.craters.length} craters</span>
                    <span>⛰ slope {site.slope_deg}°</span>
                    <span>🟢 {site.hazards.safe_zones.length} safe zone{site.hazards.safe_zones.length !== 1 ? 's' : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Simulation status pill */}
          {isSimulating && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[0.65rem] font-mono text-cyan-300 font-bold uppercase tracking-wider">{telemetry.status}</span>
            </div>
          )}

          {/* Simulate descent button */}
          <button
            onClick={startLanderSimulation}
            disabled={isSimulating}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSimulating ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>Simulating Descent…</span>
              </>
            ) : (
              <>
                <span></span>
                <span>Simulate Lander Descent</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Right Sidebar: Descent Telemetry HUD ── */}
      {isCesiumLoaded && (
        <div className="absolute top-20 right-4 z-20 w-72 max-w-[calc(50vw-2rem)] p-4 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-3 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Descent Telemetry HUD</h4>
            <span className={`text-[0.6rem] font-mono px-2 py-0.5 rounded border ${telemetry.status === 'TOUCHDOWN SUCCESS'
              ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/50 font-bold'
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
              <span className="text-gray-400 uppercase tracking-wider">Descent Curve Profile</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />Alt</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Vel</span>
              </div>
            </div>
            <div className="w-full bg-slate-950/80 rounded-lg p-1 border border-white/5">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-14 overflow-visible">
                <line x1="0" y1="15" x2={svgW} y2="15" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="0" y1="35" x2={svgW} y2="35" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="0" y1="55" x2={svgW} y2="55" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                {altPts.length > 1 && (
                  <>
                    <polyline fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={altPts.join(' ')} />
                    <circle cx={lx} cy={lay} r="3" fill="#38bdf8" opacity="0.8" />
                    <circle cx={lx} cy={lay} r="2" fill="#ffffff" />
                  </>
                )}
                {velPts.length > 1 && (
                  <>
                    <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2 1.5" strokeLinecap="round" points={velPts.join(' ')} />
                    <circle cx={lx} cy={lvy} r="2" fill="#fbbf24" />
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Altitude', value: `${telemetry.altitude.toLocaleString()} m`, color: 'text-cyan-300' },
              { label: 'Velocity', value: `${telemetry.velocity} m/s`, color: 'text-amber-300' },
              { label: 'Slope Angle', value: `${telemetry.slope_deg}°`, color: 'text-emerald-300' },
              { label: 'Risk Score', value: telemetry.risk_score, color: 'text-rose-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-2 rounded-lg bg-white/5 border border-white/8">
                <span className="text-[0.58rem] font-mono text-gray-400 uppercase tracking-wider">{label}</span>
                <div className={`text-xs font-mono font-bold mt-0.5 ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* RCS Fuel Level */}
          <div className="space-y-1">
            <div className="flex justify-between text-[0.6rem] font-mono text-gray-400">
              <span>RCS Propellant</span>
              <span className={telemetry.fuel < 70 ? 'text-amber-400 font-bold' : 'text-cyan-400 font-bold'}>{telemetry.fuel}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${telemetry.fuel < 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                  }`}
                style={{ width: `${telemetry.fuel}%` }}
              />
            </div>
          </div>

          {/* Active Site Details */}
          <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-[0.62rem] font-mono space-y-1">
            <div className="flex items-center justify-between text-blue-300 font-bold">
              <span>{activeSite.name}</span>
              <span className="text-cyan-400 font-normal">{activeSite.lat}°, {activeSite.lon}°</span>
            </div>
            <p className="text-gray-400 leading-relaxed font-sans text-[0.6rem]">{activeSite.description}</p>
          </div>
        </div>
      )}

      {/* ── Bottom Legend ── */}
      {isCesiumLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3.5 px-5 py-2 rounded-full bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl text-[0.65rem] font-mono text-white pointer-events-none">
          <span className="text-gray-400">Map Legend:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-90" />Craters</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-90" />Slope Hazards</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 opacity-90" />Shadows</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 opacity-90" />Safe Touchdown</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3.5 border-t-2 border-cyan-400 border-dashed" />Descent Path</span>
        </div>
      )}
    </div>
  );
}
