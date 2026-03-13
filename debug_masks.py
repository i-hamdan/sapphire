import cv2
import numpy as np
import os

def debug_masks():
    image_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/cleaner_plots.png"
    img = cv2.imread(image_path)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    ranges = {
        "highway": ([0, 150, 150], [10, 255, 255]),      # Red
        "plot": ([10, 50, 50], [40, 255, 255]),        # Yellow/Orange Broadened
        "road": ([100, 100, 100], [130, 255, 255]),     # Blue
        "green": ([35, 50, 40], [90, 255, 255]),       # Green
        "resort": ([130, 30, 50], [170, 255, 255])    # Light Pin/Purple
    }

    for name, bounds in ranges.items():
        mask = cv2.inRange(hsv, np.array(bounds[0]), np.array(bounds[1]))
        cv2.imwrite(f"/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/mask_{name}.png", mask)
        print(f"Saved mask_{name}.png")

if __name__ == "__main__":
    debug_masks()
