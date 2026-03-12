import cv2
import json
import numpy as np

img = cv2.imread("Plot map.jpeg")
with open("plots_data2.json") as f:
    plots = json.load(f)

# The missing plots to find: 1, 2, 3, 4, 5, 47, 48, 50, 55, 57
# I know from earlier:
# ID 175 is maybe 1. 
# 47 is top middle. 50 is top right of left section.
# Let's just create a grid of ALL plots from top to bottom (y < 2500) that aren't mapped yet

with open("manual_mapping.json") as f:
    mapping = json.load(f)

unmapped = [pid for pid in plots if pid not in mapping]

items = []
for pid in unmapped:
    pts = np.array(plots[pid]["points"])
    x, y, w, h = cv2.boundingRect(pts)
    items.append({
        "pid": pid,
        "x": x, "y": y, "w": w, "h": h,
    })

# Filter out very small noise again
items = [i for i in items if i["w"] > 30 and i["h"] > 30]

# Create a small grid for these
cols = 5
rows = (len(items) + cols - 1) // cols
if rows == 0: rows = 1
cell_w, cell_h = 300, 300
canvas_w = cols * cell_w
canvas_h = rows * cell_h
canvas = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255

for idx, item in enumerate(items):
    x, y, w, h = item["x"], item["y"], item["w"], item["h"]
    # Provide a bit of padding around the bounding box
    pad = 20
    x1, y1 = max(0, x-pad), max(0, y-pad)
    x2, y2 = min(img.shape[1], x+w+pad), min(img.shape[0], y+h+pad)
    roi = img[y1:y2, x1:x2]
    
    scale = min((cell_w-40)/roi.shape[1], (cell_h-40)/roi.shape[0])
    new_w, new_h = int(roi.shape[1]*scale), int(roi.shape[0]*scale)
    if new_w == 0 or new_h == 0: continue
    
    roi_resized = cv2.resize(roi, (new_w, new_h))
    
    row = idx // cols
    col = idx % cols
    
    start_x = col * cell_w + (cell_w - new_w) // 2
    start_y = row * cell_h + 30 + (cell_h - 30 - new_h) // 2
    
    canvas[start_y:start_y+new_h, start_x:start_x+new_w] = roi_resized
    
    cv2.putText(canvas, f"ID:{item['pid']}", (col * cell_w + 10, row * cell_h + 20), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

cv2.imwrite("grid2.jpg", canvas)
print("Saved grid2.jpg")
