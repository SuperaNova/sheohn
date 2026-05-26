import { writable, derived } from 'svelte/store';

export const activeFocus = writable<string | null>(null);
export const overlayActive = derived(activeFocus, ($f) => !!$f);

export function setFocus(focus: string | null) {
  activeFocus.set(focus);
}

export function clearFocus() {
  activeFocus.set(null);
}
