import json
import math
import os

# Constants matched from InteractiveMap3D.jsx
VIEW_WIDTH = 1696
VIEW_HEIGHT = 2514
SCALE = 0.08
INTERSECTION_PLOTS = {'5', '54', '9', '22', '23', '36', '37', '43', '46', '49'}

def get_3d_pts(points):
    return [
        {
            'x': (p[0] - VIEW_WIDTH / 2) * SCALE,
            'y': -(p[1] - VIEW_HEIGHT / 2) * SCALE
        }
        for p in points
    ]

def get_center(points):
    pts = get_3d_pts(points)
    min_x = min(p['x'] for p in pts)
    max_x = max(p['x'] for p in pts)
    min_y = min(p['y'] for p in pts)
    max_y = max(p['y'] for p in pts)
    return (min_x + max_x) / 2, (min_y + max_y) / 2

def compute_facing_data(data):
    roads = [d for d in data if d['type'] == 'road']
    plots = [d for d in data if d['type'] == 'plot']
    result = {}

    for plot in plots:
        label = plot.get('label', 'Unknown')
        cx, cy = get_center(plot['points'])
        
        plot_id = str(label).replace('Plot ', '')
        is_intersection = plot_id in INTERSECTION_PLOTS

        pts_3d = get_3d_pts(plot['points'])
        n = len(pts_3d)
        is_closed = (
            abs(pts_3d[0]['x'] - pts_3d[n - 1]['x']) < 0.001 and
            abs(pts_3d[0]['y'] - pts_3d[n - 1]['y']) < 0.001
        )
        edge_count = n - 1 if is_closed else n

        contacts = []

        for road in roads:
            road_pts = get_3d_pts(road['points'])
            for i in range(len(road_pts) - 1):
                ax, ay = road_pts[i]['x'], road_pts[i]['y']
                bx, by = road_pts[i+1]['x'], road_pts[i+1]['y']

                dx, dy = bx - ax, by - ay
                len_sq = dx * dx + dy * dy
                
                if len_sq > 0:
                    t = max(0, min(1, ((cx - ax) * dx + (cy - ay) * dy) / len_sq))
                else:
                    t = 0

                closest_x = ax + t * dx
                closest_y = ay + t * dy
                dist = math.hypot(cx - closest_x, cy - closest_y)
                angle = math.atan2(closest_y - cy, closest_x - cx)

                best_edge_dist = float('inf')
                best_edge_idx = 0
                for j in range(edge_count):
                    pA = pts_3d[j]
                    pB = pts_3d[(j + 1) % edge_count]
                    mx = (pA['x'] + pB['x']) / 2
                    my = (pA['y'] + pB['y']) / 2
                    d = math.hypot(mx - closest_x, my - closest_y)
                    if d < best_edge_dist:
                        best_edge_dist = d
                        best_edge_idx = j
                
                contacts.append({
                    'dist': dist,
                    'angle': angle,
                    'edgeIdx': best_edge_idx
                })

        if not contacts:
            result[label] = {'angle': 0, 'gateEdgeIdx': 0, 'secondGateEdgeIdx': -1}
            continue

        contacts.sort(key=lambda x: x['dist'])
        primary = contacts[0]
        secondary_edge_idx = -1

        if is_intersection:
            min_angle_diff = math.pi / 3
            for c in contacts:
                if c['edgeIdx'] == primary['edgeIdx']:
                    continue
                # Angle difference calculation
                diff = abs(((c['angle'] - primary['angle'] + math.pi * 3) % (math.pi * 2)) - math.pi)
                if diff > min_angle_diff:
                    secondary_edge_idx = c['edgeIdx']
                    break

        result[label] = {
            'angle': primary['angle'],
            'gateEdgeIdx': primary['edgeIdx'],
            'secondGateEdgeIdx': secondary_edge_idx
        }

    return result

if __name__ == '__main__':
    input_path = 'webapp/src/assets/full_map_vectors.json'
    output_path = 'webapp/src/assets/plot_facing_data.json'
    
    print(f'Loading data from {input_path}...')
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    print('Computing plot facing data...')
    facing_data = compute_facing_data(data)
    
    print(f'Saving results to {output_path}...')
    with open(output_path, 'w') as f:
        json.dump(facing_data, f, indent=2)
    
    print('Done!')
