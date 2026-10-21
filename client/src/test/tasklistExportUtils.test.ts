import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  sanitizeFilename,
  createTasklistExportData,
  saveTasklistAsJson,
} from '../components/GreenkeepingRotationsView/tasklistExportUtils';
import type { GreenkeepingRotation, GreenkeepingTaskItem, GreenkeepingTasklistExport } from '../types/greenkeeping';

describe('tasklistExportUtils', () => {
  const rotation: GreenkeepingRotation = {
    id: 'rot-xyz-123',
    name: 'Weekly Platform & Security / Ops',
    groupIds: ['g1'],
    collaborators: [{ id: 'c1', collaboratorId: 'u1', done: false }],
  };

  const tasks: GreenkeepingTaskItem[] = [
    { id: '1', title: '  Review audit logs  ', done: true, note: '  All clear  ' },
    { id: '2', title: 'Check disk metrics', done: false, note: undefined },
  ];

  describe('sanitizeFilename', () => {
    it('replaces spaces with hyphens and removes special filesystem characters', () => {
      expect(sanitizeFilename('Weekly Ops / Greenkeeping: 2026?')).toBe('weekly-ops-greenkeeping-2026');
    });

    it('returns tasklist as fallback if string is empty or only special characters', () => {
      expect(sanitizeFilename('')).toBe('tasklist');
      expect(sanitizeFilename('???///:::')).toBe('tasklist');
    });
  });

  describe('createTasklistExportData', () => {
    it('structures export payload with rotation metadata, title, timestamp and task entries', () => {
      const fixedDate = '2026-10-20T22:00:00.000Z';
      const exportData = createTasklistExportData(rotation, '2026-10-20', tasks, fixedDate);

      expect(exportData).toEqual<GreenkeepingTasklistExport>({
        rotationId: 'rot-xyz-123',
        rotationName: 'Weekly Platform & Security / Ops',
        title: '2026-10-20',
        createdAt: fixedDate,
        tasks: [
          {
            done: true,
            title: 'Review audit logs',
            note: 'All clear',
          },
          {
            done: false,
            title: 'Check disk metrics',
            note: '',
          },
        ],
      });
    });
  });

  describe('saveTasklistAsJson', () => {
    const sampleData: GreenkeepingTasklistExport = {
      rotationId: 'rot-1',
      rotationName: 'Hygiene Ops',
      title: '2026-10-20',
      createdAt: '2026-10-20T12:00:00Z',
      tasks: [{ done: true, title: 'Clean room', note: 'Done' }],
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('uses showSaveFilePicker when available', async () => {
      const writeMock = vi.fn().mockResolvedValue(undefined);
      const closeMock = vi.fn().mockResolvedValue(undefined);
      const createWritableMock = vi.fn().mockResolvedValue({
        write: writeMock,
        close: closeMock,
      });
      const showSaveFilePickerMock = vi.fn().mockResolvedValue({
        createWritable: createWritableMock,
      });

      (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = showSaveFilePickerMock;

      const result = await saveTasklistAsJson(sampleData);

      expect(result).toBe(true);
      expect(showSaveFilePickerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: 'hygiene-ops-2026-10-20.json',
        })
      );
      expect(createWritableMock).toHaveBeenCalled();
      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('"Hygiene Ops"'));
      expect(closeMock).toHaveBeenCalled();

      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });

    it('handles AbortError without error when user cancels save picker', async () => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      const showSaveFilePickerMock = vi.fn().mockRejectedValue(abortError);

      (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = showSaveFilePickerMock;

      const result = await saveTasklistAsJson(sampleData);
      expect(result).toBe(false);

      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });

    it('falls back to Blob download when showSaveFilePicker is not supported', async () => {
      delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;

      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-url');
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      const clickMock = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'a') {
          el.click = clickMock;
        }
        return el;
      });

      const result = await saveTasklistAsJson(sampleData);

      expect(result).toBe(true);
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/mock-url');
    });
  });
});
