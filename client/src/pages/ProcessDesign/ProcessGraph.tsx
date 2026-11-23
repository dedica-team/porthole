import { useId, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { Connection } from '@/types/connection';
import type { Landmark, LandmarkGroup } from '@/types/landmark';
import type { Process } from '@/types/process';
import { projectProcessGraph, computeProcessGraphEdges } from './ProcessGraphLayout';

export type ProcessGraphSelection =
  | { type: 'landmark'; landmarkId: string }
  | { type: 'connection'; stageId: string; stageConnectionId: string };

export interface ProcessGraphProps {
  process: Process;
  landmarks: Landmark[];
  connections: Connection[];
  groups?: Record<string, LandmarkGroup> | LandmarkGroup[];
  extraLandmarkIds?: string[];
  selection?: ProcessGraphSelection | null;
  onSelect?: (selection: ProcessGraphSelection) => void;
  onConnectNodes?: (sourceLandmarkId: string, targetLandmarkId: string) => void;
  onDropLandmark?: (landmarkId: string, position: { x: number; y: number }) => void;
  onEditConnection?: (connectionId: string) => void;
  className?: string;
}

export default function ProcessGraph({
  process,
  landmarks,
  connections,
  groups,
  extraLandmarkIds,
  selection,
  onSelect,
  onConnectNodes,
  onDropLandmark,
  onEditConnection,
  className,
}: ProcessGraphProps) {
  const graph = useMemo(
    () => projectProcessGraph(process, landmarks, connections, extraLandmarkIds),
    [process, landmarks, connections, extraLandmarkIds]
  );

  const groupsMap = useMemo(() => {
    if (!groups) return new Map<string, LandmarkGroup>();
    if (Array.isArray(groups)) {
      return new Map(groups.map((g) => [g.id, g]));
    }
    return new Map(Object.entries(groups));
  }, [groups]);

  const markerId = useId();
  const gridId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasGroupRef = useRef<SVGGElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isPanning, setIsPanning] = useState(false);

  // Connecting drag state
  const [connectingLine, setConnectingLine] = useState<{
    sourceLandmarkId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hoveredTargetId: string | null;
  } | null>(null);

  const dragRef = useRef<{
    landmarkId: string;
    startPointer: { x: number; y: number };
    startNode: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  const panRef = useRef<{
    startPointer: { x: number; y: number };
    startPan: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  const connectDragRef = useRef<{
    sourceLandmarkId: string;
    startX: number;
    startY: number;
    pointerId: number;
    hoveredTargetId: string | null;
  } | null>(null);

  // Helper to map screen coordinates to SVG canvas space (accounting for pan & zoom)
  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const group = canvasGroupRef.current;
      if (group && typeof group.getScreenCTM === 'function') {
        const ctm = group.getScreenCTM();
        if (ctm) {
          const inverse = ctm.inverse();
          if (typeof DOMPoint !== 'undefined') {
            const pt = new DOMPoint(clientX, clientY).matrixTransform(inverse);
            return { x: Math.round(pt.x), y: Math.round(pt.y) };
          } else if (svgRef.current && typeof svgRef.current.createSVGPoint === 'function') {
            const pt = svgRef.current.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const transformed = pt.matrixTransform(inverse);
            return { x: Math.round(transformed.x), y: Math.round(transformed.y) };
          }
        }
      }
      const svg = svgRef.current;
      if (!svg) return { x: graph.width / 2, y: graph.height / 2 };
      const rect = svg.getBoundingClientRect();
      const effectiveScale =
        rect.width > 0 && rect.height > 0
          ? Math.min(rect.width / graph.width, rect.height / graph.height)
          : 1;
      const scale = effectiveScale > 0 ? 1 / effectiveScale : 1;
      const offsetX = rect.width > 0 ? (rect.width - graph.width * effectiveScale) / 2 : 0;
      const offsetY = rect.height > 0 ? (rect.height - graph.height * effectiveScale) / 2 : 0;
      const viewBoxX = (clientX - (rect.left + offsetX)) * scale;
      const viewBoxY = (clientY - (rect.top + offsetY)) * scale;
      const canvasX = (viewBoxX - pan.x - graph.width / 2) / zoom + graph.width / 2;
      const canvasY = (viewBoxY - pan.y - graph.height / 2) / zoom + graph.height / 2;
      return { x: Math.round(canvasX), y: Math.round(canvasY) };
    },
    [graph.width, graph.height, pan.x, pan.y, zoom]
  );

  // Helper to map screen coordinates to SVG viewBox space (for panning)
  const getSvgCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (svg && typeof svg.getScreenCTM === 'function') {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const inverse = ctm.inverse();
          if (typeof DOMPoint !== 'undefined') {
            const pt = new DOMPoint(clientX, clientY).matrixTransform(inverse);
            return { x: pt.x, y: pt.y };
          } else if (typeof svg.createSVGPoint === 'function') {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const transformed = pt.matrixTransform(inverse);
            return { x: transformed.x, y: transformed.y };
          }
        }
      }
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const effectiveScale =
        rect.width > 0 && rect.height > 0
          ? Math.min(rect.width / graph.width, rect.height / graph.height)
          : 1;
      const scale = effectiveScale > 0 ? 1 / effectiveScale : 1;
      const offsetX = rect.width > 0 ? (rect.width - graph.width * effectiveScale) / 2 : 0;
      const offsetY = rect.height > 0 ? (rect.height - graph.height * effectiveScale) / 2 : 0;
      const viewBoxX = (clientX - (rect.left + offsetX)) * scale;
      const viewBoxY = (clientY - (rect.top + offsetY)) * scale;
      return { x: viewBoxX, y: viewBoxY };
    },
    [graph.width, graph.height]
  );

  // Re-sync or clean up custom positions when landmarks or process change
  const nodePositionsMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of graph.nodes) {
      const pos = customPositions[node.landmark.id] ?? { x: node.x, y: node.y };
      map.set(node.landmark.id, pos);
    }
    return map;
  }, [graph.nodes, customPositions]);

  const activeNodes = useMemo(() => {
    return graph.nodes.map((node) => {
      const pos = nodePositionsMap.get(node.landmark.id) ?? { x: node.x, y: node.y };
      return { ...node, x: pos.x, y: pos.y };
    });
  }, [graph.nodes, nodePositionsMap]);

  const activeEdges = useMemo(() => {
    return computeProcessGraphEdges(graph.resolved, nodePositionsMap);
  }, [graph.resolved, nodePositionsMap]);

  // Non-passive wheel listener on SVG to zoom with Ctrl/Meta (and trackpad pinch) without blocking regular page scroll
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom((z) => Math.min(3, Math.max(0.3, Number((z * factor).toFixed(2)))));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCustomPositions({});
  };

  const activate = (event: KeyboardEvent<SVGGElement>, value: ProcessGraphSelection) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(value);
    }
  };

  // Node dragging handlers
  const handleNodePointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    landmarkId: string,
    nodeX: number,
    nodeY: number
  ) => {
    if (e.button !== 0 || connectDragRef.current) return;
    e.stopPropagation();
    const pt = getCanvasCoordinates(e.clientX, e.clientY);
    dragRef.current = {
      landmarkId,
      startPointer: pt,
      startNode: { x: nodeX, y: nodeY },
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture is unsupported
    }
  };

  const handleNodePointerMove = (e: ReactPointerEvent<SVGGElement>) => {
    if (!dragRef.current || !svgRef.current) return;
    const { landmarkId, startPointer, startNode } = dragRef.current;
    const pt = getCanvasCoordinates(e.clientX, e.clientY);
    const dx = pt.x - startPointer.x;
    const dy = pt.y - startPointer.y;
    if (!dragRef.current.moved && Math.hypot(dx, dy) > 2) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.moved) {
      setCustomPositions((prev) => ({
        ...prev,
        [landmarkId]: { x: startNode.x + dx, y: startNode.y + dy },
      }));
    }
  };

  const handleNodePointerUp = (e: ReactPointerEvent<SVGGElement>, landmarkId: string) => {
    if (!dragRef.current) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    if (!wasMoved) {
      onSelect?.({ type: 'landmark', landmarkId });
    }
  };

  // Connection dragging handlers
  const handleConnectPointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    landmarkId: string,
    startX: number,
    startY: number
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    connectDragRef.current = {
      sourceLandmarkId: landmarkId,
      startX,
      startY,
      pointerId: e.pointerId,
      hoveredTargetId: null,
    };
    setConnectingLine({
      sourceLandmarkId: landmarkId,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      hoveredTargetId: null,
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleConnectPointerMove = (e: ReactPointerEvent<SVGGElement>) => {
    if (!connectDragRef.current) return;
    const pt = getCanvasCoordinates(e.clientX, e.clientY);
    // Find hovered target node
    const hovered = activeNodes.find(
      (n) => Math.abs(pt.x - n.x) <= 50 && Math.abs(pt.y - n.y) <= 32
    );
    const targetId = hovered ? hovered.landmark.id : null;
    connectDragRef.current.hoveredTargetId = targetId;
    setConnectingLine((prev) =>
      prev
        ? {
            ...prev,
            currentX: pt.x,
            currentY: pt.y,
            hoveredTargetId: targetId,
          }
        : null
    );
  };

  const handleConnectPointerUp = (e: ReactPointerEvent<SVGGElement>) => {
    if (!connectDragRef.current) return;
    const sourceId = connectDragRef.current.sourceLandmarkId;
    const targetId = connectDragRef.current.hoveredTargetId;
    connectDragRef.current = null;
    setConnectingLine(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    if (targetId && onConnectNodes) {
      onConnectNodes(sourceId, targetId);
    }
  };

  // Canvas panning handlers
  const handleCanvasPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || connectDragRef.current || dragRef.current) return;
    const pt = getSvgCoordinates(e.clientX, e.clientY);
    panRef.current = {
      startPointer: pt,
      startPan: { ...pan },
      moved: false,
    };
    setIsPanning(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleCanvasPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (connectDragRef.current) {
      handleConnectPointerMove(e as unknown as ReactPointerEvent<SVGGElement>);
      return;
    }
    if (!panRef.current || !svgRef.current) return;
    const { startPointer, startPan } = panRef.current;
    const pt = getSvgCoordinates(e.clientX, e.clientY);
    const dx = pt.x - startPointer.x;
    const dy = pt.y - startPointer.y;
    if (!panRef.current.moved && Math.hypot(dx, dy) > 2) {
      panRef.current.moved = true;
    }
    if (panRef.current.moved) {
      setPan({
        x: startPan.x + dx,
        y: startPan.y + dy,
      });
    }
  };

  const handleCanvasPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (connectDragRef.current) {
      handleConnectPointerUp(e as unknown as ReactPointerEvent<SVGGElement>);
      return;
    }
    if (!panRef.current) return;
    panRef.current = null;
    setIsPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* Zoom & Pan toolbar */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#242424]/90 border border-border rounded-md px-1.5 py-1 shadow-md z-10 backdrop-blur-xs">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
          title="Zoom out"
          aria-label="Zoom out"
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Reset zoom and layout"
          aria-label="Reset zoom and layout"
          className="px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-secondary rounded cursor-pointer transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
          title="Zoom in"
          aria-label="Zoom in"
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Reset view and node positions"
          aria-label="Reset view and node positions"
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors border-l border-border/60 ml-0.5 pl-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${graph.width} ${graph.height}`}
        role="group"
        aria-label={`${process.name} process graph`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const landmarkId = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
          if (landmarkId && onDropLandmark) {
            const pt = getCanvasCoordinates(e.clientX, e.clientY);
            onDropLandmark(landmarkId, pt);
          }
        }}
        className={`w-full h-auto max-h-[36rem] rounded-sm border border-border bg-[#1c1c1c] shadow-inner select-none overflow-hidden ${
          connectingLine ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <defs>
          <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.75" />
          </pattern>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="context-stroke" />
          </marker>
        </defs>
        <rect width={graph.width} height={graph.height} fill={`url(#${gridId})`} />

        {activeNodes.length === 0 && (
          <text
            x={graph.width / 2}
            y={graph.height / 2}
            textAnchor="middle"
            fill="#737373"
            fontSize="13"
            fontFamily="monospace"
          >
            Drag elements from the list or add stages to start designing
          </text>
        )}

        <g
          ref={canvasGroupRef}
          transform={`translate(${pan.x}, ${pan.y}) translate(${graph.width / 2}, ${
            graph.height / 2
          }) scale(${zoom}) translate(${-graph.width / 2}, ${-graph.height / 2})`}
        >
          {activeEdges.map(({ stage, stageConnection, connection, path, labelX, labelY }) => {
            const value: ProcessGraphSelection = {
              type: 'connection',
              stageId: stage.id,
              stageConnectionId: stageConnection.id,
            };
            const selected =
              selection?.type === 'connection' &&
              selection.stageId === stage.id &&
              selection.stageConnectionId === stageConnection.id;
            const label = stageConnection.title || connection.name || connection.id;
            const stageName = stage.name || `Stage ${stage.order}`;
            const labelText = `${stageName} · ${label}`;
            const badgeWidth = Math.max(48, labelText.length * 6.5 + 14);

            return (
              <g
                key={`${stage.id}:${stageConnection.id}`}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={`${stageName}: ${label}, ${stageConnection.direction.toLowerCase()}`}
                aria-pressed={onSelect ? selected : undefined}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={() => onSelect?.(value)}
                onKeyDown={(event) => activate(event, value)}
                className={
                  onSelect
                    ? 'cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary'
                    : undefined
                }
              >
                <path d={path} fill="none" stroke="transparent" strokeWidth="20" />
                <path
                  d={path}
                  fill="none"
                  stroke={selected ? '#22d3ee' : '#737373'}
                  strokeWidth={selected ? 2.5 : 1.5}
                  markerStart={stageConnection.direction !== 'FORWARD' ? `url(#${markerId})` : undefined}
                  markerEnd={stageConnection.direction !== 'REVERSE' ? `url(#${markerId})` : undefined}
                />

                {/* Connection Title Badge (Click to edit) */}
                <g
                  role={onEditConnection ? 'button' : undefined}
                  tabIndex={onEditConnection ? 0 : undefined}
                  aria-label={`Edit connection ${label}`}
                  className={onEditConnection ? 'cursor-pointer select-none' : undefined}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    if (onEditConnection) {
                      e.stopPropagation();
                      onSelect?.(value);
                      onEditConnection(connection.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (onEditConnection && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect?.(value);
                      onEditConnection(connection.id);
                    }
                  }}
                >
                  <rect
                    x={labelX - badgeWidth / 2}
                    y={labelY - 17}
                    width={badgeWidth}
                    height="17"
                    rx="3"
                    fill="#181818"
                    stroke={selected ? '#22d3ee' : '#525252'}
                    strokeWidth={selected ? 1.5 : 1}
                  />
                  <text
                    x={labelX}
                    y={labelY - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill={selected ? '#22d3ee' : '#e5e5e5'}
                    fontFamily="monospace"
                    className="pointer-events-none select-none"
                  >
                    {labelText}
                  </text>
                </g>
              </g>
            );
          })}

          {/* In-flight connecting line during drag */}
          {connectingLine && (
            <path
              d={`M ${connectingLine.startX} ${connectingLine.startY} L ${connectingLine.currentX} ${connectingLine.currentY}`}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="6 4"
              markerEnd={`url(#${markerId})`}
              className="pointer-events-none"
            />
          )}

          {activeNodes.map(({ landmark, x, y }) => {
            const value: ProcessGraphSelection = { type: 'landmark', landmarkId: landmark.id };
            const selected = selection?.type === 'landmark' && selection.landmarkId === landmark.id;
            const isHoveredTarget = connectingLine?.hoveredTargetId === landmark.id;
            const isConnectSource = connectingLine?.sourceLandmarkId === landmark.id;
            const group = landmark.groupId ? groupsMap.get(landmark.groupId) : undefined;
            const groupColor = group?.color;
            const groupName = group?.name;
            const tagWidth = groupName ? Math.min(74, Math.max(22, groupName.length * 5.5 + 8)) : 0;

            return (
              <g
                key={landmark.id}
                role="button"
                tabIndex={0}
                aria-label={`Landmark: ${landmark.name}`}
                aria-pressed={selected}
                onPointerDown={(e) => handleNodePointerDown(e, landmark.id, x, y)}
                onPointerMove={handleNodePointerMove}
                onPointerUp={(e) => handleNodePointerUp(e, landmark.id)}
                onClick={() => {
                  if (!dragRef.current?.moved) {
                    onSelect?.(value);
                  }
                }}
                onKeyDown={(event) => activate(event, value)}
                className={`cursor-grab active:cursor-grabbing ${
                  onSelect
                    ? 'focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary'
                    : undefined
                }`}
              >
                {/* Main Card Rectangle */}
                <rect
                  x={x - 42}
                  y={y - 24}
                  width="84"
                  height="48"
                  rx="2"
                  fill={
                    isHoveredTarget
                      ? 'rgba(34, 211, 238, 0.35)'
                      : isConnectSource
                      ? 'rgba(34, 211, 238, 0.25)'
                      : selected
                      ? 'rgba(34, 211, 238, 0.15)'
                      : '#2a2a2a'
                  }
                  stroke={isHoveredTarget || isConnectSource || selected ? '#22d3ee' : (groupColor || '#525252')}
                  strokeWidth={isHoveredTarget ? 2.5 : selected || isConnectSource ? 2 : groupColor ? 1.5 : 1}
                />
                {/* Top Header Bar */}
                <line
                  x1={x - 42}
                  y1={y - 24}
                  x2={x + 42}
                  y2={y - 24}
                  stroke={isHoveredTarget || selected ? '#22d3ee' : (groupColor || '#737373')}
                  strokeWidth={selected || isHoveredTarget ? 2 : groupColor ? 1.5 : 1}
                />
                {/* Attached Group Tag */}
                {group && groupName && (
                  <g data-testid={`landmark-group-tag-${landmark.id}`}>
                    <rect
                      x={x - 37}
                      y={y - 19}
                      width={tagWidth}
                      height="11"
                      rx="2"
                      fill={groupColor ? `${groupColor}25` : 'rgba(255, 255, 255, 0.1)'}
                      stroke={groupColor || '#737373'}
                      strokeWidth="0.75"
                    />
                    <text
                      x={x - 37 + tagWidth / 2}
                      y={y - 10.5}
                      textAnchor="middle"
                      fontSize="7.5"
                      fontWeight="700"
                      fill={groupColor || '#e5e5e5'}
                      fontFamily="monospace"
                    >
                      {groupName.length > 11 ? `${groupName.slice(0, 10)}…` : groupName}
                    </text>
                  </g>
                )}
                {/* Landmark Name */}
                <text
                  x={x}
                  y={group ? y + 8 : y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={selected || isHoveredTarget ? '#22d3ee' : '#f5f5f5'}
                  fontFamily="monospace"
                >
                  {landmark.name.length > 12 ? `${landmark.name.slice(0, 11)}…` : landmark.name}
                </text>

                {/* Connection Handle (Drag-to-Connect Port) */}
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`Connect from ${landmark.name}`}
                  onPointerDown={(e) => handleConnectPointerDown(e, landmark.id, x + 42, y)}
                  onPointerMove={handleConnectPointerMove}
                  onPointerUp={handleConnectPointerUp}
                  className="cursor-crosshair"
                >
                  <circle
                    cx={x + 42}
                    cy={y}
                    r="8"
                    fill="transparent"
                  />
                  <circle
                    cx={x + 42}
                    cy={y}
                    r="5"
                    fill="#1c1c1c"
                    stroke="#22d3ee"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={x + 42}
                    cy={y}
                    r="2.5"
                    fill="#22d3ee"
                  />
                </g>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground px-1 select-none">
        <span>Drag elements to reposition · Drag canvas to pan · Drag ● handle to connect · Ctrl+Scroll to zoom</span>
      </div>

      {graph.missing.length > 0 && (
        <ul
          aria-label="Unavailable process references"
          className="mt-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-800/40 rounded-sm p-2.5 space-y-1"
        >
          {graph.missing.map(({ stage, stageConnection, reason }) => (
            <li key={`${stage.id}:${stageConnection.id}`}>
              {stage.name || `Stage ${stage.order}`}: {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
