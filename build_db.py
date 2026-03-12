import json

areas = {
    1: 38009, 30: 7611,
    2: 54497, 31: 11429,
    3: 21882, 32: 14822,
    4: 12066, 33: 10000,
    5: 13832, 34: 10000,
    6: 6447, 35: 10000,
    7: 12068, 36: 11250,
    8: 14430, 37: 11250,
    9: 15404, 38: 10000,
    10: 13538, 39: 10000,
    11: 12374, 40: 10891,
    12: 10896, 41: 9541,
    13: 11969, 42: 10000,
    14: 12225, 43: 11250,
    15: 10795, 44: 20736,
    16: 10000, 45: 8750,
    17: 10000, 46: 10000,
    18: 10000, 47: 8750,
    19: 10000, 48: 9730,
    20: 10000, 49: 10000,
    21: 10000, 50: 16746,
    22: 11250, 51: 14452,
    23: 11250, 52: 10000,
    24: 10000, 53: 10000,
    25: 10000, 54: 10841,
    26: 10000, 55: 14728,
    27: 10000, 56: 5750,
    28: 10000, 57: 20127,
    29: 10000
}

with open("final_mapping.json") as f:
    mapping = {k: int(v) for k, v in json.load(f).items()}

with open("plots_data2.json") as f:
    raw_plots = json.load(f)

# Re-map by Plot Number
final_database = []

# Support fast reverse lookup
for pid_str, plot_num in mapping.items():
    points = raw_plots[pid_str]["points"]
    area = areas.get(plot_num, 0)
    final_database.append({
        "id": plot_num,
        "area": area,
        "points": points
    })

# Sort by ID
final_database.sort(key=lambda x: x["id"])

with open("plots.json", "w") as f:
    json.dump(final_database, f)

print("Created plots.json with", len(final_database), "plots. Done data extraction!")
