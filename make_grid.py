import cv2
import json
import numpy as np

img = cv2.imread("Plot map.jpeg")
with open("plots_data2.json") as f:
    plots = json.load(f)

# Sort by y, then x
items = []
for pid, data in plots.items():
    pts = np.array(data["points"])
    x, y, w, h = cv2.boundingRect(pts)
    items.append({
        "pid": pid,
        "x": x, "y": y, "w": w, "h": h,
    })

items.sort(key=lambda i: (i["y"] // 100, i["x"]))

# Filter out too small/large
valid_items = []
for item in items:
    if item["w"] < 20 or item["h"] < 20 or item["w"] > 400 or item["h"] > 400:
        continue
    valid_items.append(item)

# Create a large blank canvas
cols = 10
rows = (len(valid_items) + cols - 1) // cols
cell_w, cell_h = 200, 200
canvas_w = cols * cell_w
canvas_h = rows * cell_h
canvas = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255

for idx, item in enumerate(valid_items):
    x, y, w, h = item["x"], item["y"], item["w"], item["h"]
    roi = img[y:y+h, x:x+w]
    
    # Resize ROI to fit in cell_w-20, cell_h-40 maintaining aspect ratio
    scale = min((cell_w-20)/w, (cell_h-40)/h)
    new_w, new_h = int(w*scale), int(h*scale)
    if new_w == 0 or new_h == 0: continue
    
    roi_resized = cv2.resize(roi, (new_w, new_h))
    
    row = idx // cols
    col = idx % cols
    
    start_x = col * cell_w + (cell_w - new_w) // 2
    start_y = row * cell_h + 30 + (cell_h - 30 - new_h) // 2
    
    canvas[start_y:start_y+new_h, start_x:start_x+new_w] = roi_resized
    
    cv2.putText(canvas, f"ID:{item['pid']}", (col * cell_w + 10, row * cell_h + 20), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

cv2.imwrite("grid.jpg", canvas)
print("Saved grid.jpg")
