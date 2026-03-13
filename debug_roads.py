import cv2
import numpy as np

def debug_roads():
    image_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/cleaner_plots.png"
    img = cv2.imread(image_path)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Blue mask (arterial roads)
    mask_blue = cv2.inRange(hsv, np.array([90, 50, 40]), np.array([135, 255, 255]))
    
    cv2.imwrite("/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/debug_road_mask.png", mask_blue)
    
    # Try different closing
    k1 = cv2.morphologyEx(mask_blue, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    cv2.imwrite("/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/debug_road_mask_close5.png", k1)
    
    k2 = cv2.morphologyEx(mask_blue, cv2.MORPH_CLOSE, np.ones((10,10), np.uint8))
    cv2.imwrite("/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/debug_road_mask_close10.png", k2)

if __name__ == "__main__":
    debug_roads()
