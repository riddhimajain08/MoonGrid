"use client";

import { useEffect, useRef } from "react";
import type * as CesiumType from "cesium";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
    Cesium?: any;
  }
}

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumType.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    let cancelled = false;

    (async () => {
      const Cesium = await import("cesium");
      await import("cesium/Build/Cesium/Widgets/widgets.css");

      if (cancelled || !containerRef.current) return;

      window.CESIUM_BASE_URL = "/cesium";

      const MOON_RADIUS = 1737400.0;
      const moonEllipsoid = new Cesium.Ellipsoid(MOON_RADIUS, MOON_RADIUS, MOON_RADIUS);

      const baseLayer = Cesium.ImageryLayer.fromProviderAsync(
        Cesium.SingleTileImageryProvider.fromUrl("/moonSmall.jpg", {
          rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
        })
      );

      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer,
        ellipsoid: moonEllipsoid,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        timeline: false,
        animation: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider({ ellipsoid: moonEllipsoid }),
      });

      
      viewer.scene.skyAtmosphere!.show = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.backgroundColor = Cesium.Color.BLACK;
      viewer.scene.skyBox!.show = true;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(0, 0, MOON_RADIUS * 3.5, moonEllipsoid),
        duration: 1.5,
      });

      viewerRef.current = viewer;
    })();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full overflow-hidden rounded-xl border border-white/10"
    />
  );
}