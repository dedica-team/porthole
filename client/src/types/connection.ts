// Connection types
import type { HexCoordinate } from './hex';

export type ConnectionType = 'PIPE' | 'TELEGRAPH' | 'STREET' | 'ARROW';

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  PIPE:      '🔧 Pipe',
  TELEGRAPH: '📡 Telegraph',
  STREET:    '🛣️ Street',
  ARROW:     '➡️ Arrow',
};

export const ALL_CONNECTION_TYPES: ConnectionType[] = Object.keys(CONNECTION_TYPE_LABELS) as ConnectionType[];

export interface Connection {
  id: string;
  originId: string;
  targetId: string;
  path: HexCoordinate[];
  type: ConnectionType;
  name?: string;
  description?: string;
}

