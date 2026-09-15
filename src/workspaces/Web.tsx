import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { useEffect, useRef, useState } from 'react'
import { buildMembershipGraph, findGroupCycles, groupIdSet } from '@shared/graph'
import { useApp } from '../state'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

export function Web() {
  const { snapshot, selectedId, select, activeFinding } = useApp()
  const host = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [userQuery, setUserQuery] = useState('')

  useEffect(() => {
    if (!host.current || !snapshot) return

    const groups = groupIdSet(snapshot.nodes)
    const graph = buildMembershipGraph(snapshot.nodes, snapshot.edges)
    const cycles = new Set(findGroupCycles(graph, groups).flat())
    const visible = new Set(snapshot.nodes.filter((n) => n.type === 'group').map((n) => n.id))

    const selected = snapshot.nodes.find((n) => n.id === selectedId)
    if (selected?.type === 'group') {
      for (const e of snapshot.edges) {
        if (e.to !== selected.id) continue
        const member = snapshot.nodes.find((n) => n.id === e.from)
        if (member?.type === 'user') visible.add(member.id)
      }
    }
    if (selected?.type === 'user') visible.add(selected.id)

    const q = userQuery.trim().toLowerCase()
    if (q) {
      for (const n of snapshot.nodes) {
        if (n.type !== 'user') continue
        const hay = `${n.displayName} ${n.sAMAccountName} ${n.userPrincipalName ?? ''}`.toLowerCase()
        if (hay.includes(q)) visible.add(n.id)
      }
    }

    const elements: cytoscape.ElementDefinition[] = []
    for (const n of snapshot.nodes) {
      if (!visible.has(n.id)) continue
      elements.push({
        data: {
          id: n.id,
          label: n.displayName,
          kind: n.type,
          privileged: n.privileged ? 1 : 0,
          cycle: cycles.has(n.id) ? 1 : 0
        }
      })
    }
    for (const e of snapshot.edges) {
      if (!visible.has(e.from) || !visible.has(e.to)) continue
      elements.push({ data: { id: `${e.from}->${e.to}`, source: e.from, target: e.to } })
    }

    cyRef.current?.destroy()
    const cy = cytoscape({
      container: host.current,
      elements,
      wheelSensitivity: 0.3,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#e7ebf1',
            'font-size': 10,
            'font-family': 'Segoe UI, system-ui, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'background-color': '#1c222b',
            'border-width': 1.5,
            'border-color': '#8d95a3',
            width: 18,
            height: 18
          }
        },
        {
          selector: 'node[kind = "group"]',
          style: { 'border-color': '#c9a35a', 'background-color': '#2a2418', width: 22, height: 22 }
        },
        {
          selector: 'node[privileged = 1]',
          style: { 'border-color': '#d36b6b', 'border-width': 2.5 }
        },
        {
          selector: 'node[cycle = 1]',
          style: { 'border-style': 'dashed', 'border-color': '#d36b6b' }
        },
        {
          selector: 'node[kind = "user"]',
          style: { 'border-color': '#8eb4d4', 'background-color': '#18222c' }
        },
        {
          selector: 'node:selected',
          style: { 'background-color': '#24364d', 'border-color': '#7aa2d4' }
        },
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': '#3a4250',
            'target-arrow-color': '#3a4250',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.7,
            'curve-style': 'bezier'
          }
        }
      ],
      layout: {
        name: 'fcose',
        animate: false,
        nodeSeparation: 90,
        quality: 'proof',
        randomize: false
      } as cytoscape.LayoutOptions
    })

    cy.on('tap', 'node', (ev) => select(ev.target.id()))
    cy.on('tap', (ev) => {
      if (ev.target === cy) select(null)
    })
    cyRef.current = cy
    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [snapshot, selectedId, userQuery, select])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().unselect()
    if (selectedId && cy.$id(selectedId).length) {
      const node = cy.$id(selectedId)
      node.select()
      cy.animate({ center: { eles: node }, duration: 180 })
    }
  }, [selectedId, snapshot, userQuery])

  if (!snapshot) return null

  const selected = snapshot.nodes.find((n) => n.id === selectedId)
  const hint =
    selected?.type === 'group'
      ? `Showing members of ${selected.displayName}`
      : selected?.type === 'user'
        ? `Showing ${selected.displayName} and groups`
        : 'Select a group to expand its users'

  return (
    <div className="split-list">
      <div className="toolbar">
        <span className="muted">{hint}</span>
        <input
          type="search"
          placeholder="Search users onto the web…"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <span className="muted">Gold = group · red ring = privileged · dashed = cycle</span>
      </div>
      {activeFinding && (activeFinding.type === 'circular-nesting' || activeFinding.type === 'deep-nesting' || activeFinding.type === 'distribution-in-security') ? (
        <div className="path-card" style={{ margin: '8px 12px 0' }}>
          <span className={`badge ${activeFinding.severity}`}>{activeFinding.severity}</span> {activeFinding.title}
          <p>{activeFinding.detail}</p>
          <p className="suggested">{activeFinding.suggestedFix}</p>
        </div>
      ) : null}
      <div className="web-wrap">
        <div className="web-canvas" ref={host} />
      </div>
    </div>
  )
}
