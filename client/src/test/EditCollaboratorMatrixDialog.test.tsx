import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditCollaboratorMatrixDialog from '../components/CollaboratorMatrixView/EditCollaboratorMatrixDialog';
import type { Collaborator } from '../types/session';
import type { CollaboratorMatrix } from '../types/matrix';

const COLLAB1: Collaborator = { id: 'c1', username: 'Alice' };
const COLLAB2: Collaborator = { id: 'c2', username: 'Bob' };
const COLLAB3: Collaborator = { id: 'c3', username: 'Charlie' };

const matrix: CollaboratorMatrix = {
  name: 'Competency Matrix',
  collaborators: ['c1', 'c2'],
  entries: {},
};

describe('EditCollaboratorMatrixDialog', () => {
  it('pre-fills matrix name and selected collaborators', () => {
    render(
      <EditCollaboratorMatrixDialog
        open={true}
        onOpenChange={vi.fn()}
        matrix={matrix}
        mapCollaborators={[COLLAB1, COLLAB2, COLLAB3]}
        onSave={vi.fn()}
      />
    );

    const nameInput = screen.getByLabelText(/matrix name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Competency Matrix');

    const aliceCheckbox = screen.getByLabelText('Alice') as HTMLInputElement;
    const bobCheckbox = screen.getByLabelText('Bob') as HTMLInputElement;
    const charlieCheckbox = screen.getByLabelText('Charlie') as HTMLInputElement;

    expect(aliceCheckbox.checked).toBe(true);
    expect(bobCheckbox.checked).toBe(true);
    expect(charlieCheckbox.checked).toBe(false);
  });

  it('toggles select all and deselect all', () => {
    render(
      <EditCollaboratorMatrixDialog
        open={true}
        onOpenChange={vi.fn()}
        matrix={matrix}
        mapCollaborators={[COLLAB1, COLLAB2, COLLAB3]}
        onSave={vi.fn()}
      />
    );

    const selectAllBtn = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllBtn);

    expect((screen.getByLabelText('Alice') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Bob') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Charlie') as HTMLInputElement).checked).toBe(true);

    const deselectAllBtn = screen.getByRole('button', { name: /deselect all/i });
    fireEvent.click(deselectAllBtn);

    expect((screen.getByLabelText('Alice') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Bob') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Charlie') as HTMLInputElement).checked).toBe(false);
  });

  it('submits updated name and collaborator list', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <EditCollaboratorMatrixDialog
        open={true}
        onOpenChange={onOpenChange}
        matrix={matrix}
        mapCollaborators={[COLLAB1, COLLAB2, COLLAB3]}
        onSave={onSave}
      />
    );

    const nameInput = screen.getByLabelText(/matrix name/i);
    fireEvent.change(nameInput, { target: { value: 'New Matrix' } });

    // Deselect Bob, select Charlie
    fireEvent.click(screen.getByLabelText('Bob'));
    fireEvent.click(screen.getByLabelText('Charlie'));

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith('New Matrix', ['c1', 'c3']);
  });
});
