import { useState, useRef } from 'react';
import { ExternalLink, Check, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { StatusBadge, choreStateToStatus } from '@/components/ui/status-badge';
import type {ChoreEntry, ChoreEntryState, ChoreList} from '@/types/chores';
import type { Collaborator } from '@/types/session';
import { CHORE_ENTRY_STATE_LABEL, CHORE_ENTRY_STATES } from '@/types/chores';
import { updateChoreEntry } from '@/api/mapApi';

interface Props {
  mapId: string;
  listId: string;
  entry: ChoreEntry;
  landmarkName: string;
  collaborators: Collaborator[];
  isCollaborator: boolean;
  onUpdated: (updated: ChoreList) => void;
  groupStripe?: { color: string; label: string; rowSpan: number };
}

export default function ChoreEntryRow({ mapId, listId, entry, landmarkName, collaborators, isCollaborator, onUpdated, groupStripe }: Props) {
  const [open, setOpen] = useState(false);
  const [draftState, setDraftState] = useState<ChoreEntryState>(entry.state);
  const [draftAssigneeId, setDraftAssigneeId] = useState<string>(entry.assigneeId ?? '');
  const [draftLink, setDraftLink] = useState(entry.link ?? '');
  const [draftNote, setDraftNote] = useState(entry.note ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset drafts when popover opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setDraftState(entry.state);
      setDraftAssigneeId(entry.assigneeId ?? '');
      setDraftLink(entry.link ?? '');
      setDraftNote(entry.note ?? '');
    }
    setOpen(v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateChoreEntry(mapId, listId, entry.landmarkId, {
        state: draftState,
        assigneeId: draftAssigneeId || undefined,
        clearAssignee: !draftAssigneeId,
        link: draftLink.trim() || undefined,
        clearLink: !draftLink.trim(),
        note: draftNote.trim() || undefined,
        clearNote: !draftNote.trim(),
      });
      onUpdated(updated);
      setOpen(false);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const assignee = collaborators.find((c) => c.id === entry.assigneeId);
  const tdClass = 'px-4 py-2.5 border-b border-border align-middle';

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      {/* Group colour stripe */}
      {groupStripe && (
        <td
          rowSpan={groupStripe.rowSpan}
          className="w-4 p-0 sticky left-0 z-10 select-none"
          style={{ backgroundColor: `color-mix(in srgb, ${groupStripe.color} 40%, black)`, minWidth: '1rem', width: '1rem' }}
        >
          <div className="flex items-center justify-center" style={{ height: `${groupStripe.rowSpan * 2.5}rem`, minHeight: '2rem' }}>
            <span
              className="text-sm font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: `color-mix(in srgb, ${groupStripe.color} 25%, #fff)`, maxHeight: '8rem', textOverflow: 'ellipsis' }}
            >
              {groupStripe.label}
            </span>
          </div>
        </td>
      )}

      {/* Landmark name + saved flash + edit trigger */}
      <td className={`${tdClass} font-medium text-foreground`}>
        <div className="flex items-center gap-1.5">
          {saved && <Check className="h-3 w-3 text-success shrink-0" />}
          {isCollaborator && (
            <Popover open={open} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-left truncate text-foreground hover:text-foreground/80 transition-colors cursor-pointer group/title" title="Edit entry">
                  <span className="truncate">{landmarkName}</span>
                  <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start" side="right">
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-foreground truncate">{landmarkName}</p>

                  {/* State */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm text-muted-foreground uppercase tracking-wide">State</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CHORE_ENTRY_STATES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDraftState(s)}
                          className={`transition-opacity cursor-pointer ${draftState === s ? '' : 'opacity-40 hover:opacity-70'}`}
                        >
                          <StatusBadge status={choreStateToStatus[s]} className="text-sm font-medium">
                            {CHORE_ENTRY_STATE_LABEL[s]}
                          </StatusBadge>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm text-muted-foreground uppercase tracking-wide">Assignee</Label>
                    <select
                      value={draftAssigneeId}
                      onChange={(e) => setDraftAssigneeId(e.target.value)}
                      className="h-7 text-sm px-2 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Unassigned</option>
                      {collaborators.map((c) => (
                        <option key={c.id} value={c.id}>{c.username}</option>
                      ))}
                    </select>
                  </div>

                  {/* Link */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm text-muted-foreground uppercase tracking-wide">Link</Label>
                    <Input
                      value={draftLink}
                      onChange={(e) => setDraftLink(e.target.value)}
                      placeholder="https://…"
                      className="h-7 text-sm px-2"
                      type="url"
                    />
                  </div>

                  {/* Note */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm text-muted-foreground uppercase tracking-wide">Note</Label>
                    <Textarea
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      placeholder="Note…"
                      className="text-sm resize-none"
                      maxLength={280}
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="flat" size="sm" className="h-7 text-sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                    <Button size="sm" className="h-7 text-sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {!isCollaborator && <span className="truncate">{landmarkName}</span>}
        </div>
      </td>

      {/* State badge (read-only display) */}
      <td className={tdClass}>
        <StatusBadge status={choreStateToStatus[entry.state]} className="text-sm font-medium">
          {CHORE_ENTRY_STATE_LABEL[entry.state]}
        </StatusBadge>
      </td>

      {/* Assignee (read-only display) */}
      <td className={tdClass}>
        {assignee ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar className="h-4 w-4 shrink-0">
              {assignee.avatarUrl && <AvatarImage src={assignee.avatarUrl} alt={assignee.username} />}
              <AvatarFallback className="text-sm bg-secondary">{assignee.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm text-foreground">{assignee.username}</span>
          </div>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      {/* Details: link + note (read-only display) */}
      <td className={tdClass}>
        <div className="flex flex-col gap-1 min-w-0">
          {entry.link && (
            <a href={entry.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[hsl(185,100%,54%)] hover:underline truncate">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{entry.link}</span>
            </a>
          )}
          {entry.note && (
            <span className="text-sm text-muted-foreground">{entry.note}</span>
          )}
          {!entry.link && !entry.note && <span className="text-muted-foreground/40">—</span>}
        </div>
      </td>
    </tr>
  );
}
