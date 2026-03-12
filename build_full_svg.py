import cv2
import numpy as np
import json

img = cv2.imread("Plot map.jpeg")
h, w, _ = img.shape

with open("plots_data2.json") as f:
    polygons = json.load(f)
    
with open("final_mapping.json") as f:
    mapping = {k: int(v) for k, v in json.load(f).items()}
    
areas = {
    1: 38009, 30: 7611,
    2: 54497, 31: 11429,
    3: 21882, 32: 14822,
    4: 12066, 33: 10000,
    5: 13832, 34: 10000,
    6: 6447, 35: 10000,
    7: 12068, 36: 11250,
    8: 14430, 37: 11250,
    9: 15404, 38: 10000,
    10: 13538, 39: 10000,
    11: 12374, 40: 10891,
    12: 10896, 41: 9541,
    13: 11969, 42: 10000,
    14: 12225, 43: 11250,
    15: 10795, 44: 20736,
    16: 10000, 45: 8750,
    17: 10000, 46: 10000,
    18: 10000, 47: 8750,
    19: 10000, 48: 9730,
    20: 10000, 49: 10000,
    21: 10000, 50: 16746,
    22: 11250, 51: 14452,
    23: 11250, 52: 10000,
    24: 10000, 53: 10000,
    25: 10000, 54: 10841,
    26: 10000, 55: 14728,
    27: 10000, 56: 5750,
    28: 10000, 57: 20127,
    29: 10000
}

# 1. Classify all polygons
full_map_data = []

plot_mask = np.zeros((h, w), dtype=np.uint8)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

for pid_str, data in polygons.items():
    pts = np.array(data["points"])
    cv2.fillPoly(plot_mask, [pts], 255)
    
    if pid_str in mapping:
        plot_num = mapping[pid_str]
        full_map_data.append({
            "id": f"plot_{plot_num}",
            "type": "plot",
            "label": str(plot_num),
            "area": areas.get(plot_num, 0),
            "points": data["points"]
        })
    else:
        # It's an unmapped polygon. What is it?
        # Get color at center
        cx, cy = data["center"]
        color_hsv = hsv[cy, cx]
        hue = color_hsv[0]
        
        # Check if green
        # hue in OpenCV is 0-179. Green is roughly 40-80
        if 35 <= hue <= 85:
            full_map_data.append({
                "id": f"garden_{pid_str}",
                "type": "garden",
                "label": "Garden",
                "points": data["points"]
            })
        elif hue >= 130 or hue <= 10 or (hue < 35 and color_hsv[1] > 100):
            # Pink/Red/Orange usually resort
            full_map_data.append({
                "id": f"resort_{pid_str}",
                "type": "resort",
                "label": "Resort",
                "points": data["points"]
            })
        # Ignore small unclassified fragments

# 2. Extract Roads
# From isolate_map_refined.py logic:
lower_grey = np.array([0, 0, 100])
upper_grey = np.array([179, 30, 200])
grey_mask = cv2.inRange(hsv, lower_grey, upper_grey)

kernel = np.ones((100, 100), np.uint8)
near_plots = cv2.dilate(plot_mask, kernel, iterations=1)

combined_mask = cv2.bitwise_or(plot_mask, cv2.bitwise_and(grey_mask, near_plots))

highway_rect = np.zeros((h, w), dtype=np.uint8)
cv2.rectangle(highway_rect, (1400, 150), (2800, 320), 255, -1)
combined_mask = cv2.bitwise_or(combined_mask, cv2.bitwise_and(grey_mask, highway_rect))

combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

cv2.rectangle(combined_mask, (0, 3100), (1400, h), 0, -1)
cv2.rectangle(combined_mask, (0, 0), (1200, 600), 0, -1)
cv2.rectangle(combined_mask, (2100, 300), (w, 1000), 0, -1)
cv2.rectangle(combined_mask, (1500, 3200), (w, h), 0, -1)

# Roads = combined_mask minus plot_mask
# Wait, let's dilate the plot mask slightly to create a slight gap, or just subtract directly.
road_mask = cv2.bitwise_and(combined_mask, cv2.bitwise_not(plot_mask))

# Find contours for the roads
contours, _ = cv2.findContours(road_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

road_id = 0
for cnt in contours:
    area = cv2.contourArea(cnt)
    if area > 2000: # Filter noise
        epsilon = 0.005 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        full_map_data.append({
            "id": f"road_{road_id}",
            "type": "road",
            "label": "Road",
            "points": approx.reshape(-1, 2).tolist()
        })
        road_id += 1

# Save to full_map.json
with open("webapp/src/assets/full_map_vectors.json", "w") as f:
    json.dump(full_map_data, f)
    
print(f"Exported {len(full_map_data)} total vector polygons.")
