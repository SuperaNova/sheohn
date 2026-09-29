/**
 * Svelte action: magnetic hover. Pulls the node toward the cursor and springs back on leave;
 * pointer-fine devices only, off under reduced motion. Pair with a CSS `transform` transition.
 */
export function magnetic(
  node: HTMLElement,
  params?: { strength?: number; max?: number },
) {
  const strength = params?.strength ?? 0.35;
  const max = params?.max ?? 14; // clamp px so it never drifts far

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (reduced || !fine) return {};

  let raf = 0;

  function onMove(e: MouseEvent) {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const x = Math.max(-max, Math.min(max, dx * strength));
      const y = Math.max(-max, Math.min(max, dy * strength));
      node.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  function onLeave() {
    cancelAnimationFrame(raf);
    node.style.transform = 'translate(0px, 0px)';
  }

  node.addEventListener('mousemove', onMove);
  node.addEventListener('mouseleave', onLeave);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    },
  };
}
