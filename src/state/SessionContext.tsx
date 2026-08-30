import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CarProfile, ItemDef } from '../core/types';

export interface SelectedLine {
  itemId: string;
  qty: number;
}

interface SessionState {
  carId: string | null;
  seatsFolded: boolean;
  selectedItems: SelectedLine[];
  customItems: ItemDef[];
  customCars: CarProfile[];
  accessibleItemIds: string[];
  keepRearVisibility: boolean;
  allowBlockingRearView: 'auto' | 'never' | 'ifNeeded';
}

interface SessionApi extends SessionState {
  setCar: (carId: string) => void;
  setSeatsFolded: (v: boolean) => void;
  setQty: (itemId: string, qty: number) => void;
  addCustomItem: (item: ItemDef) => void;
  addCustomCar: (car: CarProfile) => void;
  removeSelected: (itemId: string) => void;
  toggleAccessible: (itemId: string) => void;
  setKeepRearVisibility: (v: boolean) => void;
  setAllowBlockingRearView: (v: SessionState['allowBlockingRearView']) => void;
  resetItems: () => void;
}

const initial: SessionState = {
  carId: null,
  seatsFolded: false,
  selectedItems: [],
  customItems: [],
  customCars: [],
  accessibleItemIds: [],
  keepRearVisibility: false,
  allowBlockingRearView: 'auto',
};

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initial);

  const setCar = useCallback((carId: string) => setState((s) => ({ ...s, carId })), []);
  const setSeatsFolded = useCallback((v: boolean) => setState((s) => ({ ...s, seatsFolded: v })), []);

  const setQty = useCallback((itemId: string, qty: number) => {
    setState((s) => {
      const existing = s.selectedItems.find((l) => l.itemId === itemId);
      if (qty <= 0) {
        return { ...s, selectedItems: s.selectedItems.filter((l) => l.itemId !== itemId) };
      }
      if (existing) {
        return { ...s, selectedItems: s.selectedItems.map((l) => (l.itemId === itemId ? { ...l, qty } : l)) };
      }
      return { ...s, selectedItems: [...s.selectedItems, { itemId, qty }] };
    });
  }, []);

  const addCustomItem = useCallback((item: ItemDef) => {
    setState((s) => ({
      ...s,
      customItems: [...s.customItems.filter((i) => i.id !== item.id), item],
      selectedItems: s.selectedItems.some((l) => l.itemId === item.id) ? s.selectedItems : [...s.selectedItems, { itemId: item.id, qty: 1 }],
    }));
  }, []);

  const addCustomCar = useCallback((car: CarProfile) => {
    setState((s) => ({ ...s, customCars: [...s.customCars.filter((c) => c.id !== car.id), car] }));
  }, []);

  const removeSelected = useCallback((itemId: string) => {
    setState((s) => ({ ...s, selectedItems: s.selectedItems.filter((l) => l.itemId !== itemId), accessibleItemIds: s.accessibleItemIds.filter((id) => id !== itemId) }));
  }, []);

  const toggleAccessible = useCallback((itemId: string) => {
    setState((s) => ({
      ...s,
      accessibleItemIds: s.accessibleItemIds.includes(itemId) ? s.accessibleItemIds.filter((id) => id !== itemId) : [...s.accessibleItemIds, itemId],
    }));
  }, []);

  const setKeepRearVisibility = useCallback((v: boolean) => setState((s) => ({ ...s, keepRearVisibility: v })), []);
  const setAllowBlockingRearView = useCallback((v: SessionState['allowBlockingRearView']) => setState((s) => ({ ...s, allowBlockingRearView: v })), []);
  // customCars must survive a reset — carId may still point at one, and
  // resolving it later needs the profile to still be in state.
  const resetItems = useCallback(() => setState((s) => ({ ...initial, carId: s.carId, customCars: s.customCars })), []);

  const value = useMemo<SessionApi>(
    () => ({
      ...state,
      setCar,
      setSeatsFolded,
      setQty,
      addCustomItem,
      addCustomCar,
      removeSelected,
      toggleAccessible,
      setKeepRearVisibility,
      setAllowBlockingRearView,
      resetItems,
    }),
    [state, setCar, setSeatsFolded, setQty, addCustomItem, addCustomCar, removeSelected, toggleAccessible, setKeepRearVisibility, setAllowBlockingRearView, resetItems]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
