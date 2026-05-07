import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import type { SessionState } from '../types/session';
import type { ChoreList } from '../types/chores';
import type { CollaboratorMatrix } from '../types/matrix';
import type { GreenkeepingRotation } from '../types/greenkeeping';
import type { QualityMetric } from '../types/landmark';
import { useMapStore } from '../store/mapStore';
import { getMap, fetchMetrics, fetchChoreLists, fetchCollaboratorMatrix, fetchGreenkeepingRotations } from '../api/mapApi';

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
  const setGreenkeepingRotations = useMapStore((s) => s.setGreenkeepingRotations);
  const setGreenkeepingRotationsFetched = useMapStore((s) => s.setGreenkeepingRotationsFetched);
  const setCollaboratorMatrix = useMapStore((s) => s.setCollaboratorMatrix);
  const setMetrics = useMapStore((s) => s.setMetrics);
  const updateMapRef = useRef(updateMap);
  const setCurrentMapRef = useRef(setCurrentMap);
  const setChoreListsRef = useRef(setChoreLists);
  const setChoreListsFetchedRef = useRef(setChoreListsFetched);
  const setGreenkeepingRotationsRef = useRef(setGreenkeepingRotations);
  const setGreenkeepingRotationsFetchedRef = useRef(setGreenkeepingRotationsFetched);
  const setCollaboratorMatrixRef = useRef(setCollaboratorMatrix);
  const setMetricsRef = useRef(setMetrics);
  useEffect(() => { updateMapRef.current = updateMap; }, [updateMap]);
  useEffect(() => { setCurrentMapRef.current = setCurrentMap; }, [setCurrentMap]);
  useEffect(() => { setChoreListsRef.current = setChoreLists; }, [setChoreLists]);
  useEffect(() => { setChoreListsFetchedRef.current = setChoreListsFetched; }, [setChoreListsFetched]);
  useEffect(() => { setGreenkeepingRotationsRef.current = setGreenkeepingRotations; }, [setGreenkeepingRotations]);
  useEffect(() => { setGreenkeepingRotationsFetchedRef.current = setGreenkeepingRotationsFetched; }, [setGreenkeepingRotationsFetched]);
  useEffect(() => { setCollaboratorMatrixRef.current = setCollaboratorMatrix; }, [setCollaboratorMatrix]);
  useEffect(() => { setMetricsRef.current = setMetrics; }, [setMetrics]);

  useEffect(() => {
    if (!mapId) return;

    let cancelled = false;
    const currentMapId = useMapStore.getState().currentMap?.id;

    const runIfPromise = <T>(
      request: Promise<T> | undefined,
      onSuccess: (value: T) => void,
    ) => {
      if (!request || typeof request.then !== 'function') return;
      request.then((value) => {
        if (!cancelled) onSuccess(value);
      }).catch(() => { /* ignore – WS broadcast will update */ });
    };

    const hydrateAuxiliarySlices = () => {
      runIfPromise(fetchMetrics(mapId), (metrics) => {
        setMetricsRef.current(metrics);
      });
      runIfPromise(fetchCollaboratorMatrix(mapId), (matrix) => {
        setCollaboratorMatrixRef.current(matrix);
      });
      runIfPromise(fetchChoreLists(mapId), (lists) => {
          setChoreListsRef.current(lists);
          setChoreListsFetchedRef.current(true);
      });
      runIfPromise(fetchGreenkeepingRotations(mapId), (rotations) => {
        setGreenkeepingRotationsRef.current(rotations);
        setGreenkeepingRotationsFetchedRef.current(true);
      });
    };

    if (currentMapId === mapId) {
      hydrateAuxiliarySlices();
    } else {
      getMap(mapId).then((map) => {
        if (cancelled) return;
        setCurrentMapRef.current(map);
        hydrateAuxiliarySlices();
      }).catch(() => { /* WS updates will follow */ });
    }

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
        client.subscribe(`/topic/map/${mapId}/greenkeeping-rotations`, (message) => {
          try {
            const rotations = JSON.parse(message.body) as Record<string, GreenkeepingRotation>;
            setGreenkeepingRotationsRef.current(Object.values(rotations));
          } catch {
            console.error('Failed to parse greenkeeping rotations update', message.body);
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
      cancelled = true;
      client.deactivate();
      clientRef.current = null;
    };
  }, [mapId]);
}
