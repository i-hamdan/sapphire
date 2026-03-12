import cv2
import numpy as np
import json

img = cv2.imread("Plot map.jpeg")
h, w, _ = img.shape
output = np.zeros((h, w, 4), dtype=np.uint8)

with open("plots_data2.json") as f:
    polygons = json.load(f)

# The goal is to ONLY keep the plots, the resort, and the roads connecting them.
# The table is in the bottom left. Let's explicitly kill the bottom left rectangle.
# The logo is top left.
# The compass is top right.
# The highway road is top middle.

# Create a mask just of the plots themselves.
plot_mask = np.zeros((h, w), dtype=np.uint8)
for pid, data in polygons.items():
    pts = np.array(data["points"])
    cv2.fillPoly(plot_mask, [pts], 255)

# Find roads. Roads are the greyish area BETWEEN the plots.
# Let's find grey colors in the original image.
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
# Grey has low saturation, and reasonable value
lower_grey = np.array([0, 0, 100])
upper_grey = np.array([179, 30, 200])
grey_mask = cv2.inRange(hsv, lower_grey, upper_grey)

# Only keep grey that is "near" the plots. 
# Dilate the plots a bit to capture adjacent roads.
kernel = np.ones((100, 100), np.uint8)
near_plots = cv2.dilate(plot_mask, kernel, iterations=1)

# Combined mask = plots + (grey areas near plots)
combined_mask = cv2.bitwise_or(plot_mask, cv2.bitwise_and(grey_mask, near_plots))

# We should also capture the 6 Lane Highway at the top.
# It has text "Bhopal-Raisen 6 Lane Highway"
# Let's just create a bounding box for the highway based on its known position, roughly y=150 to y=300, x=1400 to x=2800
highway_rect = np.zeros((h, w), dtype=np.uint8)
cv2.rectangle(highway_rect, (1400, 150), (2800, 320), 255, -1)
combined_mask = cv2.bitwise_or(combined_mask, cv2.bitwise_and(grey_mask, highway_rect))

# Clean up the combined mask (close small holes inside)
combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

# Remove explicit noise areas completely 
# Table (bottom left)
cv2.rectangle(combined_mask, (0, 3100), (1400, h), 0, -1)
# Logo (top left)
cv2.rectangle(combined_mask, (0, 0), (1200, 600), 0, -1)
# Compass (top right)
cv2.rectangle(combined_mask, (2100, 300), (w, 1000), 0, -1)
# Text blocks in bottom right
cv2.rectangle(combined_mask, (1500, 3200), (w, h), 0, -1)

# Apply mask!
output[:,:,:3] = img
output[:,:,3] = combined_mask

# Optionally, maybe the user wants JUST the plots + roads and EVERYTHING perfectly transparent.
cv2.imwrite("webapp/src/assets/isolated_map.png", output)
print("Saved isolated_map.png!")
