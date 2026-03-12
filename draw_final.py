import cv2
import json
import numpy as np

img = cv2.imread("Plot map.jpeg")
with open("plots_data2.json") as f:
    plots = json.load(f)

# Update mapping with new finds
additional_mapping = {
    "148": 50,
    "150": 48,
    "160": 47,
    "180": 2
}

with open("manual_mapping.json") as f:
    mapping = json.load(f)

mapping.update(additional_mapping)

with open("manual_mapping.json", "w") as f:
    json.dump(mapping, f, indent=2)

# Now let's draw them
output = img.copy()

for pid, data in plots.items():
    pts = np.array(data["points"])
    
    if pid in mapping:
        # Draw green mask for mapped
        cv2.fillPoly(output, [pts], (0, 255, 0))
        # Draw the plot number
        M = cv2.moments(pts)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            cv2.putText(output, str(mapping[pid]), (cx-10, cy+10), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 3)
    else:
        # Draw red mask for unmapped
        cv2.fillPoly(output, [pts], (0, 0, 255))
        # Draw the PID
        M = cv2.moments(pts)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            cv2.putText(output, f"ID:{pid}", (cx-20, cy+10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

# Blend with original
alpha = 0.5
cv2.addWeighted(output, alpha, img, 1 - alpha, 0, output)

cv2.imwrite("final_map_check.jpg", output)
print("Saved final_map_check.jpg. Remaining IDs:", [p for p in plots if p not in mapping and cv2.contourArea(np.array(plots[p]["points"])) > 1000])

