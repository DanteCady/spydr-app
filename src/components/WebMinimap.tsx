import type cytoscape from 'cytoscape'
import { useEffect, useRef } from 'react'

const W = 168
const H = 112
const PAD = 10

const FILL: Record<string, string> = {
  user: '#8eb4d4',
  group: '#c9a35a',
  cluster: '#7ea57c'
}

export function WebMinimap({ cy }: { cy: cytoscape.Core | null }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!cy || cy.destroyed()) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr

    let raf = 0
    let view = { scale: 1, ox: 0, oy: 0 }

    const draw = (): void => {
      raf = 0
      if (cy.destroyed()) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const bb = cy.elements().boundingBox()
      if (bb.w === 0 && bb.h === 0) return
      const scale = Math.min((W - PAD * 2) / Math.max(bb.w, 1), (H - PAD * 2) / Math.max(bb.h, 1))
      const ox = (W - bb.w * scale) / 2 - bb.x1 * scale
      const oy = (H - bb.h * scale) / 2 - bb.y1 * scale
      view = { scale, ox, oy }

      cy.nodes().forEach((n) => {
        const p = n.position()
        const priv = n.data('privileged') === 1
        ctx.fillStyle = priv ? '#d36b6b' : FILL[n.data('kind') as string] ?? '#8d95a3'
        ctx.beginPath()
        ctx.arc(p.x * scale + ox, p.y * scale + oy, priv ? 3 : 2.2, 0, Math.PI * 2)
        ctx.fill()
      })

      const container = cy.container()
      if (!container) return
      const zoom = cy.zoom()
      const pan = cy.pan()
      const vx = (-pan.x / zoom) * scale + ox
      const vy = (-pan.y / zoom) * scale + oy
      const vw = (container.clientWidth / zoom) * scale
      const vh = (container.clientHeight / zoom) * scale

      ctx.fillStyle = 'rgba(7, 9, 13, 0.55)'
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      ctx.rect(vx, vy, vw, vh)
      ctx.fill('evenodd')
      ctx.strokeStyle = '#7aa2d4'
      ctx.lineWidth = 1
      ctx.strokeRect(vx, vy, vw, vh)
    }

    const schedule = (): void => {
      if (!raf) raf = requestAnimationFrame(draw)
    }

    const panTo = (clientX: number, clientY: number): void => {
      const rect = canvas.getBoundingClientRect()
      const mx = ((clientX - rect.left) - view.ox) / view.scale
      const my = ((clientY - rect.top) - view.oy) / view.scale
      const container = cy.container()
      if (!container) return
      const zoom = cy.zoom()
      cy.pan({ x: container.clientWidth / 2 - mx * zoom, y: container.clientHeight / 2 - my * zoom })
    }

    let dragging = false
    const onDown = (ev: PointerEvent): void => {
      dragging = true
      canvas.setPointerCapture(ev.pointerId)
      panTo(ev.clientX, ev.clientY)
    }
    const onMove = (ev: PointerEvent): void => {
      if (dragging) panTo(ev.clientX, ev.clientY)
    }
    const onUp = (ev: PointerEvent): void => {
      dragging = false
      canvas.releasePointerCapture(ev.pointerId)
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)

    const events = 'viewport add remove position layoutstop'
    cy.on(events, schedule)
    schedule()

    return () => {
      cy.removeListener(events, schedule)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [cy])

  return <canvas ref={ref} className="web-minimap" style={{ width: W, height: H }} aria-label="Minimap" />
}
