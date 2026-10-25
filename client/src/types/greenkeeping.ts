export interface GreenkeepingRotationCollaborator {
  id: string;
  collaboratorId: string;
  done: boolean;
}

export interface GreenkeepingTaskTemplateItem {
  id: string;
  title: string;
}

export interface GreenkeepingChecklistItem {
  id: string;
  title: string;
  done: boolean;
  note?: string | null;
}

export interface GreenkeepingChecklist {
  id: string;
  title: string;
  createdAt: string;
  createdBy?: string | null;
  finishedAt?: string | null;
  finishedBy?: string | null;
  items: GreenkeepingChecklistItem[];
}

export interface GreenkeepingTaskItem {
  id: string;
  title: string;
  done: boolean;
  note?: string;
}

export interface GreenkeepingTasklistExport {
  rotationId: string;
  rotationName: string;
  title: string;
  createdAt: string;
  tasks: Array<{
    done: boolean;
    title: string;
    note?: string;
  }>;
}

export interface GreenkeepingRotation {
  id: string;
  name: string;
  description?: string;
  link?: string;
  groupIds: string[];
  collaborators: GreenkeepingRotationCollaborator[];
  taskTemplates?: GreenkeepingTaskTemplateItem[];
  currentChecklist?: GreenkeepingChecklist | null;
  completedChecklists?: GreenkeepingChecklist[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface GreenkeepingRotationCollaboratorPatch {
  id?: string;
  collaboratorId: string;
  done?: boolean;
}

export interface CreateGreenkeepingRotationPayload {
  name: string;
  description?: string;
  link?: string;
  groupIds: string[];
  collaborators: GreenkeepingRotationCollaboratorPatch[];
  taskTemplates?: Array<{
    id?: string;
    title: string;
  }>;
}

export interface EditGreenkeepingRotationPayload {
  name?: string;
  description?: string | null;
  clearDescription?: boolean;
  link?: string | null;
  clearLink?: boolean;
  groupIds?: string[];
  collaborators?: GreenkeepingRotationCollaboratorPatch[];
  taskTemplates?: Array<{
    id?: string;
    title: string;
  }>;
}

export interface UpdateGreenkeepingChecklistPayload {
  title?: string;
  items?: Array<{
    id?: string;
    title: string;
    done: boolean;
    note?: string | null;
  }>;
}

export function getActiveGreenkeepingEntry(rotation: GreenkeepingRotation): GreenkeepingRotationCollaborator | null {
  return rotation.collaborators.find((entry) => !entry.done) ?? null;
}



