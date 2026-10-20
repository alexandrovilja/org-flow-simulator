import type { CSSProperties } from 'react'

/** Inline styl s CSS proměnnými (např. `--hue` feature nebo `--role` čipu).
 *  React CSSProperties vlastní proměnné nezná; tenhle typ je povolí bez přetypování, takže komponenta
 *  může předat jen vypočtenou hodnotu a zbytek vzhledu nechat v CSS modulu (feat-021). */
export type CssVariables = CSSProperties & { [name: `--${string}`]: string | number }
