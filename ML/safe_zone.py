import numpy as np
from scipy import ndimage

def find_safe_zones(risk_map: np.ndarray, risk_threshold: float = 0.3, min_zone_area_px: int = 400, top_n: int = 5) -> list[dict]:
    safe_mask = risk_map < risk_threshold
    labeled_array, num_features = ndimage.label(safe_mask)
    candidates = []

    for label_id in range(1, num_features + 1):
        blob_coords = np.argwhere(labeled_array == label_id)
        area_px = len(blob_coords)
        if area_px < min_zone_area_px:
            continue

        centroid_y, centroid_x = blob_coords.mean(axis=0)
        radius_px = np.sqrt(area_px / np.pi)
        blob_risk_values = risk_map[labeled_array == label_id]
        avg_risk_score = float(blob_risk_values.mean())

        candidates.append({
            "x": int(centroid_x),
            "y": int(centroid_y),
            "radius_px": float(round(radius_px, 1)),
            "risk_score": round(avg_risk_score, 3),
            "area_px": area_px,
        })

    candidates.sort(key=lambda c: (c["risk_score"], -c["area_px"]))

    ranked_zones = []
    for i, c in enumerate(candidates[:top_n]):
        ranked_zones.append({
            "id": f"zone_{i+1}",
            "x": c["x"],
            "y": c["y"],
            "radius_px": c["radius_px"],
            "risk_score": c["risk_score"],
            "rank": i + 1,
            "area_m2": c["area_px"],
        })
    return ranked_zones

def get_recommended_zone_id(safe_zones: list[dict]) -> str | None:
    return safe_zones[0]["id"] if safe_zones else None
