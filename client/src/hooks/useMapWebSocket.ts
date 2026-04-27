import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import type { MapState } from '../types/map';
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
  // Keep a stable ref so the WebSocket effect never restarts due to a new
  // function reference from Zustand.
  const updateMapRef = useRef(updateMap);
  useEffect(() => { updateMapRef.current = updateMap; }, [updateMap]);

  useEffect(() => {
    if (!mapId) return;

    const wsUrl = buildWsUrl();

    const client = new Client({
      brokerURL: wsUrl,
      onConnect: () => {
        client.subscribe(`/topic/map/${mapId}`, (message) => {
          try {
            const mapState: MapState = JSON.parse(message.body);
            updateMapRef.current(mapState);
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
  }, [mapId]); // updateMap intentionally excluded – accessed via stable ref
}

