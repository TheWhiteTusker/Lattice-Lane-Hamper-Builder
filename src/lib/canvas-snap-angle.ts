/** Right-angle snapping for lines and curves. Re-exported from hamper-canvas.ts. */

export interface SnapRightAngleOptions {
  enabled?: boolean;
  thresholdPx?: number;
  thresholdAngleDeg?: number;
  shiftKey?: boolean;
}

export interface SnapResult {
  x: number;
  y: number;
  snapped: "horizontal" | "vertical" | "diagonal" | null;
}

/**
 * Magnetically snaps the target point to horizontal or vertical right angles relative
 * to the origin point when drawing or editing lines/curves.
 * If Shift is pressed, snaps to 45-degree angle increments.
 */
export function snapToRightAngle(
  origin: { x: number; y: number },
  target: { x: number; y: number },
  options: SnapRightAngleOptions = {},
): SnapResult {
  const {
    enabled = true,
    thresholdPx = 18,
    thresholdAngleDeg = 7,
    shiftKey = false,
  } = options;

  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 2) {
    return { x: target.x, y: target.y, snapped: null };
  }

  // When Shift is held, snap strictly to 45° increments (0, 45, 90, 135, ...)
  if (shiftKey) {
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const snappedAngle = Math.round(angle / step) * step;
    const nx = origin.x + Math.round(dist * Math.cos(snappedAngle));
    const ny = origin.y + Math.round(dist * Math.sin(snappedAngle));
    const isHoriz = Math.abs(Math.sin(snappedAngle)) < 1e-4;
    const isVert = Math.abs(Math.cos(snappedAngle)) < 1e-4;
    return {
      x: nx,
      y: ny,
      snapped: isHoriz ? "horizontal" : isVert ? "vertical" : "diagonal",
    };
  }

  if (!enabled) {
    return { x: target.x, y: target.y, snapped: null };
  }

  // Angle deviations from nearest horizontal axis (0° or 180°)
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = Math.abs(angleRad * (180 / Math.PI));
  const absAngleFromHorizontal = Math.min(angleDeg, Math.abs(180 - angleDeg));
  const absAngleFromVertical = Math.abs(90 - absAngleFromHorizontal);

  // Horizontal snap: close in angle (<= thresholdAngleDeg) or close in px (<= thresholdPx) and roughly aligned (<= 16°)
  if (
    absAngleFromHorizontal <= thresholdAngleDeg ||
    (Math.abs(dy) <= thresholdPx && absAngleFromHorizontal <= 16)
  ) {
    return { x: target.x, y: origin.y, snapped: "horizontal" };
  }

  // Vertical snap: close in angle (<= thresholdAngleDeg) or close in px (<= thresholdPx) and roughly aligned (<= 16°)
  if (
    absAngleFromVertical <= thresholdAngleDeg ||
    (Math.abs(dx) <= thresholdPx && absAngleFromVertical <= 16)
  ) {
    return { x: origin.x, y: target.y, snapped: "vertical" };
  }

  return { x: target.x, y: target.y, snapped: null };
}
