"use client";

import { animate, motionValue, type AnimationPlaybackControls } from "motion";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

// Critically damped for taps (zeta = 1: damping = 2 * sqrt(stiffness * mass)); about 80% for flicks.
const SPRING_TAP = { type: "spring", stiffness: 420, damping: 41, mass: 1 } as const;
const SPRING_FLICK = { type: "spring", stiffness: 420, damping: 33, mass: 1 } as const;

/** Rubber band past the top edge (the constant is a tuned guess, not an Apple value). */
function rubber(over: number): number {
  const c = 0.55;
  const d = 140;
  return -(1 - 1 / ((Math.abs(over) * c) / d + 1)) * d;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
  open: boolean;
  /** Called after the closing animation, for any dismissal (swipe, scrim, Esc, close button). */
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * Bottom sheet on a native <dialog> (focus trap, Esc and inert background come from the browser).
 * The header follows the finger 1:1 and releases by projected position; it is interruptible.
 * Reduced motion: fades instead of sliding.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [y] = useState(() => motionValue(0));
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    return y.on("change", (v) => {
      const panel = panelRef.current;
      const dlg = dialogRef.current;
      if (!panel || !dlg) return;
      const h = panel.offsetHeight || 1;
      const p = Math.min(1, Math.max(0, 1 - v / h));
      if (reduced()) {
        panel.style.transform = "";
        panel.style.opacity = String(p);
      } else {
        panel.style.opacity = "";
        panel.style.transform = v === 0 ? "" : `translate3d(0, ${v}px, 0)`;
      }
      dlg.style.setProperty("--p", String(p));
    });
  }, [y]);

  // Stay above the on-screen keyboard (iOS does not resize the layout viewport).
  useEffect(() => {
    const vv = window.visualViewport;
    const dlg = dialogRef.current;
    if (!vv || !dlg) return;
    const sync = () => {
      dlg.style.setProperty("--vv-h", `${vv.height}px`);
      dlg.style.setProperty("--vv-top", `${vv.offsetTop}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const finish = useCallback(() => {
    closing.current = false;
    const dlg = dialogRef.current;
    if (dlg?.open) dlg.close();
    onCloseRef.current();
  }, []);

  const closeAnimated = useCallback((velocity = 0) => {
    const panel = panelRef.current;
    const dlg = dialogRef.current;
    if (!panel || !dlg || closing.current) return;
    closing.current = true;
    controls.current?.stop();
    if (reduced()) {
      controls.current = animate(y, panel.offsetHeight, { duration: 0.12, ease: "linear", onComplete: finish });
      return;
    }
    controls.current = animate(y, dlg.clientHeight + 8, {
      ...(velocity > 300 ? SPRING_FLICK : SPRING_TAP),
      velocity,
      restDelta: 1,
      onComplete: finish,
    });
  }, [y, finish]);

  useEffect(() => {
    const dlg = dialogRef.current;
    const panel = panelRef.current;
    if (!dlg || !panel) return;
    if (!open) {
      if (dlg.open && !closing.current) closeAnimated();
      return;
    }
    if (dlg.open) return;
    closing.current = false;
    dlg.showModal();
    y.jump(dlg.clientHeight || panel.offsetHeight);
    controls.current = reduced()
      ? animate(y, 0, { duration: 0.12, ease: "linear" })
      : animate(y, 0, { ...SPRING_TAP, restDelta: 0.5 });
  }, [open, y, closeAnimated]);

  const drag = useRef<{ id: number; startY: number; base: number; samples: { t: number; y: number }[] } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    controls.current?.stop();
    closing.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startY: e.clientY, base: y.get(), samples: [{ t: e.timeStamp, y: e.clientY }] };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const raw = d.base + (e.clientY - d.startY);
    y.set(raw < 0 ? rubber(raw) : raw);
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    if (d.samples.length > 12) d.samples.shift();
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const recent = d.samples.filter((s) => e.timeStamp - s.t < 100);
    const first = recent[0] ?? d.samples[0];
    const vy = ((e.clientY - first.y) / Math.max(1, e.timeStamp - first.t)) * 1000;
    const h = panelRef.current?.offsetHeight ?? 400;
    if (y.get() + vy * 0.2 > Math.min(150, h * 0.3)) closeAnimated(Math.max(0, vy));
    else controls.current = animate(y, 0, { ...(Math.abs(vy) > 300 ? SPRING_FLICK : SPRING_TAP), velocity: vy, restDelta: 0.5 });
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        closeAnimated();
      }}
      onClose={() => {
        if (!closing.current) onCloseRef.current();
      }}
    >
      <div className="sheet-scrim" onClick={() => closeAnimated()} />
      <div ref={panelRef} className="sheet-panel">
        <div className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="sheet-grabber" aria-hidden="true" />
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => closeAnimated()}
              className="press grid size-11 shrink-0 place-items-center rounded-full bg-sunk"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
