import cv2
import numpy as np

img = cv2.imread("Plot map.jpeg")
original = img.copy()
h, w, _ = img.shape

# We want to isolate the green area and the colored blocks in the middle.
# Let's create an empty transparent image
output = np.zeros((h, w, 4), dtype=np.uint8)

# Convert to HSV to find the colored regions we want to KEEP
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# Define color ranges to KEEP:
# - Yellows (plots)
# - Oranges/Reds (resorts/other plots)
# - Greens
# - Greys (roads)

# Let's try grabbing everything EXCEPT the outer white/textured regions
# A simpler approach: create a mask of the "active area"
# The active area is essentially bounded by the outer plots and the green resort.
# We can find all non-white/non-noise pixels, get their bounding box, or draw a convex hull. 
# But it's easier to explicitly mask out the top left (logo), right side (compass), bottom (table).

# Let's use the plots_data2 we already have! It has the exact coordinates of every plot and green area!
import json
with open("plots_data2.json") as f:
    polygons = json.load(f)

# Create a master mask where all known polygons are drawn
master_mask = np.zeros((h, w), dtype=np.uint8)

for pid, data in polygons.items():
    pts = np.array(data["points"])
    # Dilate slightly to include borders between plots
    cv2.fillPoly(master_mask, [pts], 255)

# We also want to keep the roads. Roads are between polygons.
# If we dilate the master mask heavily, we can capture the active island.
kernel_large = np.ones((80, 80), np.uint8)
active_island = cv2.dilate(master_mask, kernel_large, iterations=1)
# Then close holes in the middle
active_island = cv2.morphologyEx(active_island, cv2.MORPH_CLOSE, kernel_large, iterations=2)

# Now active_island represents the general "blob" of the farm area.
# Let's try to refine it so we don't grab the table. 
# The table is below y=3600 (approx) and the active island shouldn't go down there if we didn't have plots there.
# Let's check max Y of plots
max_y = 0
for pid, data in polygons.items():
    pts = np.array(data["points"])
    my = np.max(pts[:, 1])
    if my > max_y: max_y = my

print("Max Y of any plot:", max_y) # 4165

# It seems plots go all the way down. The table is on the left.
# Wait, let's just use the `active_island` mask to cut out the image. 

# Apply the island mask to the original image
# output[y, x] = [B, G, R, 255] where active_island is 255
output[:, :, :3] = img
output[:, :, 3] = active_island

# The active island might be too loose.
# Let's write it out and see what it looks like
cv2.imwrite("webapp/src/assets/isolated_map.png", output)
