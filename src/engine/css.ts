/*
  Per-frame style writes. Setting a custom property, even to the value it
  already has, can invalidate style for everything that inherits it, so each
  element remembers what it was last given and only changed values are
  written.
*/
const written = new WeakMap<HTMLElement, Map<string, string>>();

export function setVar(el: HTMLElement, name: string, value: string) {
  let m = written.get(el);
  if (!m) written.set(el, (m = new Map()));
  if (m.get(name) === value) return;
  m.set(name, value);
  el.style.setProperty(name, value);
}

export function setText(el: Element, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

export function setAttr(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export function setClass(el: Element, value: string) {
  if (el.className !== value) el.className = value;
}
