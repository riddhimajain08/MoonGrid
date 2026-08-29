import numpy as np
import cv2

def compute_risk_map(enhanced_img: np.ndarray, shadow_mask: np.ndarray, slope_mask: np.ndarray, boxes: list = None) -> np.ndarray:
    h, w = enhanced_img.shape[:2]
    crater_mask = np.zeros((h, w), dtype=np.float32)

    if boxes:
        for box in boxes:
            x1, y1, x2, y2 = map(int, box[:4])
            cv2.rectangle(crater_mask, (x1, y1), (x2, y2), 1.0, -1)

    # Weighted combination: 40% Craters/Boulders, 30% Shadows, 30% Slopes
    risk_map = (0.4 * crater_mask) + (0.3 * shadow_mask) + (0.3 * slope_mask)
    risk_map = np.clip(risk_map, 0.0, 1.0)
    return risk_map
