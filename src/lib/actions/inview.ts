/** Svelte action: adds `.in-view` and dispatches `inview` when the element enters the viewport. */
export function inview(
  node: HTMLElement,
  params?: { once?: boolean; amount?: number },
) {
  const { once = true, amount = 0.2 } = params ?? {};

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        node.dispatchEvent(new CustomEvent('inview'));
        node.classList.add('in-view');
        if (once) observer.unobserve(node);
      }
    },
    { threshold: amount },
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    },
  };
}
