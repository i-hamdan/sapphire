import cv2
import numpy as np
import json
import os
import pytesseract
from skimage.morphology import skeletonize

def process_map():
    image_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/cleaner_plots.png"
    output_image_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/annotated_plots.png"
    output_blueprint_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/annotated_blueprint.png"
    output_json_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/plots_data_new.json"

    img = cv2.imread(image_path)
    if img is None: return
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. Precise Masks
    mask_yellow = cv2.inRange(hsv, np.array([10, 30, 30]), np.array([45, 255, 255]))
    mask_blue = cv2.inRange(hsv, np.array([90, 50, 40]), np.array([135, 255, 255]))
    
    # Canny to find thin black boundaries
    edges = cv2.Canny(gray, 50, 150)
    
    # Combine dividers (Blue roads + Black lines from Canny)
    dividers = cv2.bitwise_or(mask_blue, edges)
    # Dilate dividers slightly to ensure cuts are complete
    dividers = cv2.dilate(dividers, np.ones((2,2), np.uint8), iterations=1)
    
    # Cut the plots
    plot_mask = cv2.bitwise_and(mask_yellow, cv2.bitwise_not(dividers))
    
    # Minimal erosion to break any single-pixel bridges not caught by edges
    plot_mask = cv2.erode(plot_mask, np.ones((2,2), np.uint8), iterations=1)
    
    # Fill internal number holes using hierarchy
    contours, hierarchy = cv2.findContours(plot_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is not None:
        for i in range(len(contours)):
            if hierarchy[0][i][3] != -1:
                cv2.drawContours(plot_mask, [contours[i]], -1, 255, -1)
    
    # Smooth the mask to remove pixel stairs
    plot_mask = cv2.medianBlur(plot_mask, 5)
    
    # Find final plots
    cnts, _ = cv2.findContours(plot_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    plots_raw = []
    
    def smooth_contour(cnt, epsilon_factor=0.004, fixed_epsilon=None):
        if fixed_epsilon is not None:
            epsilon = fixed_epsilon
        else:
            epsilon = epsilon_factor * cv2.arcLength(cnt, True)
        return cv2.approxPolyDP(cnt, epsilon, True)

    for cnt in cnts:
        area = cv2.contourArea(cnt)
        if area < 300: continue
        
        approx = smooth_contour(cnt, 0.003) # Slightly more precise for plots
        M = cv2.moments(cnt)
        if M["m00"] == 0: continue
        cX, cY = int(M["m10"] / M["m00"]), int(M["m01"] / M["m00"])
        
        plots_raw.append({"points": approx.reshape(-1, 2).tolist(), "center": [cX, cY], "area": area})

    annotated_img = img.copy()
    # Create blueprint background (10% opacity of original, faded to white)
    blueprint_img = cv2.addWeighted(img, 0.1, np.full(img.shape, 255, dtype=np.uint8), 0.9, 0)
    full_map_data = []
    
    # OCR Logic
    processed_plots = []
    for p in plots_raw:
        pts = np.array(p["points"])
        x, y, w, h = cv2.boundingRect(pts)
        
        # Crop and isolate plot
        crop = img[y:y+h, x:x+w].copy()
        
        # Create a local mask for the plot polygon
        local_pts = pts - [x, y]
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [local_pts], 255)
        
        # Use mask to remove background clutter from crop
        crop_isolated = cv2.bitwise_and(crop, crop, mask=mask)
        # Fill background with white (since text is black)
        crop_isolated[mask == 0] = [255, 255, 255]
        
        # Preprocess for OCR
        crop_gray = cv2.cvtColor(crop_isolated, cv2.COLOR_BGR2GRAY)
        # Threshold to keep only black text
        _, thresh = cv2.threshold(crop_gray, 100, 255, cv2.THRESH_BINARY)
        
        # OCR
        config = '--psm 7 -c tessedit_char_whitelist=0123456789'
        ocr_text = pytesseract.image_to_string(thresh, config=config).strip()
        
        # Sanitize result
        plot_num = ocr_text if ocr_text.isdigit() else "???"
        
        p["id_num"] = plot_num
        processed_plots.append(p)

    # Sort plots for deterministic JSON output (optional)
    processed_plots.sort(key=lambda p: (p["center"][1] // 50, p["center"][0]))

    for p in processed_plots:
        num = p["id_num"]
        p["label"] = f"Plot {num}"
        p["type"] = "plot"
        full_map_data.append(p)
        
        pts = np.array(p["points"])
        x, y, w, h = cv2.boundingRect(pts)
        
        # Draw contour
        cv2.drawContours(annotated_img, [pts], -1, (0, 255, 0), 2)
        cv2.drawContours(blueprint_img, [pts], -1, (0, 255, 0), 2)
        
        # Place text at top right
        text_pos = (x + w - 15, y + 25)
        cv2.putText(annotated_img, num, text_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        cv2.putText(blueprint_img, num, text_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # 3. Roads & Highway (Specific Annotations)
    # Highway (Red)
    m_red1 = cv2.inRange(hsv, np.array([0, 100, 100]), np.array([10, 255, 255]))
    m_red2 = cv2.inRange(hsv, np.array([160, 100, 100]), np.array([180, 255, 255]))
    m_red = cv2.bitwise_or(m_red1, m_red2)
    m_red = cv2.morphologyEx(m_red, cv2.MORPH_CLOSE, np.ones((15,15), np.uint8))
    m_red = cv2.medianBlur(m_red, 7)
    cv2.imwrite("clean_plot_maps/debug_mask_red.png", m_red)
    
    def extract_spines(mask, parent_cnt=None, threshold_factor=0.85):
        # Use distance transform to find the center line
        dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
        _, max_val, _, _ = cv2.minMaxLoc(dist)
        if max_val < 2: return [] # Too thin to have a spine
        
        # Threshold to get a "ridge" region
        ridge = (dist > (max_val * threshold_factor)).astype(np.uint8)
        
        # skeletonize ridge to 1-pixel line
        skel = skeletonize(ridge).astype(np.uint8) * 255
        
        contours, _ = cv2.findContours(skel, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not contours: return []
        
        # find the longest skeleton path (for highway, should be one)
        cnt = max(contours, key=lambda c: cv2.arcLength(c, False))
        
        # Use median to avoid edge noise
        median_w = np.median(dist[skel > 0]) * 2.0
        
        pts = [p[0].tolist() for p in cnt]
        
        if len(pts) >= 2:
            # Filter points to only those inside parent_cnt if provided
            if parent_cnt is not None:
                pts = [p for p in pts if cv2.pointPolygonTest(parent_cnt, (float(p[0]), float(p[1])), False) >= 0]
            
            if len(pts) >= 2:
                return [{
                    "points": pts,
                    "width": float(median_w)
                }]
        return []

    cnts_h, _ = cv2.findContours(m_red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    highway_found = False
    for cnt in cnts_h:
        if cv2.contourArea(cnt) < 4000: continue
        M = cv2.moments(cnt)
        cX, cY = (int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])) if M["m00"] != 0 else (0,0)
        
        # Extract spines specifically for this highway segment
        h_spines = extract_spines(m_red, parent_cnt=cnt, threshold_factor=0.7)
        
        # Use raw coordinates for highway to prevent tapering/thorns
        full_map_data.append({
            "type": "highway", 
            "label": "6 Lane Highway", 
            "points": cnt.reshape(-1, 2).tolist(), 
            "center": [cX, cY],
            "spines": h_spines
        })
        # Annotation: Bold Red
        cv2.drawContours(annotated_img, [cnt], -1, (0, 0, 255), 8)
        cv2.drawContours(blueprint_img, [cnt], -1, (0, 0, 255), 8)
        cv2.putText(annotated_img, "6 LANE HIGHWAY", (cX-200, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (0, 0, 255), 5)
        cv2.putText(blueprint_img, "6 LANE HIGHWAY", (cX-200, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (0, 0, 255), 5)
        highway_found = True

    # Arterial Roads (Cyan)
    m_blue_clean = cv2.morphologyEx(mask_blue, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8))
    m_blue_clean = cv2.erode(m_blue_clean, np.ones((3,3), np.uint8), iterations=1) # Kill thin noise
    m_blue_clean = cv2.medianBlur(m_blue_clean, 5)
    cv2.imwrite("clean_plot_maps/debug_mask_blue.png", m_blue_clean)

    cnts_r, _ = cv2.findContours(m_blue_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    road_count = 0
    for cnt in cnts_r:
        if cv2.contourArea(cnt) < 1000: continue
        M = cv2.moments(cnt)
        if M["m00"] == 0: continue
        cX, cY = int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])
        
        road_count += 1
        # Extract spines specifically for this road segment (much cleaner now)
        r_spines = extract_spines(m_blue_clean, parent_cnt=cnt, threshold_factor=0.8)
        
        # Smooth roads using fixed pixel epsilon to remove staircases without pinching ends
        approx = smooth_contour(cnt, fixed_epsilon=1.2)
        full_map_data.append({
            "type": "road", 
            "label": f"Arterial Road {road_count}", 
            "points": approx.reshape(-1, 2).tolist(), 
            "center": [cX, cY],
            "spines": r_spines # Attach the road spines specifically to this segment
        })
        # Annotation: Bright Cyan
        cv2.drawContours(annotated_img, [cnt], -1, (255, 255, 0), 4) 
        cv2.drawContours(blueprint_img, [cnt], -1, (255, 255, 0), 4) 
        if cv2.contourArea(cnt) > 3000:
            cv2.putText(annotated_img, "ARTERIAL ROAD", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 100, 0), 2)
            cv2.putText(blueprint_img, "ARTERIAL ROAD", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 100, 0), 2)

    # 4. Green & Resort (Refined Boundaries)
    # Green Area (Forest Green)
    mask_green = cv2.inRange(hsv, np.array([35, 50, 40]), np.array([90, 255, 255]))
    mask_green = cv2.morphologyEx(mask_green, cv2.MORPH_CLOSE, np.ones((10,10), np.uint8))
    cs_g, _ = cv2.findContours(mask_green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for i, cnt in enumerate(cs_g):
        if cv2.contourArea(cnt) < 2000: continue
        M = cv2.moments(cnt)
        cX, cY = (int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])) if M["m00"] != 0 else (0,0)
        
        # Generic annotation for green areas
        cat = "green"
        color = (0, 150, 0) # Forest Green
        label = "Green Area"
        # Smooth Green
        approx = smooth_contour(cnt, 0.005)
        full_map_data.append({"type": cat, "label": label, "points": approx.reshape(-1, 2).tolist(), "center": [cX, cY]})
        cv2.drawContours(annotated_img, [cnt], -1, color, 4)
        cv2.drawContours(blueprint_img, [cnt], -1, color, 4)
        cv2.putText(annotated_img, label, (cX-40, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
        cv2.putText(blueprint_img, label, (cX-40, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

    # Resort (Vibrant Pink)
    # Lowered saturation floor to 10 to catch desaturated/grayish pink
    mask_pink = cv2.inRange(hsv, np.array([130, 10, 50]), np.array([175, 255, 255]))
    # Use dividers to sharpen the pink boundaries
    resort_mask = cv2.bitwise_and(mask_pink, cv2.bitwise_not(dividers))
    # Closing to fill internal gaps while keeping cut outer edges
    resort_mask = cv2.morphologyEx(resort_mask, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    resort_mask = cv2.medianBlur(resort_mask, 5)
    
    cs_p, _ = cv2.findContours(resort_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    resort_count = 0
    for i, cnt in enumerate(cs_p):
        area = cv2.contourArea(cnt)
        if area < 3000: continue # Focus on actual resort buildings
        M = cv2.moments(cnt)
        cX, cY = (int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])) if M["m00"] != 0 else (0,0)
        
        resort_count += 1
        # Smooth Resort
        approx = smooth_contour(cnt, 0.006)
        full_map_data.append({"type": "resort", "label": f"Resort {resort_count}", "points": approx.reshape(-1, 2).tolist(), "center": [cX, cY]})
        # Annotation: Vibrant Pink
        cv2.drawContours(annotated_img, [cnt], -1, (255, 0, 255), 5)
        cv2.drawContours(blueprint_img, [cnt], -1, (255, 0, 255), 5)
        cv2.putText(annotated_img, f"RESORT", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 0, 255), 4)
        cv2.putText(blueprint_img, f"RESORT", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 0, 255), 4)

    cv2.imwrite(output_image_path, annotated_img)
    cv2.imwrite(output_blueprint_path, blueprint_img)
    with open(output_json_path, "w") as f:
        json.dump(full_map_data, f, indent=2)
    print(f"Extraction Successful. Found {len(processed_plots)} plots, {road_count} road segments, {resort_count} resorts, and highway={highway_found}.")

if __name__ == "__main__":
    process_map()
