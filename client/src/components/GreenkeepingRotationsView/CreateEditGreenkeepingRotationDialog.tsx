import {useEffect, useMemo, useState} from 'react';
import {ArrowDown, ArrowUp, Plus, Trash2, X} from 'lucide-react';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Label} from '@/components/ui/label';
import {createGreenkeepingRotation, deleteGreenkeepingRotation, editGreenkeepingRotation} from '@/api/mapApi';
import {useMapStore} from '@/store/mapStore';
import type {
    GreenkeepingRotation,
    GreenkeepingRotationCollaboratorPatch,
} from '@/types/greenkeeping';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rotation?: GreenkeepingRotation | null;
    onSaved: (rotations: GreenkeepingRotation[]) => void;
    onDeleted?: (rotationId: string) => void;
}

function isValidUrl(value: string): boolean {
    if (!value) return true;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export default function CreateEditGreenkeepingRotationDialog({
                                                                 open,
                                                                 onOpenChange,
                                                                 rotation,
                                                                 onSaved,
                                                                 onDeleted
                                                             }: Props) {
    const currentMap = useMapStore((s) => s.currentMap);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
    const [collaboratorRows, setCollaboratorRows] = useState<GreenkeepingRotationCollaboratorPatch[]>([]);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setName(rotation?.name ?? '');
        setDescription(rotation?.description ?? '');
        setLink(rotation?.link ?? '');
        setSelectedGroupIds(new Set(rotation?.groupIds ?? []));
        setCollaboratorRows(rotation?.collaborators.map((entry) => ({
            id: entry.id,
            collaboratorId: entry.collaboratorId,
            done: entry.done,
        })) ?? []);
        setConfirmDelete(false);
        setError('');
    }, [open, rotation]);

    const sortedGroups = useMemo(
        () => Object.values(currentMap?.groups ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
        [currentMap?.groups],
    );
    const sortedCollaborators = useMemo(
        () => [...(currentMap?.collaborators ?? [])].sort((a, b) => a.username.localeCompare(b.username)),
        [currentMap?.collaborators],
    );

    if (!currentMap) return null;

    const toggleGroup = (groupId: string) => {
        const next = new Set(selectedGroupIds);
        if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
        setSelectedGroupIds(next);
    };

    const updateRow = (index: number, collaboratorId: string) => {
        setCollaboratorRows((rows) => rows.map((row, rowIndex) => {
            if (rowIndex !== index) return row;
            const changedCollaborator = row.collaboratorId !== collaboratorId;
            return {
                id: changedCollaborator ? undefined : row.id,
                collaboratorId,
                done: changedCollaborator ? false : row.done,
            };
        }));
    };

    const moveRow = (index: number, direction: -1 | 1) => {
        setCollaboratorRows((rows) => {
            const target = index + direction;
            if (target < 0 || target >= rows.length) return rows;
            const next = [...rows];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        const trimmedLink = link.trim();
        const normalizedRows = collaboratorRows.filter((row) => row.collaboratorId);
        const collaboratorIds = normalizedRows.map((row) => row.collaboratorId);

        if (!trimmedName) {
            setError('Name must not be blank.');
            return;
        }
        if (selectedGroupIds.size === 0) {
            setError('Select at least one group.');
            return;
        }
        if (normalizedRows.length === 0) {
            setError('Add at least one collaborator.');
            return;
        }
        if (new Set(collaboratorIds).size !== collaboratorIds.length) {
            setError('A collaborator can only appear once in a rotation.');
            return;
        }
        if (trimmedLink && !isValidUrl(trimmedLink)) {
            setError('Link must be a valid http/https URL.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            const rotations = rotation
                ? await editGreenkeepingRotation(currentMap.id, rotation.id, {
                    name: trimmedName,
                    description: trimmedDescription || null,
                    clearDescription: !trimmedDescription,
                    link: trimmedLink || null,
                    clearLink: !trimmedLink,
                    groupIds: [...selectedGroupIds],
                    collaborators: normalizedRows,
                })
                : await createGreenkeepingRotation(currentMap.id, {
                    name: trimmedName,
                    description: trimmedDescription || undefined,
                    link: trimmedLink || undefined,
                    groupIds: [...selectedGroupIds],
                    collaborators: normalizedRows,
                });
            onSaved(rotations);
            onOpenChange(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save rotation.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!rotation) return;
        setSaving(true);
        setError('');
        try {
            await deleteGreenkeepingRotation(currentMap.id, rotation.id);
            onDeleted?.(rotation.id);
            onOpenChange(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to delete rotation.');
        } finally {
            setSaving(false);
            setConfirmDelete(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!saving) onOpenChange(next);
        }}>
            <DialogContent className="max-w-sm max-h-[85vh] flex flex-col overflow-hidden" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="text-sm">{rotation ? 'Edit Rotation' : 'New Rotation'}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rotation-name" className="text-sm">Name</Label>
                        <Input id="rotation-name" value={name} onChange={(e) => setName(e.target.value)}
                               className="h-8 text-sm" autoFocus/>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rotation-description" className="text-sm">Description <span
                            className="text-muted-foreground">(optional)</span></Label>
                        <Textarea id="rotation-description" value={description}
                                  onChange={(e) => setDescription(e.target.value)}
                                  className="text-sm min-h-20 resize-none"/>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rotation-link" className="text-sm">Link <span
                            className="text-muted-foreground">(optional)</span></Label>
                        <Input id="rotation-link" value={link} onChange={(e) => setLink(e.target.value)}
                               className="h-8 text-sm" placeholder="https://…" type="url"/>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm">Groups</Label>
                        <div
                            className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-md border border-input bg-background p-2">
                            {sortedGroups.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-1">No groups exist yet.</p>
                            ) : sortedGroups.map((group) => (
                                <label key={group.id}
                                       className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedGroupIds.has(group.id)}
                                        onChange={() => toggleGroup(group.id)}
                                        className="accent-[hsl(var(--primary))]"
                                    />
                                    <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                          style={{backgroundColor: group.color}}/>
                                    <span className="truncate text-foreground">{group.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm">Collaborators</Label>
                            <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-sm gap-1"
                                onClick={() => setCollaboratorRows((rows) => [...rows, {collaboratorId: ''}])}
                            >
                                <Plus className="h-3 w-3"/>
                                Add
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2 rounded-md border border-input bg-background p-2">
                            {collaboratorRows.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-1">No collaborators added yet.</p>
                            ) : collaboratorRows.map((row, index) => {
                                const selectedIds = collaboratorRows.map((item, itemIndex) => itemIndex === index ? null : item.collaboratorId).filter(Boolean);
                                return (
                                    <div key={row.id ?? `new-${index}`}
                                         className="flex items-center gap-1.5 rounded border border-border p-2">
                                        <span
                                            className="text-sm text-muted-foreground w-5 text-center">{index + 1}</span>
                                        <select
                                            value={row.collaboratorId}
                                            onChange={(e) => updateRow(index, e.target.value)}
                                            className="h-8 text-sm rounded border border-input bg-background px-2 text-foreground flex-1 w-6"
                                        >
                                            <option value="">Select collaborator…</option>
                                            {sortedCollaborators.map((collaborator) => (
                                                <option
                                                    key={collaborator.id}
                                                    value={collaborator.id}
                                                    disabled={selectedIds.includes(collaborator.id)}
                                                >
                                                    {collaborator.username}
                                                </option>
                                            ))}
                                        </select>
                                        <Button type="button" size="icon" className="h-8"
                                                onClick={() => moveRow(index, -1)} disabled={index === 0}
                                                title="Move up">
                                            <ArrowUp className="h-3.5 w-3.5"/>
                                        </Button>
                                        <Button type="button" size="icon"  className="h-8"
                                                onClick={() => moveRow(index, 1)}
                                                disabled={index === collaboratorRows.length - 1} title="Move down">
                                            <ArrowDown className="h-3.5 w-3.5"/>
                                        </Button>
                                        <Button type="button" size="icon"
                                                className="h-8  text-muted-foreground hover:text-destructive"
                                                onClick={() => setCollaboratorRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                                                title="Remove collaborator">
                                            <X className="h-3.5 w-3.5"/>
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter className="pt-2 flex flex-col gap-2">
                    <Button fullWidth={true} className="h-8 text-sm" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : rotation ? 'Save' : 'Create'}
                    </Button>
                    {rotation && (
                        confirmDelete ? (
                            <>
                                <Button fullWidth={true} variant="destructive" className="h-8 text-sm gap-1"
                                        onClick={handleDelete} disabled={saving}>
                                    <Trash2 className="h-3 w-3"/>
                                    Confirm delete
                                </Button>
                                <Button fullWidth={true} variant="ghost" className="h-8 text-sm"
                                        onClick={() => setConfirmDelete(false)} disabled={saving}>
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <Button
                                fullWidth={true}
                                variant="ghost"
                                className="h-8 text-sm gap-1 text-destructive hover:text-destructive"
                                onClick={() => {
                                    setError('');
                                    setConfirmDelete(true);
                                }}
                                disabled={saving}
                            >
                                <Trash2 className="h-3 w-3"/>
                                Delete
                            </Button>
                        )
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

