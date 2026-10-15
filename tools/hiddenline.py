"""Clean a traced sketch so it reads like a Vectorworks Hidden Line render.

A Hidden Line render only draws model geometry: long edges and closed
outlines. Tracing a photo also picks up things no model has: reflections in
a glossy floor, video on LED walls, haze beams, crowds, floorboards and
specks. This pass removes them:

- every chain of touching segments shorter than MIN_CHAIN is dropped (specks),
- per photo rules cut reflections below the floor line and clear screen
  content, beams and crowds, keeping long edges that cross those areas.

Coordinates in the sketch JSON are normalised to the image width, so y runs
0..aspect. Rules below use fractions of width (x) and height (y).

Run on one file:   python3 tools/hiddenline.py public/shows/<slug>/<id>.json
Run on everything: python3 tools/hiddenline.py --all
Removal only, so running it twice is harmless.
"""
import glob, json, math, os, sys

MIN_CHAIN = 0.012   # total length of a connected chain, fraction of width
JOIN = 0.0035       # endpoints this close count as touching

# Per photo rules. cut: drop everything whose midpoint is below this fraction
# of the height (reflections). rects: [x0, y0, x1, y1, max_len] drop segments
# whose midpoint is inside and that are shorter than max_len (1 = all).
RULES = {
    'sportsnet-studios/studio-31': {
        'cut': 0.70,
        'rects': [
            [0.56, 0.40, 0.97, 0.57, 0.05],   # LED wall city video
            [0.0, 0.0, 1.0, 0.36, 0.045],     # studio grid overhead: keep only long members
            [0.02, 0.36, 0.34, 0.50, 1],      # SPORTSNET graphic on the wall
        ],
    },
    'super-bowl-xliv/nfl-on-cbs': {
        'cut': 0.69,
        'rects': [
            [0.06, 0.06, 0.44, 0.37, 1],      # haze beams, upper left
            [0.60, 0.02, 0.82, 0.28, 1],      # haze beams, upper right
        ],
    },
    'mmvas/queen-street': {
        'rects': [
            [0.03, 0.63, 0.77, 1.0, 0.03],    # crowd
            [0.20, 0.25, 0.45, 0.55, 0.012],  # projection on the facade
        ],
    },
    'breakfast-television/platform': {
        'rects': [
            [0.0, 0.80, 1.0, 1.0, 0.05],      # floorboards
            [0.0, 0.70, 0.18, 0.80, 0.04],
            [0.82, 0.70, 1.0, 0.80, 0.04],
        ],
    },
    'the-agenda/set': {
        'rects': [
            [0.0, 0.84, 1.0, 1.0, 0.04],      # LED edge reflections on the floor
            [0.27, 0.55, 0.55, 0.78, 0.02],   # floor reflections
        ],
    },
    'et-canada/casa-loma': {
        'min_chain': 0.026,
        'rects': [
            [0.55, 0.10, 0.99, 0.50, 0.025],  # trees
            [0.0, 0.10, 0.25, 0.45, 0.025],
        ],
    },
    'sportsnet-360/connected': {
        'cut': 0.93,
        'rects': [
            [0.05, 0.30, 0.34, 0.56, 0.04],   # side screen video, left
            [0.66, 0.30, 0.95, 0.56, 0.04],   # and right
            [0.30, 0.80, 0.70, 0.93, 0.03],   # desk reflection in the floor
        ],
    },
    'tiff/panel': {
        'rects': [
            [0.0, 0.0, 1.0, 1.0, 0.014],      # fine detail everywhere
            [0.04, 0.26, 1.0, 1.0, 0.03],     # the panel guests: outlines only, no faces or folds
        ],
    },
    'events/gala-beams': {
        'min_chain': 0.026,
        'rects': [
            [0.0, 0.62, 1.0, 1.0, 0.025],     # tables and guests
            [0.32, 0.42, 0.80, 0.66, 0.03],   # haze beams
        ],
    },
}


def clean(path):
    d = json.load(open(path))
    key = '/'.join(path.replace('\\', '/').split('/')[-2:])[:-5]
    asp = d['aspect']
    rule = RULES.get(key, {})
    segs = d['segs']
    n0 = len(segs)

    def keep(s):
        x1, y1, x2, y2 = s[:4]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2 / asp
        ln = math.hypot(x2 - x1, y2 - y1)
        if 'cut' in rule and my > rule['cut']:
            return False
        for x0, y0, x1r, y1r, mx_len in rule.get('rects', []):
            if x0 <= mx <= x1r and y0 <= my <= y1r and ln < mx_len:
                return False
        return True

    segs = [s for s in segs if keep(s)]

    # Chains: union segments whose endpoints touch, then drop short chains.
    parent = list(range(len(segs)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    cell = {}
    for i, s in enumerate(segs):
        for (x, y) in ((s[0], s[1]), (s[2], s[3])):
            cx, cy = int(x / JOIN), int(y / JOIN)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for j, (px, py) in cell.get((cx + dx, cy + dy), []):
                        if j != i and abs(px - x) <= JOIN and abs(py - y) <= JOIN:
                            a, b = find(i), find(j)
                            if a != b:
                                parent[a] = b
            cell.setdefault((cx, cy), []).append((i, (x, y)))
    total = {}
    for i, s in enumerate(segs):
        r = find(i)
        total[r] = total.get(r, 0) + math.hypot(s[2] - s[0], s[3] - s[1])
    min_chain = rule.get('min_chain', MIN_CHAIN)
    segs = [s for i, s in enumerate(segs) if total[find(i)] >= min_chain]

    # Light sources reflected in the floor go with the reflection.
    fx = d.get('fx', [])
    if 'cut' in rule:
        fx = [f for f in fx if f[2] / asp <= rule['cut']]

    d['segs'] = [[round(v, 5) for v in s[:4]] for s in segs]
    d['fx'] = fx
    d['hiddenline'] = 1
    json.dump(d, open(path, 'w'), separators=(',', ':'))
    return n0, len(segs)


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    paths = sorted(glob.glob(os.path.join(root, 'public', 'shows', '*', '*.json'))) if '--all' in sys.argv else sys.argv[1:]
    for p in paths:
        a, b = clean(p)
        print(f'{os.path.relpath(p, root)}: {a} -> {b} segments')
