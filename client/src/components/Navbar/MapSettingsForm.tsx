import { useState } from 'react';
import { Copy, Check, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { editMap, setCollaborationMode, exportMapJson, removeCollaborator } from '@/api/mapApi';
import type { CollaborationMode } from '@/types/session';
import { COLLABORATION_MODE_LABELS } from '@/types/session';

interface Props {
  onClose: () => void;
}

export function MapSettingsForm({ onClose }: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const updateMap = useMapStore((s) => s.updateMap);
  const userId = useAuthStore((s) => s.userId);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const [editName, setEditName] = useState(currentMap?.name ?? '');
  const [editDescription, setEditDescription] = useState(currentMap?.description ?? '');
  const [editCollaborationMode, setEditCollaborationMode] = useState<CollaborationMode>(currentMap?.collaborationMode ?? 'OPEN');
  const [editGameEnabled, setEditGameEnabled] = useState(currentMap?.gameEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState(false);
  const [removingCollaboratorId, setRemovingCollaboratorId] = useState<string | null>(null);
  const [removeCollabError, setRemoveCollabError] = useState('');

  if (!currentMap) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      let updated = await editMap(
        currentMap.id,
        editName || undefined,
        editDescription || undefined,
        editGameEnabled,
      );
      if (editCollaborationMode !== (currentMap.collaborationMode ?? 'OPEN')) {
        updated = await setCollaborationMode(currentMap.id, editCollaborationMode);
      }
      updateMap(updated);
      onClose();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentMap.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleExport = async () => {
    try {
      const data = await exportMapJson(currentMap.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${currentMap.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    setRemovingCollaboratorId(collaboratorId);
    setRemoveCollabError('');
    try {
      const updated = await removeCollaborator(currentMap.id, collaboratorId);
      updateMap(updated);
    } catch (err: unknown) {
      setRemoveCollabError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    } finally {
      setRemovingCollaboratorId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!isCollaborator && (
        <p className="text-sm text-muted-foreground">Map details (read-only for viewers).</p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="map-settings-name" className="text-sm">Name</Label>
        <Input
          id="map-settings-name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Unnamed Map"
          className="h-8 text-sm"
          readOnly={!isCollaborator}
          disabled={!isCollaborator}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="map-settings-description" className="text-sm">Description</Label>
        <Textarea
          id="map-settings-description"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description…"
          className="text-sm resize-none"
          rows={3}
          readOnly={!isCollaborator}
          disabled={!isCollaborator}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="map-settings-collab-mode" className="text-sm">Collaboration mode</Label>
        <select
          id="map-settings-collab-mode"
          value={editCollaborationMode}
          onChange={(e) => setEditCollaborationMode(e.target.value as CollaborationMode)}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isCollaborator}
        >
          {(Object.keys(COLLABORATION_MODE_LABELS) as CollaborationMode[]).map((m) => (
            <option key={m} value={m}>{COLLABORATION_MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={editGameEnabled}
          onChange={(e) => setEditGameEnabled(e.target.checked)}
          disabled={!isCollaborator}
          className="h-4 w-4 rounded border-input accent-primary disabled:opacity-50"
        />
        <span>Enable tower-defense game</span>
      </label>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm">Map ID</Label>
        <div className="flex items-center gap-1.5">
          <code className="flex-1 text-sm font-mono bg-muted rounded px-2 py-1.5 text-muted-foreground select-all truncate">
            {currentMap.id}
          </code>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopyId}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {isCollaborator && (
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="h-8 justify-start gap-2 px-2 text-sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export session JSON
          </Button>
        </div>
      )}
      {currentMap.collaborators.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm">Collaborators</Label>
          <div className="flex flex-col gap-1">
            {currentMap.collaborators.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <UserAvatar inline size="xs" username={c.username} avatarUrl={c.avatarUrl} className="flex-1 min-w-0" />
                {c.id === userId && <span className="text-sm text-muted-foreground shrink-0">(you)</span>}
                {isAdmin && c.id !== userId && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                    title={`Remove ${c.username} from session`}
                    disabled={removingCollaboratorId === c.id}
                    onClick={() => handleRemoveCollaborator(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {removeCollabError && <p className="text-sm text-destructive">{removeCollabError}</p>}
        </div>
      )}
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-sm" onClick={onClose} disabled={saving}>
          {isCollaborator ? 'Cancel' : 'Close'}
        </Button>
        {isCollaborator && (
          <Button size="sm" className="h-8 text-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  );
}
