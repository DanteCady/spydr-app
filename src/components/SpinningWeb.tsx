import { WidowMark } from './WidowMark'

/**
 * The waiting state: a web being spun.
 *
 * Spokes go out first, then the rings are laid around them, sagging between the spokes the way
 * silk does — which is the actual order an orb weaver builds in. It loops, so a slow licence check
 * looks like work rather than a stall, and the mark sits in the middle where the spider waits.
 *
 * Paths carry pathLength="1", so a dash offset of 1 is "not drawn yet" regardless of how long the
 * path really is, and every strand can share one set of keyframes.
 */

const SPOKES = 8
const RINGS = [0.36, 0.58, 0.8, 1]
const CENTRE = 50
const RADIUS = 44

function point(index: number, radius: number): [number, number] {
  const angle = (index / SPOKES) * Math.PI * 2 - Math.PI / 2
  return [CENTRE + Math.cos(angle) * radius, CENTRE + Math.sin(angle) * radius]
}

const spokes = Array.from({ length: SPOKES }, (_, i) => {
  const [x, y] = point(i, RADIUS)
  return `M${CENTRE} ${CENTRE} L${x.toFixed(2)} ${y.toFixed(2)}`
})

/** One ring, drawn as a quadratic between each pair of spokes so the silk sags inward. */
const rings = RINGS.map((scale) => {
  const r = RADIUS * scale
  let d = ''
  for (let i = 0; i < SPOKES; i += 1) {
    const [x0, y0] = point(i, r)
    const [x1, y1] = point(i + 1, r)
    const [cx, cy] = point(i + 0.5, r * 0.86)
    d += i === 0 ? `M${x0.toFixed(2)} ${y0.toFixed(2)}` : ''
    d += ` Q${cx.toFixed(2)} ${cy.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`
  }
  return d
})

export function SpinningWeb({ size = 96, label = 'Working' }: { size?: number; label?: string }) {
  return (
    <span className="spinning-web" role="status" aria-label={label} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <g className="web-spokes">
          {spokes.map((d, i) => (
            <path key={d} d={d} pathLength={1} style={{ animationDelay: `${i * 0.06}s` }} />
          ))}
        </g>
        <g className="web-rings">
          {rings.map((d, i) => (
            <path key={d} d={d} pathLength={1} style={{ animationDelay: `${0.5 + i * 0.18}s` }} />
          ))}
        </g>
      </svg>
      <span className="web-widow" aria-hidden>
        <WidowMark size={Math.round(size * 0.2)} />
      </span>
    </span>
  )
}
