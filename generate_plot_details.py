import json
import numpy as np
import os

def generate_plot_details():
    input_path = "webapp/src/assets/full_map_vectors.json"
    output_path = "webapp/src/assets/plot_details.json"

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    with open(input_path, "r") as f:
        data = json.load(f)

    plot_details = {}

    for item in data:
        if item.get("type") == "plot":
            plot_num = item.get("id_num")
            if not plot_num or plot_num == "???":
                # Fallback to label if id_num is missing
                label = item.get("label", "")
                plot_num = label.replace("Plot ", "")

            points = np.array(item["points"])
            area_sqft = item.get("area", 0)

            # Calculate bounding box in pixels
            min_coords = np.min(points, axis=0)
            max_coords = np.max(points, axis=0)
            w_p = max_coords[0] - min_coords[0]
            h_p = max_coords[1] - min_coords[1]

            # Aspect ratio
            if h_p > 0:
                aspect_ratio = w_p / h_p
            else:
                aspect_ratio = 1.0

            # Estimate L and B in feet
            # L * B = Area
            # L / B = aspect_ratio => L = B * aspect_ratio
            # B * aspect_ratio * B = Area => B^2 = Area / aspect_ratio
            if aspect_ratio > 0 and area_sqft > 0:
                breadth_ft = np.sqrt(area_sqft / aspect_ratio)
                length_ft = breadth_ft * aspect_ratio
            else:
                length_ft = 0
                breadth_ft = 0

            plot_details[plot_num] = {
                "area_sqft": round(area_sqft, 1),
                "length_ft": round(length_ft, 1),
                "breadth_ft": round(breadth_ft, 1),
                "isSold": False,
                "isHighInterest": False,
                "notes": ""
            }

    with open(output_path, "w") as f:
        json.dump(plot_details, f, indent=2)

    print(f"Generated details for {len(plot_details)} plots at {output_path}")

if __name__ == "__main__":
    generate_plot_details()
