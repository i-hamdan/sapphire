import cv2
import numpy as np
import json
import os

def extract_perimeter():
    # Paths
    base_dir = "/Users/hamdan/Documents/BXB - Work/FarmHouse/farms2"
    image_path = os.path.join(base_dir, "clean_plot_maps/cleaner_plots_only_plots.png")
    output_image_path = os.path.join(base_dir, "clean_plot_maps/annotated_campus_perimeter.png")
    output_json_path = os.path.join(base_dir, "clean_plot_maps/campus_perimeter.json")

    print(f"Reading image: {image_path}")
    img = cv2.imread(image_path)
    if img is None:
        print("Error: Could not read image.")
        return

    # Convert to HSV
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Phase I: Precise Masking (Combined Strategy)
    # Extract both the dark border AND the yellow/brownish land
    mask_black = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 255, 100]))
    mask_yellow = cv2.inRange(hsv, np.array([15, 50, 50]), np.array([40, 255, 255]))
    
    # Combine them to bridge gaps and create a solid block for the whole campus
    combined_land_mask = cv2.bitwise_or(mask_black, mask_yellow)
    
    # Phase II: Solid Body Generation
    # Find all contours in the combined mask
    contours_land, _ = cv2.findContours(combined_land_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours_land:
        print("No plot/border contours found.")
        return

    # Create a solid mask by filling all detected land/border regions
    # thickness=-1 fills the interior of the contours
    refined_mask = np.zeros_like(mask_black)
    cv2.drawContours(refined_mask, contours_land, -1, 255, -1)
    
    # Phase VI: Smoothing & Anti-Aliasing
    # Minimal median blur (3) to handle only the tiniest noise spikes
    refined_mask = cv2.medianBlur(refined_mask, 3)

    
    # Find final External Contour of the solid body
    final_contours, _ = cv2.findContours(refined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not final_contours:
        print("No final contours found.")
        return
    
    main_contour = max(final_contours, key=cv2.contourArea)
    
    # Phase VI.2: High-Fidelity Epsilon
    # 1.5px is high enough to skip pixel "stairs" but low enough to keep multi-segment edges.
    epsilon = 1.5 
    
    approx = cv2.approxPolyDP(main_contour, epsilon, True)




    
    # Phase VII: Centroid Calculation
    M = cv2.moments(main_contour)
    cX, cY = (0, 0)
    if M["m00"] != 0:
        cX = int(M["m10"] / M["m00"])
        cY = int(M["m01"] / M["m00"])
    
    # Structure for JSON
    points = approx.reshape(-1, 2).tolist()
    data = {
        "type": "campus_perimeter",
        "label": "Total Plot Area",
        "points": points,
        "center": [cX, cY],
        "area": cv2.contourArea(main_contour)
    }
    
    # Create Annotated Image
    annotated_img = img.copy()
    cv2.drawContours(annotated_img, [approx], -1, (0, 255, 0), 3) # Clean Green boundary
    
    # Draw centroid
    cv2.circle(annotated_img, (cX, cY), 7, (255, 0, 0), -1)
    
    # Save outputs
    cv2.imwrite(output_image_path, annotated_img)
    with open(output_json_path, 'w') as f:
        json.dump([data], f, indent=2)

        
    print(f"Extraction Successful!")
    print(f"Annotated Image: {output_image_path}")
    print(f"JSON Data: {output_json_path}")
    print(f"Vertices found: {len(points)}")

if __name__ == "__main__":
    extract_perimeter()
