import cv2
import json
import base64
import numpy as np

img = cv2.imread("Plot map.jpeg")
with open("plots_data2.json") as f:
    plots = json.load(f)

html = "<html><body style='display:flex; flex-wrap:wrap; background:#333;'>"

# Sort by y, then x to make it somewhat logical
items = []
for pid, data in plots.items():
    pts = np.array(data["points"])
    x, y, w, h = cv2.boundingRect(pts)
    items.append({
        "pid": pid,
        "x": x, "y": y, "w": w, "h": h,
        "pts": pts
    })

items.sort(key=lambda i: (i["y"] // 100, i["x"]))

for item in items:
    # Skip clearly too small/large
    if item["w"] < 20 or item["h"] < 20 or item["w"] > 500 or item["h"] > 500:
        continue
        
    x, y, w, h = item["x"], item["y"], item["w"], item["h"]
    roi = img[y:y+h, x:x+w].copy()
    
    # Encode
    _, buffer = cv2.imencode('.jpg', roi)
    b64 = base64.b64encode(buffer).decode('utf-8')
    
    html += f"<div style='margin:10px; padding:10px; background:#fff; border-radius:8px; text-align:center;'>"
    html += f"<h3 style='margin:0 0 5px 0;'>ID: {item['pid']}</h3>"
    html += f"<img src='data:image/jpeg;base64,{b64}' style='max-width:200px; max-height:200px;'/>"
    html += "</div>"

html += "</body></html>"

with open("mapping_helper.html", "w") as f:
    f.write(html)
    
print("Generated mapping_helper.html")
