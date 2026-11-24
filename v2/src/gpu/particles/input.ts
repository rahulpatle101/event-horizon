// Pointer input for the particle field. Adapted from the vgpu spiral-galaxy example's input.ts
// (MIT, Copyright (c) 2025 Vercel, Inc.): hover feeds the repel, touch repels while a finger is down.
// ARDENT listens on the window because the canvas sits behind the page content, and adds a pull
// toward the Send button on hover or keyboard focus.

export interface PointerState {
  /** Pointer in canvas CSS px, or undefined when it isn't over the scene. */
  pointer: [number, number] | undefined;
  /** Centre of the pull target in canvas CSS px, or undefined when nothing pulls. */
  pull: [number, number] | undefined;
}

export interface FieldInput {
  readonly state: PointerState;
  dispose(): void;
}

export function installFieldInput(canvas: HTMLCanvasElement, pullTarget: HTMLElement): FieldInput {
  const state: PointerState = { pointer: undefined, pull: undefined };
  let touchId: number | undefined;
  let pulling = false;

  const toCanvas = (x: number, y: number): [number, number] | undefined => {
    const rect = canvas.getBoundingClientRect();
    const px = x - rect.left;
    const py = y - rect.top;
    if (px < 0 || py < 0 || px > rect.width || py > rect.height) return undefined;
    return [px, py];
  };

  const updatePull = () => {
    if (!pulling || pullTarget.hidden) {
      state.pull = undefined;
      return;
    }
    const b = pullTarget.getBoundingClientRect();
    state.pull = toCanvas(b.left + b.width / 2, b.top + b.height / 2);
  };

  const move = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    if (event.pointerType === "touch") {
      if (event.pointerId !== touchId) return;
    } else if (event.buttons !== 0 && event.pointerType === "mouse") {
      // Dragging a text selection shouldn't shove stars around.
      state.pointer = undefined;
      return;
    }
    state.pointer = toCanvas(event.clientX, event.clientY);
    if (pulling) updatePull();
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    touchId = event.pointerId;
    state.pointer = toCanvas(event.clientX, event.clientY);
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === touchId) {
      touchId = undefined;
      state.pointer = undefined;
    }
  };
  const leave = (event: PointerEvent) => {
    if (event.relatedTarget === null) state.pointer = undefined;
  };
  const clear = () => {
    state.pointer = undefined;
    touchId = undefined;
  };
  const startPull = () => {
    pulling = true;
    updatePull();
  };
  const stopPull = () => {
    // Keep pulling while the button is still hovered or focused.
    pulling = pullTarget.matches(":hover") || pullTarget.matches(":focus-visible");
    updatePull();
  };
  const onScroll = () => updatePull();

  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", down, { passive: true });
  window.addEventListener("pointerup", up, { passive: true });
  window.addEventListener("pointercancel", up, { passive: true });
  window.addEventListener("pointerout", leave, { passive: true });
  window.addEventListener("blur", clear);
  window.addEventListener("scroll", onScroll, { passive: true });
  pullTarget.addEventListener("pointerenter", startPull);
  pullTarget.addEventListener("pointerleave", stopPull);
  pullTarget.addEventListener("focus", startPull);
  pullTarget.addEventListener("blur", stopPull);

  return {
    state,
    dispose() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", clear);
      window.removeEventListener("scroll", onScroll);
      pullTarget.removeEventListener("pointerenter", startPull);
      pullTarget.removeEventListener("pointerleave", stopPull);
      pullTarget.removeEventListener("focus", startPull);
      pullTarget.removeEventListener("blur", stopPull);
    },
  };
}
