import cv2
import json
import numpy as np

with open("manual_mapping.json") as f:
    mapping = {k: int(v) for k, v in json.load(f).items()}

with open("plots_data2.json") as f:
    plots = json.load(f)

# Hardcode the ones we found
mapping["175"] = 1
mapping["174"] = 2
mapping["171"] = 3
mapping["158"] = 4
mapping["157"] = 57

# Let's find 5 and 55.
# 6 is ID 134. 5 must be right above 6.
pts_6 = np.array(plots["134"]["points"])
M6 = cv2.moments(pts_6)
cx_6 = int(M6["m10"] / M6["m00"])
cy_6 = int(M6["m01"] / M6["m00"])

# 54 is ID 138. 55 must be right above 54.
pts_54 = np.array(plots["138"]["points"])
M54 = cv2.moments(pts_54)
cx_54 = int(M54["m10"] / M54["m00"])
cy_54 = int(M54["m01"] / M54["m00"])

# Find unmapped contours
unmapped = {}
for pid, data in plots.items():
    if pid not in mapping:
        pts = np.array(data["points"])
        area = cv2.contourArea(pts)
        if area > 1000:
            M = cv2.moments(pts)
            if M["m00"] != 0:
                unmapped[pid] = {
                    "cx": int(M["m10"] / M["m00"]),
                    "cy": int(M["m01"] / M["m00"])
                }

# Find contour closest to (cx_6, cy_6 - some_y) for 5
best_5 = None
best_dist_5 = float('inf')
for pid, info in unmapped.items():
    if info["cy"] < cy_6 and abs(info["cx"] - cx_6) < 150:
        dist = ((info["cx"] - cx_6)**2 + (info["cy"] - cy_6)**2)**0.5
        if dist < best_dist_5:
            best_dist_5 = dist
            best_5 = pid

# Find contour closest to (cx_54, cy_54 - some_y) for 55
best_55 = None
best_dist_55 = float('inf')
for pid, info in unmapped.items():
    if info["cy"] < cy_54 and abs(info["cx"] - cx_54) < 150:
        dist = ((info["cx"] - cx_54)**2 + (info["cy"] - cy_54)**2)**0.5
        if dist < best_dist_55:
            best_dist_55 = dist
            best_55 = pid

print(f"Computed Plot 5 -> ID {best_5} (distance {best_dist_5})")
print(f"Computed Plot 55 -> ID {best_55} (distance {best_dist_55})")

if best_5: mapping[best_5] = 5
if best_55: mapping[best_55] = 55

with open("final_mapping.json", "w") as f:
    json.dump(mapping, f, indent=2)

missing = set(range(1, 58)) - set(mapping.values())
print(f"Remaining missing: {missing}")

