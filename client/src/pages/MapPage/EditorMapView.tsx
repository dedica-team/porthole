/**
 * EditorMapView
 *
 * Activates editor mode on mount and deactivates it on unmount, then renders
 * the regular map canvas. This keeps RegularMapView free of route awareness
 * while giving the /editor sub-route its own component.
 */
import { useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';
import RegularMapView from './RegularMapView';

export default function EditorMapView() {
  const setEditorMode = useMapStore((s) => s.setEditorMode);

  useEffect(() => {
    setEditorMode(true);
    return () => setEditorMode(false);
  }, [setEditorMode]);

  return <RegularMapView />;
}
