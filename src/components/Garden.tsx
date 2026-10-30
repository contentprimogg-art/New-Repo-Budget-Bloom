// Illustration maison du jardin: les fleurs s'épanouissent au fil des diapositives (stage 1 → 3).
// Mêmes couleurs que le logo: rose, jaune, vert sur fond beige.
const FLOWERS = [
  { x: 200, y: 262, r: 40, c: '#E46A9E', stage: 1 },
  { x: 118, y: 322, r: 28, c: '#F4B6CE', stage: 1 },
  { x: 292, y: 330, r: 30, c: '#E88AB4', stage: 2 },
  { x: 62, y: 372, r: 22, c: '#E88AB4', stage: 2 },
  { x: 345, y: 385, r: 26, c: '#F4B6CE', stage: 2 },
  { x: 168, y: 398, r: 32, c: '#E46A9E', stage: 2 },
  { x: 252, y: 418, r: 24, c: '#F4B6CE', stage: 3 },
  { x: 30, y: 300, r: 18, c: '#E46A9E', stage: 3 },
  { x: 372, y: 292, r: 18, c: '#E88AB4', stage: 3 },
  { x: 112, y: 226, r: 20, c: '#F4B6CE', stage: 3 },
  { x: 300, y: 214, r: 22, c: '#E46A9E', stage: 3 },
  { x: 206, y: 176, r: 18, c: '#E88AB4', stage: 3 },
]

const PETALS = [0, 72, 144, 216, 288]

function Flower({ x, y, r, c, delay }: { x: number; y: number; r: number; c: string; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* La tige et la fleur poussent depuis leur centre (origine locale). */}
      <g className="bloom" style={{ animationDelay: `${delay}ms`, transformOrigin: '0px 0px' }}>
        <path d={`M0 0Q${x > 200 ? -10 : 10} ${(520 - y) / 2} 0 ${520 - y}`} fill="none" stroke="#7FB88F" strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={x > 200 ? -12 : 12} cy={(520 - y) * 0.55} rx={r * 0.32} ry={r * 0.14} fill="#7FB88F" transform={`rotate(${x > 200 ? 30 : -30} ${x > 200 ? -12 : 12} ${(520 - y) * 0.55})`} />
        {PETALS.map((a) => (
          <ellipse key={a} cx={0} cy={-r * 0.62} rx={r * 0.4} ry={r * 0.62} fill={c} transform={`rotate(${a})`} />
        ))}
        <circle r={r * 0.3} fill="#F7C948" />
        <circle r={r * 0.3} fill="none" stroke="#E46A9E" strokeWidth={1.5} opacity={0.35} />
      </g>
    </g>
  )
}

export default function Garden({ stage }: { stage: 1 | 2 | 3 }) {
  const visible = FLOWERS.filter((f) => f.stage <= stage)
  return (
    <svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMax slice" aria-hidden className="size-full">
      <defs>
        <linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBE6EF" />
          <stop offset="1" stopColor="#F3E9DC" />
        </linearGradient>
      </defs>
      <rect width="400" height="520" fill="url(#garden-sky)" />
      <circle cx="318" cy="96" r="44" fill="#FFFFFF" opacity="0.55" />
      <path d="M0 470Q100 425 200 452T400 440V520H0Z" fill="#A9D3B4" />
      {visible.map((f, i) => (
        <Flower key={`${f.x}-${f.y}`} x={f.x} y={f.y} r={f.r} c={f.c} delay={i * 90} />
      ))}
      <path d="M0 505Q120 462 240 490T400 478V520H0Z" fill="#7FB88F" />
    </svg>
  )
}
