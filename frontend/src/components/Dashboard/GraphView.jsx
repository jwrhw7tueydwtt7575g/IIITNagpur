import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import './GraphView.css';

export default function GraphView({
  graph,
  selectedNode,
  onSelectNode,
  // centerViewType and onToggleView kept for prop compatibility — navigation is handled
  // from the parent map view tab pills, not inside the graph view itself.
  // eslint-disable-next-line no-unused-vars
  centerViewType = 'graph',
  // eslint-disable-next-line no-unused-vars
  onToggleView = () => {},
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements = [
      ...(graph.nodes || []).map((node) => ({
        data: {
          id: node.id,
          label: node.short_name || node.name || node.id.replace('node_', 'N'),
          name: node.name || node.id,
          short_name: node.short_name || node.id,
          type: node.type,
          type_label: node.type_label || (
            node.type === 'hospital' ? 'Emergency Hospital' :
            node.type === 'fire_station' ? 'Emergency Operations' :
            node.type === 'drainage' ? 'Stormwater Pumping Station' :
            node.type === 'transformer' ? 'Power Grid Substation' :
            'Arterial Road Junction'
          ),
          zone: node.zone || 'Municipal Transit Grid',
          description: node.description || '',
          capacity: node.capacity,
          current_load: node.current_load,
          risk: node.risk,
          status: node.status,
          criticality: node.criticality,
          failure_reason: node.failure_reason || '',
        },
      })),

      ...(graph.edges || []).map((edge, index) => ({
        data: {
          id: `edge_${index}`,
          source: edge.source,
          target: edge.target,
          distance: edge.distance,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': '#ffffff',
            color: '#0f172a',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '8px',
            'font-weight': '700',
            'text-max-width': '65px',
            'text-wrap': 'ellipsis',
            width: 28,
            height: 28,
            'border-width': 2,
            'border-color': '#94a3b8',
            'text-outline-width': 2,
            'text-outline-color': '#ffffff',
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          },
        },
        {
          selector: 'node[type="hospital"]',
          style: {
            shape: 'hexagon',
            'background-color': '#0284c7',
            'border-color': '#0369a1',
            color: '#ffffff',
            'text-outline-color': '#0284c7',
            width: 34,
            height: 34,
          },
        },
        {
          selector: 'node[type="fire_station"]',
          style: {
            shape: 'diamond',
            'background-color': '#ea580c',
            'border-color': '#c2410c',
            color: '#ffffff',
            'text-outline-color': '#ea580c',
            width: 32,
            height: 32,
          },
        },
        {
          selector: 'node[type="drainage"]',
          style: {
            shape: 'rectangle',
            'background-color': '#0d9488',
            'border-color': '#0f766e',
            color: '#ffffff',
            'text-outline-color': '#0d9488',
            width: 30,
            height: 26,
          },
        },
        {
          selector: 'node[type="transformer"]',
          style: {
            shape: 'round-rectangle',
            'background-color': '#d97706',
            'border-color': '#b45309',
            color: '#ffffff',
            'text-outline-color': '#d97706',
            width: 30,
            height: 26,
          },
        },
        {
          selector: 'node[type="metro"]',
          style: {
            shape: 'round-tag',
            'background-color': '#7c3aed',
            'border-color': '#6d28d9',
            color: '#ffffff',
            'text-outline-color': '#7c3aed',
            width: 32,
            height: 32,
          },
        },
        {
          selector: 'node[type="road"]',
          style: {
            shape: 'ellipse',
            'background-color': '#f1f5f9',
            'border-color': '#94a3b8',
            width: 24,
            height: 24,
          },
        },
        {
          selector: 'node[status="failed"]',
          style: {
            'background-color': '#ef4444',
            'border-color': '#b91c1c',
            'border-width': 3.5,
            color: '#ffffff',
            'text-outline-color': '#ef4444',
            'z-index': 10,
          },
        },
        {
          selector: 'node[status="affected"]',
          style: {
            'background-color': '#f97316',
            'border-color': '#c2410c',
            'border-width': 3,
            color: '#ffffff',
            'text-outline-color': '#f97316',
            'z-index': 8,
          },
        },
        {
          selector: 'node[status="safe"]',
          style: {
            'border-color': '#10b981',
            'border-width': 2,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#0284c7',
            'border-width': 4,
            'background-blacken': -0.15,
            'z-index': 20,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#cbd5e1',
            'curve-style': 'bezier',
            opacity: 0.85,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: false,
        fit: true,
        padding: 30,
        nodeRepulsion: () => 400000,
        idealEdgeLength: () => 50,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nData = node.data();
      const raw = (graph.nodes || []).find((n) => n.id === nData.id);
      if (raw && onSelectNodeRef.current) onSelectNodeRef.current(raw);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph]);

  // Sync selected node
  useEffect(() => {
    if (cyRef.current && selectedNode) {
      const cyNode = cyRef.current.getElementById(selectedNode.id);
      if (cyNode && cyNode.length) {
        cyRef.current.$('node:selected').unselect();
        cyNode.select();
      }
    }
  }, [selectedNode]);

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 30);
    }
  };

  const handleReset = () => {
    if (cyRef.current) {
      cyRef.current.reset();
    }
  };

  return (
    <div className="graph-view-container">
      {/* Graph controls — no back option, user navigates via map tab pills */}
      <div className="graph-top-bar">
        <div className="graph-title-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>Topology Graph</span>
        </div>

        <div className="graph-actions-group">
          <button type="button" className="graph-action-btn" onClick={handleFit} title="Fit all nodes into view">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            <span>Fit Graph</span>
          </button>
          <button type="button" className="graph-action-btn" onClick={handleReset} title="Reset pan and zoom">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
            </svg>
            <span>Reset View</span>
          </button>
        </div>
      </div>

      <div ref={containerRef} className="cytoscape-canvas" />

      <div className="graph-footer-bar">
        <span className="graph-footer-label">INFRASTRUCTURE TOPOLOGY NETWORK</span>
        <span className="graph-footer-count">{(graph?.nodes || []).length} nodes · {(graph?.edges || []).length} edges</span>
      </div>
    </div>
  );
}
