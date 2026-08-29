import cv2
import numpy as np

def detect_shadows(img: np.ndarray, low_thresh: int = 40) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    shadow_mask = (gray < low_thresh).astype(np.float32)
    return shadow_mask

def estimate_slopes(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobelx**2 + sobely**2)
    norm_slope = (grad_mag - grad_mag.min()) / (grad_mag.max() - grad_mag.min() + 1e-6)
    return norm_slope.astype(np.float32)
