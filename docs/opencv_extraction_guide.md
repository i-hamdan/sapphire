# Masterclass: OpenCV & OCR Plot Extraction Pipeline

This guide details the state-of-the-art process for converting complex, raster real-estate maps into high-precision, interactive 3D datasets. This pipeline represents the bridge between static design and dynamic WebGL experiences.

---

## The Philosophy: Why Raster-to-Vector?
A JPEG or PNG map is just a grid of colored pixels. To make a website "know" that a specific yellow area is "Plot 24," we must perform **Vectorization**. This involves identifying boundaries, classifying types, and reading text—all with clinical precision.

---

## Phase I: The Digital Foundation (HSV & Precision Masking)

### 1.1 Why BGR is Not Enough
Standard images use BGR (Blue-Green-Red). However, BGR is highly sensitive to lighting. A "yellow" plot in the sun has different BGR values than a "yellow" plot in the shadow. We use **HSV (Hue, Saturation, Value)** because it separates "Color" from "Brightness."

```python
# The Transformation
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
```

### 1.2 Defining the Color DNA
We define "High" and "Low" boundaries for every element on the map.
- **Plots (Yellow)**: `[10, 30, 30]` to `[45, 255, 255]`
- **Highway (Red)**: Dual-range masking (0-10 and 160-180) to catch the full red spectrum.
- **Arterial Roads (Blue)**: `[90, 50, 40]` to `[135, 255, 255]`
- **Resorts (Desaturated Pink)**: A critical discovery. These colors often have low saturation (`S=10`), requiring a broad mask to detect.

---

## Phase II: The "Surgical Cut" (Dividers & Canny Edges)

### 2.1 The Bridging Problem
In many maps, plots of the same color touch each other. If we simply mask for "Yellow," OpenCV sees one giant blob instead of 57 plots.

### 2.2 The Canny Edge "Knife"
We use the **Canny Edge Detector** to find the thin black lines between plots. These lines become a "Knife Mask."

```python
# Create the Knife
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray, 50, 150)

# Dilate the knife to ensure it fully 'cuts' through color bridges
knife = cv2.dilate(edges, np.ones((2,2), np.uint8), iterations=1)

# Perform the surgery
final_plot_mask = cv2.bitwise_and(yellow_mask, cv2.bitwise_not(knife))
```

---

## Phase III: Internal Text Preservation (RETR_CCOMP)

### 3.1 The "Holy" Conflict
Plot numbers (text) are printed *inside* the plot area. These black numbers effectively create "holes" in our yellow mask. If we leave them, our vector shapes will have complex, ugly inner cutouts.

### 3.2 Hierarchy-Based Hole Filling
We use the `RETR_CCOMP` retrieval mode to find contours in a hierarchical layout.
- **External Contours**: The plot boundary.
- **Internal Contours**: The plot numbers.

We programmatically fill every internal contour with white, creating a solid, solid vector shape:

```python
contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
if hierarchy is not None:
    for i in range(len(contours)):
        if hierarchy[0][i][3] != -1: # Identifying a 'child' (hole)
            cv2.drawContours(mask, [contours[i]], -1, 255, -1)
```

---

## Phase IV: OCR Synchronization (Reading the Map)

### 4.1 Automated Labeling
Standard sorting (top-to-bottom) is never 100% accurate for human-labeled maps. To sync our JSON data with the real map, we employ **Tesseract OCR**.

### 4.2 The OCR Preprocessing Workflow
For every identified plot boundary:
1. **Crop**: Extract the specific plot region.
2. **Isolate**: Apply the plot's own mask so the OCR *only* sees what is inside that specific plot.
3. **Threshold**: Convert to high-contrast Black-on-White.
4. **Recognize**: Use PyTesseract with a numerical whitelist (`0123456789`).

```python
config = '--psm 7 -c tessedit_char_whitelist=0123456789'
ocr_text = pytesseract.image_to_string(thresh, config=config).strip()
```

---

## Phase V: Category-Specific Strategies

### 5.1 Arterial Roads (Network Connectivity)
Roads are often fragmented by white dashed lines. We use **Morphological Closing** with large kernels (`7x7` or `10x10`) to "bridge" these gaps and form a single, continuous road network vector.

### 5.2 The 6-Lane Highway
The highway is the "hero" element. We use a deep red mask and a massive thickness (`8px`) for its annotation to signify its importance.

### 5.3 Greenery & Resorts
- **Greenery**: Focuses on the `Hue=35-90` range.
- **Resorts**: Requires the lowest saturation floor (`S=10`) due to the muted, luxury colors often used in architectural plans.

---

## Phase VI: Advanced Smoothing & Anti-Aliasing (Fixing "Jagged" Edges)

High-resolution raster extraction often results in "pixel staircase" jaggedness. To ensure 3D shapes look premium and smooth, we employ a dual-layered smoothing pipeline.

### 6.1 Morphological Anti-Aliasing
Before the contour is even extracted, we apply **Median Blurring** to the binary mask. This removes isolated pixel noise and "rounds off" the hard square transitions of the raster grid without losing the shape's structural integrity.

```python
# Eliminating pixel "stairs"
plot_mask = cv2.medianBlur(plot_mask, 5)
```

### 6.2 Category-Specific Simplification (Epsilon Strategy)
Different map elements require different levels of "straightness." Using a flat epsilon for everything leads to jittery roads or over-simplified curves. We use a **Category-Aware Epsilon**:

| Category | Epsilon Factor | Goal |
| :--- | :--- | :--- |
| **Arterial Roads** | `1.2px` (Fixed) | **The Holy Grail**: Eliminates staircases without "pinching" thin road ends. |
| **Plots** | `0.003` (Precise) | Smooths jitter while preserving custom property curves. |
| **Amenities** | `0.005` (Balanced) | Clean, organic look for gardens and pools. |

---

## Phase VII: Vectorization & Optimization (The Lean Engine)

### 7.1 Fixed vs. Dynamic Epsilon
A common pitfall in vectorization is using `arcLength` for every object. For thin, long segments like roads, a dynamic epsilon can become larger than the road's width, causing it to collapse into a "thorn." We use a **Fixed Epsilon (1.2px)** for roads to ensure 100% width preservation.

```python
def smooth_contour(cnt, epsilon_factor=None, fixed_epsilon=None):
    if fixed_epsilon:
        epsilon = fixed_epsilon
    else:
        epsilon = epsilon_factor * cv2.arcLength(cnt, True)
    return cv2.approxPolyDP(cnt, epsilon, True)
```

### 7.2 Centroid Calculation
We use **Image Moments** to find the exact "Center of Mass" for every plot. This coordinate is exported to JSON, allowing the 3D application to place labels and "Farmhouse Miniatures" perfectly in the center of the plot.

---

## Troubleshooting Guide

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **Merged Plots** | No divider between them | Increase `Canny` sensitivity or dilate the `edges` mask. |
| **Missing Resorts** | Saturation is too low | Lower the HSV `S` value (Start at 10). |
| **Noisy Edges** | JPEG Compression artifacts | Use `MORPH_OPEN` with a tiny `2x2` kernel. |
| **OCR Hallucinations** | Neighboring plot numbers | Crop using a **tighter binary mask** of the plot. |

---

## Final Output Structure
The result is a structured JSON file compatible with Three.js and Deck.gl, featuring 100% accurate synchronization between the visual map and the digital data layer.

> [!TIP]
> Always verify the output using the `annotated_plots.png` generated by the script. If the green outlines match the original black borders, your data is 3D-ready!
