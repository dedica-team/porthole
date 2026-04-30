import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import type { MapState, ChoreList } from '../types/map';
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
  const updateMapRef = useRef(updateMap);
  const setChoreListsRef = useRef(setChoreLists);
  useEffect(() => { updateMapRef.current = updateMap; }, [updateMap]);
  useEffect(() => { setChoreListsRef.current = setChoreLists; }, [setChoreLists]);

  useEffect(() => {
    if (!mapId) return;

    const wsUrl = buildWsUrl();

    const client = new Client({
      brokerURL: wsUrl,
      onConnect: () => {
        client.subscribe(`/topic/map/${mapId}`, (message) => {
          try {
            const payload = JSON.parse(message.body) as MapState & { choreLists?: Record<string, ChoreList> };
            if (payload.choreLists) {
              setChoreListsRef.current(Object.values(payload.choreLists));
            }
            updateMapRef.current(payload);
          } catch {
            console.error('Failed to parse map update', message.body);
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

