/**
 * Page fragments. Everything here is a pure function of its arguments.
 *
 * The game shell is shared by the site page and the standalone portal package, so the
 * two builds can never drift apart: same DOM, same ids, same script. Every fixed label
 * is passed through T(lang, …) and content names through pick(record, …, lang).
 */
import { esc, fmtInt } from './utils.mjs';
import { icon } from './icons.mjs';
import { T } from './strings.mjs';
import { pick } from './i18n.mjs';

/* ---------------- cards ---------------- */

export function gameCard(game, lang = 'en') {
  return `<a class="game-card" href="${esc(game.href || game.path)}">
  <span class="game-card-art" aria-hidden="true">${game.cover ? `<img src="${esc(game.cover)}" alt="" width="960" height="540" loading="lazy" decoding="async">` : ''}</span>
  <span class="game-card-body">
    <span class="chip">${icon('gamepad', 14)} ${esc(T(lang, 'card.gameChip'))}</span>
    <span class="game-card-name">${esc(pick(game, 'name', lang))}</span>
    <span class="game-card-text">${esc(pick(game, 'tagline', lang))}</span>
    <span class="btn btn-primary">${icon('play', 16)} ${esc(T(lang, 'card.play'))}</span>
  </span>
</a>`;
}

export function toolCard(tool, lang = 'en') {
  return `<a class="tool-card" href="${esc(tool.href || tool.path)}">
  <span class="tool-card-ic" aria-hidden="true">${icon(tool.icon, 22)}</span>
  <span class="tool-card-body">
    <span class="tool-card-name">${esc(pick(tool, 'name', lang))}</span>
    <span class="tool-card-text">${esc(pick(tool, 'summary', lang))}</span>
  </span>
</a>`;
}

/* ---------------- game shell ----------------
   ids are the contract with src/game/<id>/main.js. */
/* Icons the game script injects after load (sprite symbols must already be on the page). */
export const GAME_RUNTIME_ICONS = ['axe', 'tree', 'gear', 'refresh', 'chevron-up'];

export function gameShell(game, { standalone = false, lang = 'en' } = {}) {
  const tree0 = game.config && game.config.trees ? game.config.trees[0] : null;
  const t = (key, vars) => esc(T(lang, key, vars));
  return `<div class="game" id="game" data-game="${esc(game.id)}">
  <canvas class="game-stage" id="stage" tabindex="0" role="button" aria-label="${t('gr.canvasAria')}">${t('gr.canvasNoSupport')}</canvas>

  <div class="game-hud">
    <div class="hud-res hud-timber"><span class="hud-ic" aria-hidden="true">${icon('tree', 16)}</span><b id="hudTimber">0</b><small id="hudRate">0/s</small></div>
    <div class="hud-res hud-gears" id="hudGearsWrap" hidden><span class="hud-ic" aria-hidden="true">${icon('gear', 16)}</span><b id="hudGears">0</b></div>
    <div class="hud-res hud-ms" id="hudMsWrap" hidden><span class="hud-ic" aria-hidden="true">${icon('bolt', 16)}</span><b id="hudMainsprings">0</b></div>
    <div class="combo" id="combo" hidden><b id="comboN">0</b><span>${t('gr.combo')} ×<b id="comboX">1.0</b></span></div>
    <button class="icon-btn hud-btn" id="settingsBtn" aria-label="${t('gr.settings')}">${icon('gear', 20)}</button>
  </div>

  <div class="tree-info"><span id="treeName">${tree0 ? esc(pick(tree0, 'name', lang)) : ''}</span><small id="treeTier"></small><div class="hp" role="progressbar" aria-label="${t('gr.hpAria')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="hpBar"></i></div></div>
  <p class="game-hint" id="gameHint">${icon('axe', 18)} <span id="hintText">${t('gr.hint')}</span></p>
  <p class="game-goal" id="gameGoal" hidden></p>
  <div class="ach-toast" id="achToast" role="status" aria-live="polite" hidden><b>${t('gr.achievement')}</b><span id="achToastName"></span></div>

  <button class="drawer-toggle" id="drawerToggle" aria-expanded="false" aria-controls="drawer">${icon('axe', 18)} ${t('gr.upgrades')} <b id="drawerHint" hidden></b>${icon('chevron-up', 18)}</button>

  <section class="drawer" id="drawer" aria-label="${t('gr.drawerAria')}">
    <div class="drawer-tabs" role="tablist" aria-label="${t('gr.tabsAria')}">
      <button class="tab" role="tab" id="tab-up" aria-selected="true" aria-controls="panel-up" data-tab="up">${icon('axe', 16)} ${t('gr.upgrades')}</button>
      <button class="tab" role="tab" id="tab-zones" aria-selected="false" aria-controls="panel-zones" data-tab="zones" tabindex="-1">${icon('tree', 16)} ${t('gr.districts')}</button>
      <button class="tab" role="tab" id="tab-rewind" aria-selected="false" aria-controls="panel-rewind" data-tab="rewind" tabindex="-1">${icon('refresh', 16)} ${t('gr.rewind')}</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-panel" id="panel-up" role="tabpanel" aria-labelledby="tab-up" data-panel="up"><div id="upgradeList"></div></div>
      <div class="drawer-panel" id="panel-zones" role="tabpanel" aria-labelledby="tab-zones" data-panel="zones" hidden><div id="zoneList"></div></div>
      <div class="drawer-panel" id="panel-rewind" role="tabpanel" aria-labelledby="tab-rewind" data-panel="rewind" hidden><div id="rewindPanel"></div></div>
    </div>
  </section>

  <dialog class="sheet" id="settingsDialog" aria-labelledby="settingsTitle">
    <form method="dialog" class="sheet-body">
      <h2 id="settingsTitle">${t('gr.settings')}</h2>
      <button class="row-btn" id="soundBtn" type="button"><span id="soundLabel">${t('gr.soundOn')}</span></button>
      <button class="row-btn" id="exportBtn" type="button">${t('gr.export')}</button>
      <label class="field-label" for="importCode">${t('gr.saveCode')}</label>
      <textarea class="g-field" id="importCode" rows="3" spellcheck="false" autocomplete="off" placeholder="${t('gr.saveCodePlaceholder')}"></textarea>
      <p class="sheet-note" id="importMsg" role="status" hidden></p>
      <button class="row-btn" id="importBtn" type="button">${t('gr.import')}</button>
      <p class="sheet-note">${t('gr.saveNote')}</p>
      <details class="ach-box" id="achDetails">
        <summary><span>${t('gr.achTitle')}</span><span class="ach-count" id="achCount"></span></summary>
        <ul class="ach-list" id="achList"></ul>
      </details>
      <button class="row-btn danger" id="resetBtn" type="button">${t('gr.reset')}</button>
      <button class="btn btn-primary" value="close">${t('gr.close')}</button>
    </form>
  </dialog>

  <dialog class="sheet" id="offlineDialog" aria-labelledby="offlineTitle">
    <div class="sheet-body">
      <h2 id="offlineTitle">${t('gr.awayTitle')}</h2>
      <p class="sheet-big" id="offlineAmount"></p>
      <p class="sheet-note" id="offlineDetail"></p>
      <button class="btn btn-primary" id="offlineCollect">${t('gr.collect')}</button>
    </div>
  </dialog>

  <dialog class="sheet" id="dailyDialog" aria-labelledby="dailyTitle">
    <div class="sheet-body">
      <h2 id="dailyTitle">${t('gr.dailyTitle')}</h2>
      <p class="sheet-big" id="dailyAmount"></p>
      <p class="sheet-note" id="dailyBody"></p>
      <button class="btn btn-primary" id="dailyClaim">${t('gr.claim')}</button>
    </div>
  </dialog>

  <dialog class="sheet" id="confirmDialog" aria-labelledby="confirmTitle">
    <div class="sheet-body">
      <h2 id="confirmTitle"></h2>
      <p class="sheet-note" id="confirmText"></p>
      <div class="sheet-actions"><button class="btn" id="confirmNo" autofocus>${t('gr.cancel')}</button><button class="btn btn-primary" id="confirmYes">${t('gr.confirm')}</button></div>
    </div>
  </dialog>

  <noscript><p class="game-noscript">${t('gr.canvasNoSupport')}</p></noscript>
</div>`;
}

/* ---------------- tool shells ----------------
   One id per control; src/tools/<id>/ui.js binds to them by name. */

const field = (id, label, control, hint = '') => `<div class="field"><label for="${id}">${esc(label)}</label>${control}${hint ? `<small class="hint">${hint}</small>` : ''}</div>`;
const select = (id, options, value) => `<select class="field" id="${id}">${options.map((o) => `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
const number = (id, value, { step = 'any', min = '', inputmode = 'decimal' } = {}) => `<input class="field" type="number" id="${id}" value="${esc(value)}" step="${step}"${min !== '' ? ` min="${esc(min)}"` : ''} inputmode="${inputmode}" autocomplete="off">`;
const copyRow = (label, id, copyWord) => `<div class="copy-row"><span class="copy-label">${esc(label)}</span><code id="${id}"></code><button class="copy-btn" type="button" data-copy="${id}" aria-label="${esc(`${copyWord}: ${label}`)}">${icon('copy', 16)}<span data-copy-label>${esc(copyWord)}</span></button></div>`;

function shellSens(tool, lang, t) {
  const games = (tool.client && tool.client.games) || [];
  const opts = games.map((g) => ({ value: g.id, label: g.name }));
  return `<form class="tool-form" id="toolForm" autocomplete="off" novalidate>
  <div class="grid-2">
    ${field('fromGame', T(lang, 'tu.sens.from'), select('fromGame', opts, 'cs2'))}
    ${field('toGame', T(lang, 'tu.sens.to'), select('toGame', opts, 'valorant'))}
    ${field('sens', T(lang, 'tu.sens.sens'), number('sens', '1.5'))}
    ${field('dpi', T(lang, 'tu.sens.dpi'), number('dpi', '800', { step: '1', min: '1', inputmode: 'numeric' }))}
    ${field('dpiTo', T(lang, 'tu.sens.dpiTo'), number('dpiTo', ''), esc(T(lang, 'tu.sens.dpiHint')))}
  </div>
  <p class="tool-error" id="toolError" role="alert" hidden></p>
</form>
<div class="tool-result" id="toolResult" aria-live="polite">
  <div class="result-hero"><span class="result-label">${T(lang, 'tu.sens.resultIn', { game: `<span id="resToName"></span>` })}</span><b id="resSens"></b><button class="copy-btn" type="button" data-copy="resSens">${icon('copy', 16)}<span data-copy-label>${t('copy.button')}</span></button></div>
  <div class="result-grid">
    <div class="result-cell"><span>${t('tu.sens.cm')}</span><b id="resCm"></b></div>
    <div class="result-cell"><span>${t('tu.sens.inch')}</span><b id="resIn"></b></div>
    <div class="result-cell"><span>${t('tu.sens.edpi')}</span><b id="resEdpi"></b></div>
    <div class="result-cell"><span>${t('tu.sens.counts')}</span><b id="resCounts"></b></div>
  </div>
  <h2 class="result-sub">${t('tu.sens.sameFeel')}</h2>
  <table class="result-table"><thead><tr><th scope="col">${t('tu.sens.colGame')}</th><th scope="col">${t('tu.sens.colSens')}</th><th scope="col">${t('tu.sens.colYaw')}</th></tr></thead><tbody id="resTable"></tbody></table>
</div>`;
}

function shellFov(tool, lang, t) {
  const aspects = (tool.client && tool.client.aspects) || [];
  const opts = aspects.map((a) => ({ value: a.id, label: `${a.id} (${a.w}:${a.h})` }));
  return `<form class="tool-form" id="toolForm" autocomplete="off" novalidate>
  <div class="grid-2">
    ${field('fov', T(lang, 'tu.fov.fov'), number('fov', '103'))}
    ${field('fovType', T(lang, 'tu.fov.type'), select('fovType', [{ value: 'h', label: T(lang, 'tu.fov.h') }, { value: 'v', label: T(lang, 'tu.fov.v') }], 'h'))}
    ${field('fromAspect', T(lang, 'tu.fov.from'), select('fromAspect', opts, '16:9'))}
    ${field('toAspect', T(lang, 'tu.fov.to'), select('toAspect', opts, '21:9'))}
  </div>
  <p class="tool-error" id="toolError" role="alert" hidden></p>
</form>
<div class="tool-result" id="toolResult" aria-live="polite">
  <div class="result-grid">
    <div class="result-cell"><span>${T(lang, 'tu.fov.resV')}</span><b id="resV"></b></div>
    <div class="result-cell"><span>${T(lang, 'tu.fov.resH', { aspect: '<span id="resFromLabel"></span>' })}</span><b id="resHFrom"></b></div>
    <div class="result-cell"><span>${T(lang, 'tu.fov.resH', { aspect: '<span id="resToLabel"></span>' })}</span><b id="resHTo"></b></div>
    <div class="result-cell"><span>${t('tu.fov.resH169')}</span><b id="resH169"></b></div>
  </div>
  <h2 class="result-sub">${t('tu.fov.mult')}</h2>
  <p class="result-note" id="fovNote"></p>
</div>`;
}

function shellSteam(tool, lang, t) {
  return `<form class="tool-form" id="toolForm" autocomplete="off" novalidate>
  ${field('steamInput', T(lang, 'tu.steam.input'), `<input class="field" type="text" id="steamInput" placeholder="${esc(T(lang, 'tu.steam.placeholder'))}" spellcheck="false">`, esc(T(lang, 'tu.steam.hint')))}
  <p class="tool-error" id="toolError" role="alert" hidden></p>
</form>
<div class="tool-result" id="toolResult" aria-live="polite">
  <div class="result-hero"><span class="result-label">${t('tu.steam.resultAccount')}</span><b id="resAccount"></b></div>
  <div class="copy-list">
    ${copyRow(T(lang, 'tu.steam.row64'), 'resId64', T(lang, 'copy.button'))}
    ${copyRow(T(lang, 'tu.steam.row3'), 'resId3', T(lang, 'copy.button'))}
    ${copyRow(T(lang, 'tu.steam.row2'), 'resId2', T(lang, 'copy.button'))}
    ${copyRow(T(lang, 'tu.steam.rowUrl'), 'resUrl', T(lang, 'copy.button'))}
  </div>
  <p class="result-note" id="resMeta"></p>
</div>`;
}

function shellDiscord(tool, lang, t) {
  const presets = [['now', 'tu.ts.presetNow'], ['15m', 'tu.ts.preset15m'], ['1h', 'tu.ts.preset1h'], ['8pm', 'tu.ts.preset8pm'], ['tomorrow', 'tu.ts.presetTomorrow'], ['friday', 'tu.ts.presetFriday']];
  return `<form class="tool-form" id="toolForm" autocomplete="off" novalidate>
  <div class="grid-2">
    ${field('tsDate', T(lang, 'tu.ts.date'), '<input class="field" type="date" id="tsDate">')}
    ${field('tsTime', T(lang, 'tu.ts.time'), '<input class="field" type="time" id="tsTime" step="60">')}
  </div>
  <div class="preset-row" role="group" aria-label="${esc(T(lang, 'tu.ts.presets'))}">${presets.map(([v, k]) => `<button class="chip-btn" type="button" data-preset="${v}">${esc(T(lang, k))}</button>`).join('')}</div>
  <p class="hint" id="tsZone"></p>
  <p class="tool-error" id="toolError" role="alert" hidden></p>
</form>
<div class="tool-result" id="toolResult" aria-live="polite">
  <div class="copy-list" id="tsList"></div>
  <h2 class="result-sub">${t('tu.ts.decode')}</h2>
  ${field('tsDecode', T(lang, 'tu.ts.decodeLabel'), '<input class="field" type="text" id="tsDecode" placeholder="<t:1700000000:R>" spellcheck="false">')}
  <p class="result-note" id="tsDecoded"></p>
</div>`;
}

function shellPrompt(tool, lang, t) {
  return `<form class="tool-form" id="toolForm" autocomplete="off" novalidate>
  ${field('ptPick', T(lang, 'tu.pt.template'), select('ptPick', [{ value: '', label: T(lang, 'tu.pt.loading') }], ''))}
  ${field('ptCustom', T(lang, 'tu.pt.custom'), `<textarea class="field" id="ptCustom" rows="4" spellcheck="false" placeholder="${esc(T(lang, 'tu.pt.customPlaceholder'))}"></textarea>`, esc(T(lang, 'tu.pt.customHint')))}
  <fieldset class="field" id="ptVars"><legend>${t('tu.pt.vars')}</legend><p class="hint">${t('tu.pt.noBlanks')}</p></fieldset>
  <p class="tool-error" id="toolError" role="alert" hidden></p>
</form>
<div class="tool-result" id="toolResult" aria-live="polite">
  <div class="result-head"><h2 class="result-sub">${t('tu.pt.out')}</h2><button class="copy-btn" type="button" id="ptCopy">${icon('copy', 16)}<span data-copy-label>${t('tu.pt.copy')}</span></button></div>
  <pre class="prompt-out" id="ptOut"></pre>
</div>`;
}

const SHELLS = {
  'sens-converter': shellSens,
  'fov-calculator': shellFov,
  'steam-id-converter': shellSteam,
  'discord-timestamp': shellDiscord,
  'prompt-template-builder': shellPrompt,
};

export function toolShell(tool, lang = 'en') {
  const build = SHELLS[tool.id];
  if (!build) throw new Error(`no shell for tool "${tool.id}"`);
  const t = (key, vars) => esc(T(lang, key, vars));
  return `<div class="tool" data-tool="${esc(tool.id)}">${build(tool, lang, t)}</div>`;
}

/* ---------------- prose ---------------- */

export function prose(sections, { start = 2 } = {}) {
  return sections.map((s) => `<section class="prose-section"><h${start} id="${esc(s.id)}">${esc(s.h)}</h${start}>${(s.p || []).map((p) => `<p>${p}</p>`).join('')}${s.list ? `<ul>${s.list.map((li) => `<li>${li}</li>`).join('')}</ul>` : ''}${s.table ? table(s.table) : ''}</section>`).join('');
}

function table(t) {
  if (!t || !t.head) return '';
  return `<div class="table-wrap"><table><thead><tr>${t.head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function faq(items, lang = 'en') {
  if (!items || !items.length) return '';
  return `<section class="prose-section"><h2 id="faq">${esc(T(lang, 'faq.heading'))}</h2>${items.map((f) => `<details class="faq"><summary>${esc(f.q)}</summary><p>${f.a}</p></details>`).join('')}</section>`;
}

export function stat(n, label) {
  return `<div class="stat"><b>${fmtInt(n)}</b><span>${esc(label)}</span></div>`;
}
