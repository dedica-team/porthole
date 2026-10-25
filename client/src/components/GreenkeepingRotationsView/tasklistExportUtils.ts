import type { GreenkeepingRotation, GreenkeepingTaskItem, GreenkeepingTasklistExport } from '@/types/greenkeeping';

export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'tasklist';
}

export function createTasklistExportData(
  rotation: GreenkeepingRotation,
  title: string,
  tasks: GreenkeepingTaskItem[],
  createdAt: string = new Date().toISOString()
): GreenkeepingTasklistExport {
  return {
    rotationId: rotation.id,
    rotationName: rotation.name,
    title: title.trim() || 'Untitled Tasklist',
    createdAt,
    tasks: tasks.map((t) => ({
      done: Boolean(t.done),
      title: t.title.trim(),
      note: t.note?.trim() ?? '',
    })),
  };
}

export async function saveTasklistAsJson(
  data: GreenkeepingTasklistExport
): Promise<boolean> {
  const jsonContent = JSON.stringify(data, null, 2);
  const sanitizedRotation = sanitizeFilename(data.rotationName);
  const sanitizedTitle = sanitizeFilename(data.title);
  const defaultFilename = `${sanitizedRotation}-${sanitizedTitle}.json`;

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (options: unknown) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: 'JSON Files',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonContent);
      await writable.close();
      return true;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return false;
      }
    }
  }

  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
