const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Rolling amount. Each digit is a 0-9 column moved by a CSS transform transition (spring easing),
 * so it runs on the compositor and retargets smoothly. `text` is an already formatted amount
 * ("166 600,00"); the columns are keyed from the right so a digit keeps its column when the
 * number grows. Visual strips are aria-hidden, screen readers get `label`.
 */
export function Odometer({ text, unit = "DA", label }: { text: string; unit?: string; label: string }) {
  const chars = [...text];
  return (
    <span className="inline-block">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="od-row">
        {chars.map((ch, i) => {
          const fromRight = chars.length - 1 - i;
          return /\d/.test(ch) ? (
            <span className="od-cell" key={`d${fromRight}`}>
              <span className="od-strip" data-d={ch}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span className="od-sep" key={`s${fromRight}`}>
              {ch}
            </span>
          );
        })}
        {unit && <span className="od-unit">{unit}</span>}
      </span>
    </span>
  );
}
