import cv2
import numpy as np
import json
import pytesseract

image_path = "Plot map.jpeg"
json_path = "plots_data2.json"
output_mapping_path = "plot_mapping.json"

img = cv2.imread(image_path)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# Enhance text visibility: adaptive thresholding or Otsu
thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

with open(json_path) as f:
    plots_data = json.load(f)

mapping = {}
mapped_count = 0

for plot_id_str, data in plots_data.items():
    points = np.array(data["points"], dtype=np.int32)
    # Bounding box
    x, y, w, h = cv2.boundingRect(points)
    
    # Expand bounding box slightly? Actually text should be in center
    # M = cv2.moments(points)
    # Just crop the bonding box
    # Crop from gray or thresh? Tesseract likes black text on white background or white text on black depending on config.
    # standard grayscale inverted image:
    roi = img[max(0, y):y+h, max(0, x):x+w]
    
    # Process ROI to make the number very clear
    roi_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    
    # Otsu thresholding on ROI specifically
    _, roi_thresh = cv2.threshold(roi_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Config for digits only
    custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789'
    
    text = pytesseract.image_to_string(roi_thresh, config=custom_config).strip()
    
    # In case the first attempt fails, try the original roi without thresholding
    if not text.isdigit():
        text = pytesseract.image_to_string(roi_gray, config=custom_config).strip()
    
    # Take first word/number found
    number_found = None
    for word in text.replace("\n", " ").split():
        if word.isdigit():
            val = int(word)
            # The valid plots are 1 to 57
            if 1 <= val <= 57:
                number_found = val
                break
                
    if number_found is not None:
        mapping[int(plot_id_str)] = number_found
        mapped_count += 1
        print(f"Shape {plot_id_str} mapped to Plot {number_found}")
    else:
        # Fallback to empty
        pass

# Check for duplicates or missing plots
mapped_values = list(mapping.values())
missing = []
for i in range(1, 58):
    if i not in mapped_values:
        missing.append(i)

print(f"\nSuccessfully mapped {mapped_count} plots out of 57.")
print(f"Missing plots: {missing}")

with open(output_mapping_path, 'w') as f:
    json.dump({
        "mapping": mapping,
        "missing": missing
    }, f, indent=2)
