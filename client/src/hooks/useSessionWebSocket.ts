import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import type { SessionState } from '../types/session';
import type { ChoreList } from '../types/chores';
import type { CollaboratorMatrix } from '../types/matrix';
import type { QualityMetric } from '../types/landmark';
import { useMapStore } from '../store/mapStore';
import { getMap, fetchMetrics, fetchChoreLists, fetchCollaboratorMatrix } from '../api/mapApi';

function buildWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsBase = import.meta.env.VITE_PORTHOLE_WS_URL as string | undefined;
  if (wsBase) return wsBase;
  return `${proto}://${window.location.host}/ws-native`;
}

export function useSessionWebSocket(mapId: string | undefined) {
  const clientRef   = useRef<Client | null>(null);
  const updateMap   = useMapStore((s) => s.updateMap);
  const setCurrentMap = useMapStore((s) => s.setCurrentMap);
  const setChoreLists = useMapStore((s) => s.setChoreLists);
  const setChoreListsFetched = useMapStore((s) => s.setChoreListsFetched);
  const setCollaboratorMatrix = useMapStore((s) => s.setCollaboratorMatrix);
  const setMetrics = useMapStore((s) => s.setMetrics);
  const updateMapRef = useRef(updateMap);
  const setCurrentMapRef = useRef(setCurrentMap);
  const setChoreListsRef = useRef(setChoreLists);
  const setChoreListsFetchedRef = useRef(setChoreListsFetched);
  const setCollaboratorMatrixRef = useRef(setCollaboratorMatrix);
  const setMetricsRef = useRef(setMetrics);
  useEffect(() => { updateMapRef.current = updateMap; }, [updateMap]);
  useEffect(() => { setCurrentMapRef.current = setCurrentMap; }, [setCurrentMap]);
  useEffect(() => { setChoreListsRef.current = setChoreLists; }, [setChoreLists]);
  useEffect(() => { setChoreListsFetchedRef.current = setChoreListsFetched; }, [setChoreListsFetched]);
  useEffect(() => { setCollaboratorMatrixRef.current = setCollaboratorMatrix; }, [setCollaboratorMatrix]);
  useEffect(() => { setMetricsRef.current = setMetrics; }, [setMetrics]);

  useEffect(() => {
    if (!mapId) return;

    const wsUrl = buildWsUrl();

    const client = new Client({
      brokerURL: wsUrl,
      onConnect: () => {
        // ── Hydrate all store slices from dedicated endpoints on (re-)connect ─
        // Each slice is fetched independently so that the full map payload is not
        // required to carry choreLists / metrics / collaboratorMatrix.
        // Load map first (setCurrentMap resets metrics/matrix/choreLists),
        // then fetch the dedicated slices so they are not cleared afterwards.
        getMap(mapId).then((map) => {
          setCurrentMapRef.current(map);
          fetchMetrics(mapId).then((metrics) => {
            setMetricsRef.current(metrics);
          }).catch(() => { /* ignore – WS broadcast will update */ });
          fetchCollaboratorMatrix(mapId).then((matrix) => {
            setCollaboratorMatrixRef.current(matrix);
          }).catch(() => { /* ignore – WS broadcast will update */ });
          fetchChoreLists(mapId).then((lists) => {
            setChoreListsRef.current(lists);
            setChoreListsFetchedRef.current(true);
          }).catch(() => { /* ignore – WS broadcast will update */ });
        }).catch(() => { /* WS updates will follow */ });

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
