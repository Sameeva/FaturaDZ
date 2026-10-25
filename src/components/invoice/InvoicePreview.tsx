"use client";

import { useEffect, useRef } from "react";
import type { PdfModel } from "@/pdf/model";
import { InvoicePrint } from "./InvoicePrint";

const A4_PX = 794; // 210 mm at 96 dpi

/**
 * On-screen paper preview of the printed invoice, scaled to the available width.
 * Scale and height are written with the CSSOM (no inline style attributes: the CSP forbids them).
 */
export function InvoicePreview({ model }: { model: PdfModel }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const fit = () => {
      const scale = Math.min(1, o.clientWidth / A4_PX);
      i.style.transform = `scale(${scale})`;
      o.style.height = `${i.offsetHeight * scale}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [model]);

  return (
    <div ref={outer} className="relative w-full overflow-hidden rounded-lg bg-white shadow-[var(--shadow)] ring-1 ring-border">
      <div ref={inner} className="absolute start-0 top-0 w-[794px] origin-top-left rtl:origin-top-right">
        <InvoicePrint model={model} preview />
      </div>
    </div>
  );
}
