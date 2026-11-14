import { createContext, useContext, useEffect } from 'react';

export interface SidebarCardHeaderConfig {
  title: string;
  subtitle?: string;
  onEdit?: () => void;
  editLabel?: string;
  editDisabled?: boolean;
  onClose?: () => void;
  closeLabel?: string;
}

type RegisterHeader = (config: SidebarCardHeaderConfig | null) => void;

export const SidebarCardHeaderContext = createContext<RegisterHeader | null>(null);

/**
 * Lets a panel contribute its title and actions to the shared sidebar card
 * header. Panels rendered outside a Sidebar keep their own inline header.
 */
export function useSidebarCardHeader(config: SidebarCardHeaderConfig | null): boolean {
  const register = useContext(SidebarCardHeaderContext);
  const title = config?.title;
  const subtitle = config?.subtitle;
  const onEdit = config?.onEdit;
  const editLabel = config?.editLabel;
  const editDisabled = config?.editDisabled;
  const onClose = config?.onClose;
  const closeLabel = config?.closeLabel;

  useEffect(() => {
    if (!register) return;
    register(title ? { title, subtitle, onEdit, editLabel, editDisabled, onClose, closeLabel } : null);
    return () => register(null);
  }, [register, title, subtitle, onEdit, editLabel, editDisabled, onClose, closeLabel]);

  return register !== null;
}
