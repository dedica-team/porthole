// Process / X-Ray types

export type StageConnectionDirection = 'FORWARD' | 'REVERSE' | 'BIDIRECTIONAL';

export interface StageConnection {
  id: string;
  connectionId: string;
  title?: string;
  direction: StageConnectionDirection;
}

export interface ProcessStage {
  id: string;
  name?: string;
  order: number;
  connections: StageConnection[];
}

export interface Process {
  id: string;
  name: string;
  description?: string;
  stages: ProcessStage[];
}

