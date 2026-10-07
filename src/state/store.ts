import { create } from 'zustand';

/**
 * UI state only. The database is the source of truth for data; screens re-query when
 * `revision` changes, which every write bumps through `notifyDataChanged()`.
 */
type AppState = {
  revision: number;
  /** null until settings are loaded. */
  onboarded: boolean | null;
  appLockEnabled: boolean;
  unlocked: boolean;
  bumpRevision: () => void;
  setOnboarded: (value: boolean) => void;
  setAppLockEnabled: (value: boolean) => void;
  setUnlocked: (value: boolean) => void;
};

export const useAppStore = create<AppState>(set => ({
  revision: 0,
  onboarded: null,
  appLockEnabled: false,
  unlocked: false,
  bumpRevision: () => set(state => ({ revision: state.revision + 1 })),
  setOnboarded: onboarded => set({ onboarded }),
  setAppLockEnabled: appLockEnabled => set({ appLockEnabled }),
  setUnlocked: unlocked => set({ unlocked }),
}));

export const notifyDataChanged = (): void =>
  useAppStore.getState().bumpRevision();
