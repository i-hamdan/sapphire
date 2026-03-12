import cv2
import numpy as np
import json
import math

image_path = "Plot map.jpeg"
output_image_path = "map_annotated2.jpg"
output_json_path = "plots_data2.json"

img = cv2.imread(image_path)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# Mask for yellow/orange regions (the plots)
lower_yellow = np.array([10, 50, 50])
upper_yellow = np.array([45, 255, 255])
mask_plots = cv2.inRange(hsv, lower_yellow, upper_yellow)

lower_orange = np.array([0, 50, 50])
upper_orange = np.array([10, 255, 255])
mask_plots2 = cv2.inRange(hsv, lower_orange, upper_orange)

# The green area
lower_green = np.array([45, 50, 50])
upper_green = np.array([85, 255, 255])
mask_green = cv2.inRange(hsv, lower_green, upper_green)

# The resort (pinkish gray)
lower_pink = np.array([140, 30, 100])
upper_pink = np.array([170, 150, 255])
mask_pink = cv2.inRange(hsv, lower_pink, upper_pink)

# Combine plot masks
mask = cv2.bitwise_or(mask_plots, mask_plots2)
mask = cv2.bitwise_or(mask, mask_green)
mask = cv2.bitwise_or(mask, mask_pink)

# Detect the white/gray dashed lines separating the plots to cut them
lower_white = np.array([0, 0, 180])
upper_white = np.array([180, 50, 255])
mask_white = cv2.inRange(hsv, lower_white, upper_white)

# Subtract white lines from the mask to separate plots
# We dilate the white mask slightly to ensure good separation
kernel_white = np.ones((3,3), np.uint8)
mask_white_dilated = cv2.dilate(mask_white, kernel_white, iterations=1)

# Also detect black text/lines that might separate
lower_black = np.array([0, 0, 0])
upper_black = np.array([180, 255, 80])
mask_black = cv2.inRange(hsv, lower_black, upper_black)
mask_black_dilated = cv2.dilate(mask_black, kernel_white, iterations=1)

mask = cv2.bitwise_and(mask, cv2.bitwise_not(mask_white_dilated))
mask = cv2.bitwise_and(mask, cv2.bitwise_not(mask_black_dilated))

# Morphological open to remove noise
kernel_small = np.ones((3,3), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_small)
# We avoid MORPH_CLOSE because it merges the separated plots back together

contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

output_img = img.copy()
plots_data = {}
plot_id = 0

for cnt in contours:
    area = cv2.contourArea(cnt)
    if area > 1000 and area < 500000: # Filter small noise and the whole page frame
        epsilon = 0.01 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        cv2.drawContours(output_img, [approx], -1, (0, 0, 255), 2)
        
        M = cv2.moments(cnt)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            
            cv2.putText(output_img, str(plot_id), (cX, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
            
            points = approx.reshape(-1, 2).tolist()
            plots_data[plot_id] = {
                "points": points,
                "center": [cX, cY]
            }
            plot_id += 1

cv2.imwrite(output_image_path, output_img)
with open(output_json_path, 'w') as f:
    json.dump(plots_data, f, indent=2)

print(f"Extracted {plot_id} shapes.")
