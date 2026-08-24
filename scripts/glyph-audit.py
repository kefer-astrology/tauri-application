"""Measure how far each badge glyph's ink reaches from the badge centre."""
import os, re, math

TOK = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)', re.I)

def flatten(d, steps=24):
    """Yield every point on the path, sampling curves and arcs."""
    toks, i = [], 0
    for m in TOK.finditer(d):
        toks.append(m.group(1) or float(m.group(2)))
    x = y = sx = sy = 0.0
    px = py = None          # previous control point, for S/T
    op = None
    pts = []
    def take(n):
        nonlocal i
        v = toks[i:i+n]; i += n; return v
    while i < len(toks):
        if isinstance(toks[i], str):
            op = toks[i]; i += 1
            if op in 'Zz':
                x, y = sx, sy; pts.append((x, y)); continue
        rel = op.islower()
        o = op.upper()
        if o == 'M':
            a, b = take(2)
            x, y = (x+a, y+b) if rel else (a, b)
            sx, sy = x, y; pts.append((x, y)); op = 'l' if rel else 'L'
        elif o == 'L':
            a, b = take(2)
            x, y = (x+a, y+b) if rel else (a, b); pts.append((x, y))
        elif o == 'H':
            a, = take(1); x = x+a if rel else a; pts.append((x, y))
        elif o == 'V':
            a, = take(1); y = y+a if rel else a; pts.append((x, y))
        elif o in 'CSQT':
            if o == 'C':   c1x, c1y, c2x, c2y, ex, ey = take(6)
            elif o == 'S': c2x, c2y, ex, ey = take(4); c1x, c1y = 0, 0
            elif o == 'Q': c1x, c1y, ex, ey = take(4); c2x, c2y = c1x, c1y
            else:          ex, ey = take(2); c1x = c1y = c2x = c2y = 0
            if rel:
                c1x, c1y, c2x, c2y, ex, ey = x+c1x, y+c1y, x+c2x, y+c2y, x+ex, y+ey
            if o == 'S':
                c1x, c1y = (2*x-px, 2*y-py) if px is not None else (x, y)
            if o == 'T':
                c1x = c2x = (2*x-px) if px is not None else x
                c1y = c2y = (2*y-py) if py is not None else y
            for s in range(1, steps+1):
                t = s/steps; u = 1-t
                pts.append((u**3*x + 3*u*u*t*c1x + 3*u*t*t*c2x + t**3*ex,
                            u**3*y + 3*u*u*t*c1y + 3*u*t*t*c2y + t**3*ey))
            px, py = c2x, c2y
            x, y = ex, ey
            continue
        elif o == 'A':
            rx, ry, rot, laf, sf, ex, ey = take(7)
            if rel: ex, ey = x+ex, y+ey
            # endpoint -> centre parameterisation (SVG implementation notes)
            phi = math.radians(rot)
            cs, sn = math.cos(phi), math.sin(phi)
            dx2, dy2 = (x-ex)/2, (y-ey)/2
            x1p, y1p = cs*dx2 + sn*dy2, -sn*dx2 + cs*dy2
            rx, ry = abs(rx), abs(ry)
            lam = x1p*x1p/(rx*rx) + y1p*y1p/(ry*ry)
            if lam > 1: rx, ry = rx*math.sqrt(lam), ry*math.sqrt(lam)
            num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p
            den = rx*rx*y1p*y1p + ry*ry*x1p*x1p
            co = math.sqrt(max(0.0, num/den)) * (-1 if laf == sf else 1)
            cxp, cyp = co*rx*y1p/ry, -co*ry*x1p/rx
            cx, cy = cs*cxp - sn*cyp + (x+ex)/2, sn*cxp + cs*cyp + (y+ey)/2
            def ang(ux, uy, vx, vy):
                n = math.hypot(ux, uy)*math.hypot(vx, vy)
                if n == 0: return 0.0
                c = max(-1.0, min(1.0, (ux*vx+uy*vy)/n))
                a = math.acos(c)
                return -a if ux*vy - uy*vx < 0 else a
            th1 = ang(1, 0, (x1p-cxp)/rx, (y1p-cyp)/ry)
            dth = ang((x1p-cxp)/rx, (y1p-cyp)/ry, (-x1p-cxp)/rx, (-y1p-cyp)/ry)
            if not sf and dth > 0: dth -= 2*math.pi
            elif sf and dth < 0: dth += 2*math.pi
            for s in range(1, steps+1):
                t = th1 + dth*s/steps
                pts.append((cx + rx*math.cos(t)*cs - ry*math.sin(t)*sn,
                            cy + rx*math.cos(t)*sn + ry*math.sin(t)*cs))
            x, y = ex, ey
            px = py = None
            continue
        px = py = None
    return pts

def elements(src):
    """Yield (tag, attrs, (tx, ty, scale)) for every drawable, with any
    enclosing <g transform> composed in.

    Without this, a path inside a transformed group gets measured in its own
    coordinate space rather than the viewBox's, which wildly misstates its
    reach.
    """
    tag = re.compile(r'<(g|/g|path|circle)\b([^>]*?)/?>', re.I)
    stack, tx, ty, sc = [], 0.0, 0.0, 1.0
    for m in tag.finditer(src):
        name, attrs = m.group(1).lower(), m.group(2)
        if name == "g":
            stack.append((tx, ty, sc))
            for t in re.finditer(r'(translate|scale)\(([^)]+)\)', attrs):
                v = [float(x) for x in re.split(r'[,\s]+', t.group(2).strip()) if x]
                if t.group(1) == "translate":
                    tx, ty = tx + sc * v[0], ty + sc * (v[1] if len(v) > 1 else 0)
                else:
                    sc *= v[0]
            continue
        if name == "/g":
            if stack:
                tx, ty, sc = stack.pop()
            continue
        yield name, attrs, (tx, ty, sc)


def attr(attrs, key, default=None):
    m = re.search(rf'\b{key}="([^"]*)"', attrs)
    return m.group(1) if m else default


def stroke_w(attrs):
    m = (re.search(r'stroke-width:\s*([\d.]+)', attrs)
         or re.search(r'stroke-width="([\d.]+)"', attrs))
    return float(m.group(1)) if m else 0.0


def circle_of(attrs, xf):
    tx, ty, sc = xf
    cx, cy = float(attr(attrs, "cx", 0)), float(attr(attrs, "cy", 0))
    r = float(attr(attrs, "r", 0))
    return tx + sc * cx, ty + sc * cy, sc * r


def measure(src):
    """(worst reach, what, badge inner edge) or None when there is no badge."""
    items = list(elements(src))
    badge_sw = None
    for name, attrs, xf in items:
        if name != "circle":
            continue
        cx, cy, r = circle_of(attrs, xf)
        if abs(cx - 12) < .01 and abs(cy - 12) < .01 and abs(r - 10) < .01:
            badge_sw = stroke_w(attrs) * xf[2]
    if badge_sw is None:
        return None
    worst, what = 0.0, ""
    for name, attrs, xf in items:
        tx, ty, sc = xf
        sw = stroke_w(attrs) * sc
        if name == "circle":
            cx, cy, r = circle_of(attrs, xf)
            if abs(cx - 12) < .01 and abs(cy - 12) < .01 and abs(r - 10) < .01:
                continue
            d = math.hypot(cx - 12, cy - 12) + r + sw / 2
            if d > worst:
                worst, what = d, "circle"
        else:
            d = attr(attrs, "d")
            if not d:
                continue
            for px, py in flatten(d):
                x, y = tx + sc * px, ty + sc * py
                dist = math.hypot(x - 12, y - 12) + sw / 2
                if dist > worst:
                    worst, what = dist, "path"
    return worst, what, 10 - badge_sw / 2


def main(root="tauri-application/static/glyphs/default"):
    rows = []
    for cat in ("aspects", "planets", "zodiac"):
        d = os.path.join(root, cat)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".svg"):
                continue
            got = measure(open(os.path.join(d, fn), encoding="utf-8").read())
            if got:
                rows.append((f"{cat}/{fn[:-4]}", *got))

    bad = sorted((r for r in rows if r[1] > r[3]), key=lambda r: -r[1])
    print(f"badge glyphs audited: {len(rows)}")
    print(f"ink crossing the ring: {len(bad)}\n")
    for k, w, what, inner in bad:
        print(f"  {k:26} {what:6} reaches {w:6.2f}   over by {w - inner:+.2f}")
    clean = sorted((r for r in rows if r[1] <= r[3] and r[1] > 0),
                   key=lambda r: -r[1])
    print(f"\ntightest-fitting glyphs (inner edge "
          f"{rows[0][3] if rows else 0:.2f}):")
    for k, w, what, inner in clean[:6]:
        print(f"  {k:26} {what:6} reaches {w:5.2f}")


if __name__ == "__main__":
    import sys
    main(*(sys.argv[1:2] or []))
