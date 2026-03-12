import cv2
import json
import numpy as np

with open("manual_mapping.json") as f:
    mapping = {k: int(v) for k, v in json.load(f).items()}

with open("plots_data2.json") as f:
    plots = json.load(f)

img = cv2.imread("Plot map.jpeg")

# The required plots: 1..57
all_plots = set(range(1, 58))
found_plots = set(mapping.values())
missing = all_plots - found_plots
print("Missing numbers:", sorted(list(missing)))

# Print info about unmapped large contours
unmapped = {}
for pid, data in plots.items():
    if pid not in mapping:
        pts = np.array(data["points"])
        area = cv2.contourArea(pts)
        if area > 1000:
            M = cv2.moments(pts)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                unmapped[pid] = {"area": area, "cx": cx, "cy": cy}

# Sort geographically (top to bottom)
sorted_unmapped = sorted(unmapped.items(), key=lambda x: x[1]["cy"])
for pid, info in sorted_unmapped:
    print(f"ID: {pid}, cx: {info['cx']}, cy: {info['cy']}, area: {info['area']}")

# Let's save a visualization just showing these unmapped shapes with their IDs HUGE
output = img.copy()
for pid, info in unmapped.items():
    pts = np.array(plots[pid]["points"])
    cv2.fillPoly(output, [pts], (0,0,255))
    cv2.putText(output, str(pid), (info['cx']-30, info['cy']+10), cv2.FONT_HERSHEY_SIMPLEX, 3, (255,255,255), 5)

cv2.imwrite("missing_only.jpg", output)
