/**
 * Field-of-view maths. Pure functions; the aspect ratio list comes from tools.json.
 *
 * Most engines fix the vertical FOV and stretch sideways, so horizontal and vertical
 * angles are linked by the display's shape:  tan(h / 2) = aspect × tan(v / 2).
 */
const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function hToV(horizontal, aspect) {
  return deg(2 * Math.atan(Math.tan(rad(horizontal) / 2) / aspect));
}

export function vToH(vertical, aspect) {
  return deg(2 * Math.atan(Math.tan(rad(vertical) / 2) * aspect));
}

export function aspectOf(shape) {
  return shape.w / shape.h;
}

/**
 * input.fov: the number from the game's settings
 * input.type: 'h' if that number is horizontal, 'v' if vertical
 * input.from: the display that number was quoted for
 * input.to: the display to convert to
 * Returns { ok: true, v, hFrom, hTo, h169, sensMult } or { ok: false, code }.
 * sensMult: the factor that keeps crosshair travel per centimetre of mouse movement
 * the same when the horizontal FOV changes from hFrom to hTo.
 * `code` names a message in src/lib/strings.mjs.
 */
export function resolveFov(input) {
  const { fov, type, from, to } = input;
  if (!Number.isFinite(fov)) return { ok: false, code: 'err.fovNumber' };
  if (fov <= 1 || fov >= 179) return { ok: false, code: 'err.fovRange' };
  if (!from || !to) return { ok: false, code: 'err.pickDisplays' };

  const v = type === 'h' ? hToV(fov, aspectOf(from)) : fov;
  const hFrom = vToH(v, aspectOf(from));
  const hTo = vToH(v, aspectOf(to));
  const h169 = vToH(v, 16 / 9);
  return { ok: true, v, hFrom, hTo, h169, sensMult: Math.tan(rad(hTo) / 2) / Math.tan(rad(hFrom) / 2) };
}
