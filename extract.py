import cv2
import numpy as np
import json
import os

image_path = "Plot map.jpeg"
output_image_path = "map_annotated.jpg"
output_json_path = "plots_data.json"

# Load image
img = cv2.imread(image_path)
if img is None:
    print(f"Error: Could not load image at {image_path}")
    exit(1)

# Convert to HSV for better color segmentation
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# Define color range for the yellowish/orange plots
# We might need to tune these
lower_yellow = np.array([15, 50, 50])
upper_yellow = np.array([45, 255, 255])

# Mask for yellow/orange regions
mask1 = cv2.inRange(hsv, lower_yellow, upper_yellow)

# Also there's some darker orange
lower_orange = np.array([5, 50, 50])
upper_orange = np.array([15, 255, 255])
mask2 = cv2.inRange(hsv, lower_orange, upper_orange)

# The resort is pinkish/purple
lower_pink = np.array([140, 30, 100])
upper_pink = np.array([170, 150, 255])
mask3 = cv2.inRange(hsv, lower_pink, upper_pink)

# Combine masks for all plots (+ resort maybe)
mask = cv2.bitwise_or(mask1, mask2)
# We can do resort separately or together. Let's start with just yellow/orange
# mask = cv2.bitwise_or(mask, mask3)

# Morphological operations to clean up
kernel = np.ones((5,5), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

# Save mask for debugging
cv2.imwrite("mask_debug.jpg", mask)

# Find contours
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

output_img = img.copy()
plots_data = {}

plot_id = 0
for cnt in contours:
    # Filter small noisy contours
    area = cv2.contourArea(cnt)
    if area > 1000: # Threshold might need tuning based on image size
        # Approximate contour to smooth it and reduce points
        epsilon = 0.005 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        # Draw on image
        cv2.drawContours(output_img, [approx], -1, (0, 255, 0), 3)
        
        # Find center for labeling
        M = cv2.moments(cnt)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            
            cv2.putText(output_img, str(plot_id), (cX, cY), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 4)
            
            # Save data
            # Flatten the points array to [x, y]
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
print("Saved annotated image and JSON data.")
