import type { PdfModel } from "@/pdf/model";

// Same column order as PdfModel.columns / rows: designation, unit, qty, unit price, discount, TVA, total.
const ALIGN = ["text-left", "text-left", "text-right", "text-right", "text-right", "text-right", "text-right"] as const;
const WIDTH = ["w-[34%]", "w-[8%]", "w-[9%]", "w-[15%]", "w-[9%]", "w-[8%]", "w-[17%]"] as const;

function Ids({ ids }: { ids: [string, string][] }) {
  return (
    <dl className="mt-1">
      {ids.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-16 shrink-0 text-[#5d6470]">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A4 invoice for the browser's print dialog. Renders from the same PdfModel as the react-pdf
 * document, so figures and wording are identical. Hidden on screen, shown by `window.print()`;
 * the page chrome is hidden by the @media print rules in globals.css.
 */
export function InvoicePrint({ model }: { model: PdfModel }) {
  return (
    <article className="invoice-sheet hidden print:block" aria-label={model.title}>
      <header className="mb-4 flex justify-between gap-6">
        <div className="flex max-w-[60%] gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL, printed as-is */}
          {model.logo && <img src={model.logo} alt="" className="h-16 w-16 object-contain" />}
          <div>
            <h1 className="text-[13pt] font-bold">{model.seller.name}</h1>
            {model.seller.lines.map((l, i) => (
              <p key={i} className="text-[#5d6470]">
                {l}
              </p>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[18pt] font-bold text-[#0f6b4f]">{model.title}</p>
          {model.number && <p className="font-bold">N° {model.number}</p>}
          {model.isDraft && <p className="font-bold text-[#b42318]">BROUILLON — SANS VALEUR</p>}
          <p>Date : {model.issueDate}</p>
          {model.dueDate && <p>Échéance : {model.dueDate}</p>}
        </div>
      </header>

      <section className="mb-4 flex gap-3">
        <div className="invoice-box flex-1">
          <h2 className="invoice-label">Vendeur</h2>
          <Ids ids={model.seller.ids} />
        </div>
        {model.client && (
          <div className="invoice-box flex-1">
            <h2 className="invoice-label">{model.client.label}</h2>
            <p className="font-bold">{model.client.name}</p>
            {model.client.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            <Ids ids={model.client.ids} />
          </div>
        )}
      </section>

      <table className="w-full table-fixed border-collapse border border-[#c9ced6]">
        <thead className="table-header-group bg-[#eef1f4]">
          <tr>
            {model.columns.map((c, i) => (
              <th key={c} className={`invoice-cell font-bold ${ALIGN[i]} ${WIDTH[i]}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row, r) => (
            <tr key={r} className="break-inside-avoid">
              {row.map((v, i) => (
                <td key={i} className={`invoice-cell ${ALIGN[i]}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end break-inside-avoid">
        <table className="w-[55%] border-collapse">
          <tbody>
            {model.totals.map(([k, v]) => (
              <tr key={k}>
                <th className="py-0.5 text-left font-normal">{k}</th>
                <td className="py-0.5 text-right tabular-nums">{v}</td>
              </tr>
            ))}
            <tr className="border-t border-[#16181d] text-[11pt] font-bold">
              <th className="pt-1 text-left">{model.net[0]}</th>
              <td className="pt-1 text-right tabular-nums">{model.net[1]}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 break-inside-avoid">
        {model.inWordsLabel} <strong>{model.inWords}</strong>
      </p>

      <section className="mt-5 flex justify-between gap-4 break-inside-avoid">
        <div className="flex-1">
          <p>{model.payment}</p>
          {model.tvaNotice && <p className="text-[#5d6470]">{model.tvaNotice}</p>}
          {model.notes !== "" && <p className="mt-2 whitespace-pre-line">{model.notes}</p>}
        </div>
        <div className="invoice-box h-[70px] w-[180px]">
          <h2 className="invoice-label">Cachet et signature</h2>
        </div>
      </section>

      {model.footer && <footer className="invoice-footer">{model.footer}</footer>}
    </article>
  );
}
