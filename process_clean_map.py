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
    
from skimage.morphology import skeletonize, label
from scipy.spatial import KDTree
from scipy.interpolate import splprep, splev

def order_skeleton_points(pts):
    """Walk the skeleton greedily from one end to the other."""
    if not pts: return []
    pts = np.array(pts)
    
    # 1. Find true endpoints (points with only 1 neighbor in a 3x3 or nearby)
    tree = KDTree(pts)
    visited = np.zeros(len(pts), dtype=bool)
    
    # Find endpoints: points with few neighbors within a small radius
    neighbor_counts = [len(tree.query_ball_point(p, 1.5)) - 1 for p in pts]
    potential_starts = np.where(np.array(neighbor_counts) == 1)[0]
    
    if len(potential_starts) > 0:
        # Pick the one closest to the Y-extremes
        y_min_idx = np.argmin(pts[:, 1])
        start = potential_starts[np.argmin(np.linalg.norm(pts[potential_starts] - pts[y_min_idx], axis=1))]
    else:
        start = np.argmin(pts[:, 1])

    path = [start]
    visited[start] = True

    for _ in range(len(pts) - 1):
        current = pts[path[-1]]
        # Find nearest unvisited neighbour (search k=10 to jump small gaps)
        dists, idxs = tree.query(current, k=min(10, len(pts)))
        found = False
        for idx in idxs[1:]:  # skip self
            if not visited[idx]:
                path.append(idx)
                visited[idx] = True
                found = True
                break
        if not found: break # dead end

    return pts[path].tolist()

def smooth_points(pts, window=12):
    """Aggressive moving average smoothing."""
    if len(pts) <= window * 2: return pts
    pts_arr = np.array(pts, dtype=float)
    smoothed = pts_arr.copy()
    for i in range(window, len(pts_arr) - window):
        smoothed[i] = pts_arr[i - window:i + window].mean(axis=0)
    return smoothed.tolist()

def extract_spines(mask, parent_cnt=None, threshold_factor=0.4):
    # Slightly dilate mask to bridge tiny fragmentation gaps
    mask_dilated = cv2.dilate(mask, np.ones((3,3), np.uint8), iterations=1)
    
    dist = cv2.distanceTransform(mask_dilated, cv2.DIST_L2, 5)
    _, max_val, _, _ = cv2.minMaxLoc(dist)

    # Get the thick ridge mask
    spine_mask = (dist > (max_val * threshold_factor)).astype(np.uint8)

    # ✅ TRUE skeleton
    skeleton = skeletonize(spine_mask).astype(np.uint8)

    # Label all connected regions, keep only the largest one (Removes Dots/Noise)
    labeled = label(skeleton)
    region_sizes = np.bincount(labeled.ravel())
    if len(region_sizes) <= 1: return []
    region_sizes[0] = 0  # ignore background
    largest_label = region_sizes.argmax()
    
    # Also ignore tiny components (less than 10 pixels of skeleton)
    if region_sizes[largest_label] < 10: return []
    
    skeleton = (labeled == largest_label).astype(np.uint8)

    # Extract raw points from the skeleton
    ys, xs = np.where(skeleton > 0)
    pts = list(zip(xs.tolist(), ys.tolist()))
    if len(pts) < 10: return []

    # Order the points
    pts = order_skeleton_points(pts)
    if len(pts) < 5: return []

    # --- NEW: Spline Interpolation for Ultimate Smoothness ---
    try:
        data = np.array(pts).T
        tck, u = splprep(data, s=len(pts)*0.2, k=min(3, len(pts)-1))
        u_fine = np.linspace(-0.05, 1.05, 100) # Extrapolate 5% at each end
        new_pts = np.array(splev(u_fine, tck)).T
        pts = new_pts.tolist()
    except Exception as e:
        print(f"Spline fitting failed: {e}")
        pts = smooth_points(pts, window=8)

    # Get average width from distance values under the skeleton
    avg_w = np.mean(dist[skeleton > 0]) * 2.0

    if parent_cnt is not None:
        pts = [p for p in pts if cv2.pointPolygonTest(parent_cnt, (float(p[0]), float(p[1])), False) >= -2.0]

    if len(pts) >= 2:
        return [{
            "points": pts,
            "width": float(avg_w)
        }]
    return []

def smooth_contour(cnt, epsilon_factor=0.004, fixed_epsilon=None):
    if fixed_epsilon is not None:
        epsilon = fixed_epsilon
    else:
        epsilon = epsilon_factor * cv2.arcLength(cnt, True)
    return cv2.approxPolyDP(cnt, epsilon, True)

def process_map():
    image_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/cleaner_plots.png"
    output_image_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/annotated_plots.png"
    output_blueprint_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/annotated_blueprint.png"
    output_json_path = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2/clean_plot_maps/plots_data_new.json"

    img = cv2.imread(image_path)
    if img is None: 
        print(f"Error: Could not read image at {image_path}")
        return
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    mask_yellow = cv2.inRange(hsv, np.array([10, 30, 30]), np.array([45, 255, 255]))
    mask_blue = cv2.inRange(hsv, np.array([90, 50, 40]), np.array([135, 255, 255]))
    edges = cv2.Canny(gray, 50, 150)
    
    dividers = cv2.bitwise_or(mask_blue, edges)
    dividers = cv2.dilate(dividers, np.ones((2,2), np.uint8), iterations=1)
    
    plot_mask = cv2.bitwise_and(mask_yellow, cv2.bitwise_not(dividers))
    plot_mask = cv2.erode(plot_mask, np.ones((2,2), np.uint8), iterations=1)
    
    contours, hierarchy = cv2.findContours(plot_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is not None:
        for i in range(len(contours)):
            if hierarchy[0][i][3] != -1:
                cv2.drawContours(plot_mask, [contours[i]], -1, 255, -1)
    
    plot_mask = cv2.medianBlur(plot_mask, 5)
    cnts, _ = cv2.findContours(plot_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    plots_raw = []
    
    for cnt in cnts:
        area = cv2.contourArea(cnt)
        if area < 300: continue
        approx = smooth_contour(cnt, 0.003)
        M = cv2.moments(cnt)
        if M["m00"] == 0: continue
        cX, cY = int(M["m10"] / M["m00"]), int(M["m01"] / M["m00"])
        plots_raw.append({"points": approx.reshape(-1, 2).tolist(), "center": [cX, cY], "area": area})

    annotated_img = img.copy()
    blueprint_img = cv2.addWeighted(img, 0.1, np.full(img.shape, 255, dtype=np.uint8), 0.9, 0)
    full_map_data = []
    
    processed_plots = []
    for p in plots_raw:
        pts = np.array(p["points"])
        x, y, w, h = cv2.boundingRect(pts)
        crop = img[y:y+h, x:x+w].copy()
        local_pts = pts - [x, y]
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [local_pts], 255)
        crop_isolated = cv2.bitwise_and(crop, crop, mask=mask)
        crop_isolated[mask == 0] = [255, 255, 255]
        crop_gray = cv2.cvtColor(crop_isolated, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(crop_gray, 100, 255, cv2.THRESH_BINARY)
        config = '--psm 7 -c tessedit_char_whitelist=0123456789'
        ocr_text = pytesseract.image_to_string(thresh, config=config).strip()
        plot_num = ocr_text if ocr_text.isdigit() else "???"
        p["id_num"] = plot_num
        processed_plots.append(p)

    processed_plots.sort(key=lambda p: (p["center"][1] // 50, p["center"][0]))

    for p in processed_plots:
        num = p["id_num"]
        p["label"] = f"Plot {num}"
        p["type"] = "plot"
        full_map_data.append(p)
        pts = np.array(p["points"])
        x, y, w, h = cv2.boundingRect(pts)
        cv2.drawContours(annotated_img, [pts], -1, (0, 255, 0), 2)
        cv2.drawContours(blueprint_img, [pts], -1, (0, 255, 0), 2)
        text_pos = (x + w - 15, y + 25)
        cv2.putText(annotated_img, num, text_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        cv2.putText(blueprint_img, num, text_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Highway (Red)
    m_red1 = cv2.inRange(hsv, np.array([0, 100, 100]), np.array([10, 255, 255]))
    m_red2 = cv2.inRange(hsv, np.array([160, 100, 100]), np.array([180, 255, 255]))
    m_red = cv2.bitwise_or(m_red1, m_red2)
    m_red = cv2.morphologyEx(m_red, cv2.MORPH_CLOSE, np.ones((15,15), np.uint8))
    m_red = cv2.medianBlur(m_red, 7)
    
    cnts_h, _ = cv2.findContours(m_red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    highway_found = False
    for cnt in cnts_h:
        if cv2.contourArea(cnt) < 4000: continue
        M = cv2.moments(cnt)
        cX, cY = (int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])) if M["m00"] != 0 else (0,0)
        h_spines = extract_spines(m_red, parent_cnt=cnt, threshold_factor=0.4)
        full_map_data.append({
            "type": "highway", 
            "label": "6 Lane Highway", 
            "points": cnt.reshape(-1, 2).tolist(), 
            "center": [cX, cY],
            "spines": h_spines
        })
        cv2.drawContours(annotated_img, [cnt], -1, (0, 0, 255), 8)
        cv2.drawContours(blueprint_img, [cnt], -1, (0, 0, 255), 8)
        cv2.putText(annotated_img, "6 LANE HIGHWAY", (cX-200, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (0, 0, 255), 5)
        cv2.putText(blueprint_img, "6 LANE HIGHWAY", (cX-200, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (0, 0, 255), 5)
        highway_found = True

    # Arterial Roads (Cyan)
    m_blue_clean = cv2.morphologyEx(mask_blue, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8))
    m_blue_clean = cv2.erode(m_blue_clean, np.ones((3,3), np.uint8), iterations=1)
    m_blue_clean = cv2.medianBlur(m_blue_clean, 5)

    cnts_r, _ = cv2.findContours(m_blue_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    road_count = 0
    for cnt in cnts_r:
        if cv2.contourArea(cnt) < 1000: continue
        M = cv2.moments(cnt)
        if M["m00"] == 0: continue
        cX, cY = int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])
        road_count += 1
        r_spines = extract_spines(m_blue_clean, parent_cnt=cnt, threshold_factor=0.4)
        approx = smooth_contour(cnt, fixed_epsilon=1.2)
        full_map_data.append({
            "type": "road", 
            "label": f"Arterial Road {road_count}", 
            "points": approx.reshape(-1, 2).tolist(), 
            "center": [cX, cY],
            "spines": r_spines
        })
        cv2.drawContours(annotated_img, [cnt], -1, (255, 255, 0), 4) 
        cv2.drawContours(blueprint_img, [cnt], -1, (255, 255, 0), 4) 
        if cv2.contourArea(cnt) > 3000:
            cv2.putText(annotated_img, "ARTERIAL ROAD", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 100, 0), 2)
            cv2.putText(blueprint_img, "ARTERIAL ROAD", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 100, 0), 2)

    # Green Area (Forest Green)
    mask_green = cv2.inRange(hsv, np.array([35, 50, 40]), np.array([90, 255, 255]))
    mask_green = cv2.morphologyEx(mask_green, cv2.MORPH_CLOSE, np.ones((10,10), np.uint8))
    cs_g, _ = cv2.findContours(mask_green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for i, cnt in enumerate(cs_g):
        if cv2.contourArea(cnt) < 2000: continue
        M = cv2.moments(cnt)
        cX, cY = (int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])) if M["m00"] != 0 else (0,0)
        approx = smooth_contour(cnt, 0.005)
        full_map_data.append({"type": "green", "label": "Green Area", "points": approx.reshape(-1, 2).tolist(), "center": [cX, cY]})
        cv2.drawContours(annotated_img, [cnt], -1, (0, 150, 0), 4)
        cv2.drawContours(blueprint_img, [cnt], -1, (0, 150, 0), 4)
        cv2.putText(annotated_img, "Green Area", (cX-40, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 150, 0), 2)
        cv2.putText(blueprint_img, "Green Area", (cX-40, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 150, 0), 2)

    # Resort (Vibrant Pink)
    mask_pink = cv2.inRange(hsv, np.array([130, 10, 50]), np.array([175, 255, 255]))
    resort_mask = cv2.bitwise_and(mask_pink, cv2.bitwise_not(dividers))
    resort_mask = cv2.morphologyEx(resort_mask, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    resort_mask = cv2.medianBlur(resort_mask, 5)
    
    cs_p, _ = cv2.findContours(resort_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    resort_count = 0
    for i, cnt in enumerate(cs_p):
        if cv2.contourArea(cnt) < 3000: continue
        M = cv2.moments(cnt)
        cX, cY = (int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])) if M["m00"] != 0 else (0,0)
        resort_count += 1
        approx = smooth_contour(cnt, 0.006)
        full_map_data.append({"type": "resort", "label": f"Resort {resort_count}", "points": approx.reshape(-1, 2).tolist(), "center": [cX, cY]})
        cv2.drawContours(annotated_img, [cnt], -1, (255, 0, 255), 5)
        cv2.drawContours(blueprint_img, [cnt], -1, (255, 0, 255), 5)
        cv2.putText(annotated_img, "RESORT", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 0, 255), 4)
        cv2.putText(blueprint_img, "RESORT", (cX-50, cY), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 0, 255), 4)

    cv2.imwrite(output_image_path, annotated_img)
    cv2.imwrite(output_blueprint_path, blueprint_img)
    with open(output_json_path, "w") as f:
        json.dump(full_map_data, f, indent=2)
    print(f"Extraction Successful. Found {len(processed_plots)} plots, {road_count} road segments, {resort_count} resorts, and highway={highway_found}.")

if __name__ == "__main__":
    process_map()
