/**
 * The product's own primitive: an account reaching a privileged group through nested membership,
 * over a web whose spokes converge on the group everything converges on. Generated rather than
 * hand-plotted so the geometry stays exact.
 */
const CX = 160
const CY = 86
const ANGLES = [20, 40, 60, 80, 100, 120, 140, 160].map((a) => (a * Math.PI) / 180)
const RADII = [120, 200, 280, 360]

const rad = (a: number, r: number): [number, number] => [CX + Math.cos(a) * r, CY + Math.sin(a) * r]

const spokes = ANGLES.map((a) => {
  const [x, y] = rad(a, 420)
  return `M${CX} ${CY} L${x.toFixed(1)} ${y.toFixed(1)}`
})

const rings = RADII.map((r) => {
  const points = ANGLES.map((a) => rad(a, r))
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const mid = (ANGLES[i] + ANGLES[i + 1]) / 2
    const [cx, cy] = rad(mid, r * 0.92) // silk sags between spokes
    const [x, y] = points[i + 1]
    d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
})

const NODES = [
  { y: 322, w: 104, label: 'Alice Chen', className: 'node user' },
  { y: 242, w: 104, label: 'IT-Admins', className: 'node' },
  { y: 162, w: 104, label: 'Tier0', className: 'node' },
  { y: 64, w: 128, label: 'Domain Admins', className: 'node priv' }
]

export function HeroGraph() {
  return (
    <figure className="hero-graph" aria-label="A user reaching Domain Admins through three nested groups">
      <svg viewBox="0 0 320 400" role="img">
        <defs>
          <marker id="tip" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 Z" fill="currentColor" />
          </marker>
        </defs>
        <g className="silk">
          {[...spokes, ...rings].map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g className="chain">
          {[322, 242, 162].map((from, i) => (
            <line key={from} x1={CX} y1={from} x2={CX} y2={from - 54 - (i === 2 ? 0 : 0)} markerEnd="url(#tip)" />
          ))}
        </g>
        {NODES.map((n) => (
          <g key={n.label} className={n.className}>
            <rect x={CX - n.w / 2} y={n.y} width={n.w} height={44} rx={7} />
            <text x={CX} y={n.y + 27}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <span className="mono">member list of Domain Admins</span> — Alice is not in it.
      </figcaption>
    </figure>
  )
}
