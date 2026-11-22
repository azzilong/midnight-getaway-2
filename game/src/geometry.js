// Midnight Getaway — small geometry helpers shared by both acts:
// circle-vs-rectangle collision and segment-vs-rectangle sight tests.

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Push a circle out of a rectangle it overlaps. Returns true on a hit.
export function pushCircleOutOfRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= circle.r * circle.r) return false;
  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    circle.x = nearestX + (dx / dist) * circle.r;
    circle.y = nearestY + (dy / dist) * circle.r;
  } else {
    // Centre is inside the rectangle: push out along the shallowest side.
    const left = circle.x - rect.x;
    const right = rect.x + rect.w - circle.x;
    const top = circle.y - rect.y;
    const bottom = rect.y + rect.h - circle.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) circle.x = rect.x - circle.r;
    else if (min === right) circle.x = rect.x + rect.w + circle.r;
    else if (min === top) circle.y = rect.y - circle.r;
    else circle.y = rect.y + rect.h + circle.r;
  }
  return true;
}

export function circleHitsRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

// True when the segment from (x1, y1) to (x2, y2) crosses the rectangle.
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  const axes = [
    { d: dx, origin: x1, min: rect.x, max: rect.x + rect.w },
    { d: dy, origin: y1, min: rect.y, max: rect.y + rect.h },
  ];
  for (const axis of axes) {
    if (Math.abs(axis.d) < 1e-9) {
      if (axis.origin < axis.min || axis.origin > axis.max) return false;
    } else {
      let t1 = (axis.min - axis.origin) / axis.d;
      let t2 = (axis.max - axis.origin) / axis.d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

export function segmentBlockedByRects(x1, y1, x2, y2, rects) {
  for (const rect of rects) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return false;
}

// True when the segment passes through a smoke cloud (a circle).
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(cx - x1, cy - y1) < r;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return Math.hypot(cx - px, cy - py) < r;
}
