// Road generation logic
import vectorsData from '../assets/full_map_vectors.json';

const SCALE = 0.05;
const viewWidth = 3180;
const viewHeight = 4181;

// Helper to convert original pixel coords to 3D world space
const to3D = (x, y) => {
  return [
    (x - viewWidth / 2) * SCALE,
    -(y - viewHeight / 2) * SCALE
  ];
};

export const generateRoadGeometries = () => {
    // 1. We know the 6 Lane Highway is at the top
    // Approximate its bounds based on plots 1 & 2
    // Plot 1 bounds: approx Y=579
    // Let's create a main horizontal rectangle for the highway
    
    // Instead of complex polygon math for roads between plots, 
    // a very clean aesthetic approach used in 3D visualizations 
    // is to draw a slightly raised "Plinth" (base) under ALL plots,
    // and color it like a road! Since plots are raised higher, 
    // the space between them appears as roads.
    
    // However, the user specifically wants roads ONLY within plot bounds.
    // Let's construct explicit rectangular strips for the main road arteries.
    
    const roads = [];
    
    // Highway (Top 6-lane)
    // Runs across the very top, above plot 1 and 2
    roads.push({
        id: 'highway',
        type: 'road',
        points: [
            to3D(500, 300),
            to3D(2800, 300),
            to3D(2800, 500),
            to3D(500, 500)
        ]
    });

    // Vertical Main Artery 1 (Between col 44-56 and 43-32)
    // Approximate X center is around 1140
    roads.push({
        id: 'v_road_1',
        type: 'road',
        points: [
            to3D(1215, 1300),
            to3D(1250, 1300),
            to3D(1250, 2400),
            to3D(1215, 2400)
        ]
    });

    // Vertical Main Artery 2 (Between col 43-32 and 37-30)
    roads.push({
        id: 'v_road_2',
        type: 'road',
        points: [
            to3D(1350, 1300),
            to3D(1390, 1300),
            to3D(1390, 2400),
            to3D(1350, 2400)
        ]
    });

    // Vertical Main Artery 3 (Between col 37-30 and 36-29)
    roads.push({
        id: 'v_road_3',
        type: 'road',
        points: [
            to3D(1480, 1300),
            to3D(1515, 1300),
            to3D(1515, 2400),
            to3D(1480, 2400)
        ]
    });

    // Vertical Main Artery 4 (Between col 23-27 and 22-18)
    roads.push({
        id: 'v_road_4',
        type: 'road',
        points: [
            to3D(1630, 1300),
            to3D(1660, 1300),
            to3D(1660, 2400),
            to3D(1630, 2400)
        ]
    });

    // Vertical Main Artery 5 (Between col 22-18 and 9-13)
    roads.push({
        id: 'v_road_5',
        type: 'road',
        points: [
            to3D(1760, 1300),
            to3D(1790, 1300),
            to3D(1790, 2400),
            to3D(1760, 2400)
        ]
    });

    // Horizontal Main Artery 1 (Below top row 57-6)
    roads.push({
        id: 'h_road_1',
        type: 'road',
        points: [
            to3D(900, 1595),
            to3D(2300, 1595),
            to3D(2300, 1630),
            to3D(900, 1630)
        ]
    });

    // Horizontal Main Artery 2 (Below row 44-7)
    roads.push({
        id: 'h_road_2',
        type: 'road',
        points: [
            to3D(1050, 1750),
            to3D(2250, 1750),
            to3D(2250, 1780),
            to3D(1050, 1780)
        ]
    });

    // Horizontal Main Artery 3
    roads.push({
        id: 'h_road_3',
        type: 'road',
        points: [
            to3D(1000, 1875),
            to3D(2000, 1875),
            to3D(2000, 1905),
            to3D(1000, 1905)
        ]
    });

    // Horizontal Main Artery 4
    roads.push({
        id: 'h_road_4',
        type: 'road',
        points: [
            to3D(1200, 2005),
            to3D(2000, 2005),
            to3D(2000, 2035),
            to3D(1200, 2035)
        ]
    });

    // Horizontal Main Artery 5
    roads.push({
        id: 'h_road_5',
        type: 'road',
        points: [
            to3D(1100, 2140),
            to3D(2000, 2140),
            to3D(2000, 2170),
            to3D(1100, 2170)
        ]
    });

    // Vertical Road connecting Highway to Plot grid (Right side)
    roads.push({
        id: 'v_road_highway',
        type: 'road',
        points: [
            to3D(2070, 500),
            to3D(2130, 500),
            to3D(2130, 1600),
            to3D(2070, 1600)
        ]
    });

    return roads;
};
