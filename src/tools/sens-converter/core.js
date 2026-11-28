/**
 * Mouse sensitivity maths. Pure functions; the game list comes from tools.json.
 *
 * A game turns the view by `yaw` degrees per mouse count, so a full turn takes
 * 360 / (yaw × sensitivity) counts.
 */
export const INCH_CM = 2.54;

export function countsPer360(sens, yaw) {
  return 360 / (yaw * sens);
}

export function cmPer360(sens, dpi, yaw) {
  return (countsPer360(sens, yaw) / dpi) * INCH_CM;
}

/** Sensitivity in the target game that needs the same mouse distance per full turn. */
export function convert(sens, fromYaw, toYaw, dpiFrom, dpiTo = dpiFrom) {
  return (sens * fromYaw * dpiFrom) / (toYaw * dpiTo);
}

export function edpi(sens, dpi) {
  return sens * dpi;
}

/** Four significant decimals is finer than any game's settings step. */
export function roundSens(x) {
  return Number(Math.max(0.0001, x).toFixed(4));
}

const positive = (x) => Number.isFinite(x) && x > 0;

/**
 * Convert one setting into every supported game.
 * input: { sens, dpi, dpiTo, from, to, games }  (dpiTo empty means keep the DPI)
 * Returns { ok: true, ...values } or { ok: false, code } — `code` is a key in
 * src/lib/strings.mjs, so the message can be shown in either language.
 */
export function convertAll(input) {
  const { sens, dpi, dpiTo, from, to, games } = input;
  if (!positive(sens)) return { ok: false, code: 'err.sensPositive' };
  if (!positive(dpi)) return { ok: false, code: 'err.dpiPositive' };
  if (dpiTo !== '' && dpiTo !== null && dpiTo !== undefined && !positive(dpiTo)) return { ok: false, code: 'err.dpiTarget' };
  if (!from || !to) return { ok: false, code: 'err.pickGames' };

  const targetDpi = dpiTo === '' || dpiTo === null || dpiTo === undefined ? dpi : dpiTo;
  const toSens = convert(sens, from.yaw, to.yaw, dpi, targetDpi);
  const rows = games.map((g) => ({ id: g.id, name: g.name, yaw: g.yaw, sens: roundSens(convert(sens, from.yaw, g.yaw, dpi, dpi)) }));
  return {
    ok: true,
    toSens: roundSens(toSens),
    cm: cmPer360(sens, dpi, from.yaw),
    inches: cmPer360(sens, dpi, from.yaw) / INCH_CM,
    counts: countsPer360(sens, from.yaw),
    edpi: edpi(sens, dpi),
    rows,
  };
}
