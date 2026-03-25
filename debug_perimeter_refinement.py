import cv2
import numpy as np

def analyze_image():
    image_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/cleaner_plots_only_plots.png"
    img = cv2.imread(image_path)
    if img is None: return

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Sample center region
    h, w = hsv.shape[:2]
    roi = hsv[h//2-50:h//2+50, w//2-50:w//2+50]
    
    avg_hsv = np.mean(roi, axis=(0, 1))
    print(f"Average HSV at center: {avg_hsv}")
    
    # Try a black mask
    mask_black = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 255, 80]))
    black_pixels = cv2.countNonZero(mask_black)
    print(f"Black pixels found: {black_pixels}")
    
    # Save a debug image with different masks
    mask_yellow_broad = cv2.inRange(hsv, np.array([5, 10, 10]), np.array([45, 255, 255]))
    cv2.imwrite("/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/debug_broad_mask.png", mask_yellow_broad)
    cv2.imwrite("/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/debug_black_mask.png", mask_black)

if __name__ == "__main__":
    analyze_image()
