import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import type { SessionState } from '../types/session';
import type { ChoreList } from '../types/chores';
import type { CollaboratorMatrix } from '../types/matrix';
import type { QualityMetric } from '../types/landmark';
import { useMapStore } from '../store/mapStore';

function buildWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsBase = import.meta.env.VITE_PORTHOLE_WS_URL as string | undefined;
  if (wsBase) return wsBase;
  return `${proto}://${window.location.host}/ws-native`;
}

export function useMapWebSocket(mapId: string | undefined) {
  const clientRef   = useRef<Client | null>(null);
  const updateMap   = useMapStore((s) => s.updateMap);
  const setChoreLists = useMapStore((s) => s.setChoreLists);
  const setCollaboratorMatrix = useMapStore((s) => s.setCollaboratorMatrix);
  const setMetrics = useMapStore((s) => s.setMetrics);
  const updateMapRef = useRef(updateMap);
  const setChoreListsRef = useRef(setChoreLists);
  const setCollaboratorMatrixRef = useRef(setCollaboratorMatrix);
  const setMetricsRef = useRef(setMetrics);
  useEffect(() => { updateMapRef.current = updateMap; }, [updateMap]);
  useEffect(() => { setChoreListsRef.current = setChoreLists; }, [setChoreLists]);
  useEffect(() => { setCollaboratorMatrixRef.current = setCollaboratorMatrix; }, [setCollaboratorMatrix]);
  useEffect(() => { setMetricsRef.current = setMetrics; }, [setMetrics]);

  useEffect(() => {
    if (!mapId) return;

    const wsUrl = buildWsUrl();

    const client = new Client({
      brokerURL: wsUrl,
      onConnect: () => {
        client.subscribe(`/topic/map/${mapId}`, (message) => {
          try {
            const payload = JSON.parse(message.body) as SessionState;
            updateMapRef.current(payload);
          } catch {
            console.error('Failed to parse map update', message.body);
          }
        });
        client.subscribe(`/topic/map/${mapId}/metrics`, (message) => {
          try {
            const metrics = JSON.parse(message.body) as Record<string, QualityMetric>;
            setMetricsRef.current(metrics);
          } catch {
            console.error('Failed to parse metrics update', message.body);
          }
        });
        client.subscribe(`/topic/map/${mapId}/chore-lists`, (message) => {
          try {
            const choreLists = JSON.parse(message.body) as Record<string, ChoreList>;
            setChoreListsRef.current(Object.values(choreLists));
          } catch {
            console.error('Failed to parse chore-lists update', message.body);
          }
        });
        client.subscribe(`/topic/map/${mapId}/matrix`, (message) => {
          try {
            const matrix = JSON.parse(message.body) as CollaboratorMatrix;
            setCollaboratorMatrixRef.current(matrix);
          } catch {
            console.error('Failed to parse matrix update', message.body);
          }
        });
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [mapId]);
}

