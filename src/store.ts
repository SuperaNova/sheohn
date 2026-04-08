import { create } from 'zustand';

interface PortfolioState {
  activeFocus: string | null;
  overlayActive: boolean;
  setFocus: (focus: string | null) => void;
  clearFocus: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  activeFocus: null,
  overlayActive: false,
  setFocus: (focus) => set({ activeFocus: focus, overlayActive: !!focus }),
  clearFocus: () => set({ activeFocus: null, overlayActive: false }),
}));
