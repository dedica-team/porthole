import type { Connection } from '@/types/connection';
import type { Landmark } from '@/types/landmark';
import type { Process, ProcessStage, StageConnection } from '@/types/process';

export interface ProcessGraphNode {
  landmark: Landmark;
  x: number;
  y: number;
}

export interface ProcessGraphEdge {
  stage: ProcessStage;
  stageConnection: StageConnection;
  connection: Connection;
  path: string;
  labelX: number;
  labelY: number;
}

export interface ResolvedStageConnection {
  stage: ProcessStage;
  stageConnection: StageConnection;
  connection: Connection;
}

export interface ProcessGraphProjection {
  nodes: ProcessGraphNode[];
  edges: ProcessGraphEdge[];
  missing: { stage: ProcessStage; stageConnection: StageConnection; reason: string }[];
  resolved: ResolvedStageConnection[];
  width: number;
  height: number;
}

/** Computes the point on the rectangle boundary of a card (half-width halfW, half-height halfH) in the direction of (toX, toY). */
export function getRectIntersection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  halfW = 42,
  halfH = 24
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return { x: fromX, y: fromY };
  const scale = Math.min(halfW / Math.abs(dx || 0.0001), halfH / Math.abs(dy || 0.0001));
  return { x: fromX + dx * scale, y: fromY + dy * scale };
}

/** Computes curved bezier paths and label coordinates for edges given node positions. */
export function computeProcessGraphEdges(
  resolved: ResolvedStageConnection[],
  nodePositions: Map<string, { x: number; y: number }>
): ProcessGraphEdge[] {
  const groups = new Map<string, ResolvedStageConnection[]>();
  for (const edge of resolved) {
    const key = JSON.stringify([edge.connection.originId, edge.connection.targetId].sort());
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }

  const edges: ProcessGraphEdge[] = [];
  for (const group of groups.values()) {
    group.forEach((edge, index) => {
      const source = nodePositions.get(edge.connection.originId);
      const target = nodePositions.get(edge.connection.targetId);
      if (!source || !target) return;

      if (edge.connection.originId === edge.connection.targetId) {
        const r = 60 + index * 20;
        edges.push({
          ...edge,
          path: `M ${source.x - 32} ${source.y - 24} C ${source.x - r} ${source.y - r * 2}, ${source.x + r} ${source.y - r * 2}, ${source.x + 32} ${source.y - 24}`,
          labelX: source.x,
          labelY: source.y - r * 1.5,
        });
      } else {
        const sign = edge.connection.originId < edge.connection.targetId ? 1 : -1;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.hypot(dx, dy) || 1;
        const offset = (index - (group.length - 1) / 2) * 50;
        const cx = (source.x + target.x) / 2 - (dy / length) * offset * sign;
        const cy = (source.y + target.y) / 2 + (dx / length) * offset * sign;

        const start = getRectIntersection(source.x, source.y, cx, cy);
        const end = getRectIntersection(target.x, target.y, cx, cy);

        edges.push({
          ...edge,
          path: `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`,
          labelX: (start.x + 2 * cx + end.x) / 4,
          labelY: (start.y + 2 * cy + end.y) / 4,
        });
      }
    });
  }

  return edges;
}

/**
 * Projects the process graph top-down beginning with the first stage.
 * In each stage, connection origin elements are placed and painted first.
 */
export function projectProcessGraph(
  process: Process,
  landmarks: Landmark[],
  connections: Connection[],
  extraLandmarkIds?: string[]
): ProcessGraphProjection {
  const landmarksById = new Map(landmarks.map((l) => [l.id, l]));
  const connectionsById = new Map(connections.map((c) => [c.id, c]));
  const missing: ProcessGraphProjection['missing'] = [];
  const resolved: ResolvedStageConnection[] = [];
  const nodeIds = new Set<string>();

  if (extraLandmarkIds) {
    for (const id of extraLandmarkIds) {
      if (landmarksById.has(id)) {
        nodeIds.add(id);
      }
    }
  }

  const stages = [...process.stages].sort((a, b) => a.order - b.order);
  for (const stage of stages) {
    for (const stageConnection of stage.connections) {
      const connection = connectionsById.get(stageConnection.connectionId);
      if (!connection) {
        missing.push({ stage, stageConnection, reason: `Missing connection: ${stageConnection.connectionId}` });
      } else if (!landmarksById.has(connection.originId) || !landmarksById.has(connection.targetId)) {
        missing.push({ stage, stageConnection, reason: `Missing landmark for connection: ${connection.id}` });
      } else {
        resolved.push({ stage, stageConnection, connection });
        nodeIds.add(connection.originId);
        nodeIds.add(connection.targetId);
      }
    }
  }

  if (nodeIds.size === 0) {
    return { nodes: [], edges: [], missing, resolved: [], width: 600, height: 400 };
  }

  // Top-down layout:
  // Iterate through stages in order. In each stage, place connection origins first, then targets.
  const assignedRow = new Map<string, number>();
  const orderedNodeIds: string[] = [];
  let currentRow = 0;

  for (const stage of stages) {
    const stageConns = resolved.filter((r) => r.stage.id === stage.id);
    const stageOrigins: string[] = [];
    const stageTargets: string[] = [];

    for (const { stageConnection, connection } of stageConns) {
      const origId = stageConnection.direction === 'REVERSE' ? connection.targetId : connection.originId;
      const targetId = stageConnection.direction === 'REVERSE' ? connection.originId : connection.targetId;
      if (!stageOrigins.includes(origId)) stageOrigins.push(origId);
      if (!stageTargets.includes(targetId)) stageTargets.push(targetId);
    }

    // 1. Process unplaced origins in this stage first
    for (const origId of stageOrigins) {
      if (!assignedRow.has(origId)) {
        assignedRow.set(origId, currentRow);
        orderedNodeIds.push(origId);
      }
    }

    // 2. Process unplaced targets in this stage
    for (const targetId of stageTargets) {
      if (!assignedRow.has(targetId)) {
        const originRows = stageConns
          .filter((r) => {
            const t = r.stageConnection.direction === 'REVERSE' ? r.connection.originId : r.connection.targetId;
            return t === targetId;
          })
          .map((r) => {
            const o = r.stageConnection.direction === 'REVERSE' ? r.connection.targetId : r.connection.originId;
            return assignedRow.get(o) ?? currentRow;
          });
        const minRow = originRows.length > 0 ? Math.max(...originRows) + 1 : currentRow + 1;
        assignedRow.set(targetId, minRow);
        orderedNodeIds.push(targetId);
      }
    }

    const rowsUsed = Array.from(assignedRow.values());
    if (rowsUsed.length > 0) {
      currentRow = Math.max(currentRow, ...rowsUsed) + 1;
    }
  }

  // Add any remaining resolved nodes not yet placed
  for (const id of nodeIds) {
    if (!assignedRow.has(id)) {
      assignedRow.set(id, currentRow);
      orderedNodeIds.push(id);
    }
  }

  // Normalize row indices to contiguous levels (0, 1, 2, ...)
  const uniqueRows = Array.from(new Set(assignedRow.values())).sort((a, b) => a - b);
  const rowLevelMap = new Map(uniqueRows.map((r, idx) => [r, idx]));

  const levels = new Map<number, string[]>();
  for (const id of orderedNodeIds) {
    const level = rowLevelMap.get(assignedRow.get(id)!)!;
    levels.set(level, [...(levels.get(level) ?? []), id]);
  }

  const numLevels = uniqueRows.length || 1;
  const maxNodesInLevel = Math.max(...Array.from(levels.values()).map((ids) => ids.length), 1);
  const spacingX = 160;
  const spacingY = 130;
  const width = Math.max(680, maxNodesInLevel * spacingX + 220);
  const height = Math.max(420, (numLevels + 1) * spacingY);
  const offsetY = (height - (numLevels - 1) * spacingY) / 2;
  const centerX = width / 2;

  const nodes: ProcessGraphNode[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  for (let l = 0; l < numLevels; l++) {
    const levelNodes = levels.get(l) ?? [];
    const count = levelNodes.length;
    const y = offsetY + l * spacingY;
    for (let i = 0; i < count; i++) {
      const id = levelNodes[i];
      const x = centerX + (i - (count - 1) / 2) * spacingX;
      const landmark = landmarksById.get(id)!;
      const node = { landmark, x, y };
      nodes.push(node);
      nodePositions.set(id, { x, y });
    }
  }

  const edges = computeProcessGraphEdges(resolved, nodePositions);

  return { nodes, edges, missing, resolved, width, height };
}
