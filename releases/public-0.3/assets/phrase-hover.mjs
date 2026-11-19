export function installPhraseHover(root) {
  const units = [...root.querySelectorAll('[data-align]')];
  const groups = new Map();
  for (const unit of units) {
    const key = unit.dataset.align;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit);
  }
  let active = null;
  function select(key) {
    if (key === active) return;
    for (const unit of groups.get(active) || []) unit.classList.remove('is-aligned');
    active = groups.has(key) ? key : null;
    for (const unit of groups.get(active) || []) unit.classList.add('is-aligned');
  }
  function unitAt(node) {
    const unit = node?.closest?.('[data-align]');
    return unit && root.contains(unit) ? unit : null;
  }
  // Only pointer moves into or out of a phrase change the mark. The browser fires pointer events after a
  // scroll even when the mouse rests outside the text, and those must not clear a keyboard-focused phrase.
  root.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const unit = unitAt(event.target);
    if (unit) select(unit.dataset.align);
  });
  root.addEventListener('pointerout', event => {
    if (event.pointerType === 'touch' || !unitAt(event.target)) return;
    select(unitAt(event.relatedTarget)?.dataset.align);
  });
  root.addEventListener('pointerdown', event => {
    const unit = unitAt(event.target);
    if (!unit) select(null);
    else if (event.pointerType === 'touch') select(unit.dataset.align);
  });
  root.addEventListener('focusin', event => {
    const unit = unitAt(event.target);
    if (unit) select(unit.dataset.align);
  });
  root.addEventListener('focusout', event => {
    select(unitAt(event.relatedTarget)?.dataset.align);
  });
  function move(target) {
    target.tabIndex = -1;
    target.focus();
    select(target.dataset.align);
  }
  root.addEventListener('keydown', event => {
    const unit = unitAt(event.target);
    if (!unit || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      select(null);
      // Return to the passage, which holds the reader's single tab stop.
      const passage = unit.closest('.passage');
      if (passage && passage.tabIndex >= 0) { event.preventDefault(); passage.focus(); }
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      // Jump to the same phrase on the other line (Korean and original).
      const line = unit.closest('p');
      const other = line?.parentElement?.querySelector(line.classList.contains('translation') ? '.original' : '.translation');
      const twin = other && other.getClientRects().length ? other.querySelector(`[data-align="${CSS.escape(unit.dataset.align)}"]`) : null;
      if (twin) { event.preventDefault(); move(twin); }
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const siblings = [...unit.closest('p').querySelectorAll('[data-align]')];
    const position = siblings.indexOf(unit);
    const rtl = unit.closest('p').dir === 'rtl';
    const step = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1 :
      Math.max(0, Math.min(siblings.length - 1, position + step));
    event.preventDefault();
    move(siblings[next]);
  });
}

if (typeof document !== 'undefined') installPhraseHover(document);
