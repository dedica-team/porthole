export interface GreenkeepingRotationCollaborator {
  id: string;
  collaboratorId: string;
  done: boolean;
}

export interface GreenkeepingRotation {
  id: string;
  name: string;
  description?: string;
  link?: string;
  groupIds: string[];
  collaborators: GreenkeepingRotationCollaborator[];
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
}

export interface EditGreenkeepingRotationPayload {
  name?: string;
  description?: string | null;
  clearDescription?: boolean;
  link?: string | null;
  clearLink?: boolean;
  groupIds?: string[];
  collaborators?: GreenkeepingRotationCollaboratorPatch[];
}

export function getActiveGreenkeepingEntry(rotation: GreenkeepingRotation): GreenkeepingRotationCollaborator | null {
  return rotation.collaborators.find((entry) => !entry.done) ?? null;
}



