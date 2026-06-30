import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  shareDialogOpen: boolean;
  versionPanelOpen: boolean;
  commentsPanelOpen: boolean;
  presenceSidebarOpen: boolean;
  toggleSidebar: () => void;
  setShareDialogOpen: (open: boolean) => void;
  setVersionPanelOpen: (open: boolean) => void;
  setCommentsPanelOpen: (open: boolean) => void;
  setPresenceSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  shareDialogOpen: false,
  versionPanelOpen: false,
  commentsPanelOpen: false,
  presenceSidebarOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setShareDialogOpen: (open) => set({ shareDialogOpen: open }),
  setVersionPanelOpen: (open) => set({ versionPanelOpen: open, commentsPanelOpen: false }),
  setCommentsPanelOpen: (open) => set({ commentsPanelOpen: open, versionPanelOpen: false }),
  setPresenceSidebarOpen: (open) => set({ presenceSidebarOpen: open }),
}));
