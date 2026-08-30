import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ItemDef } from '../core/types';

const KEY = 'packwise.savedItems.v1';

export async function loadSavedItems(): Promise<ItemDef[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ItemDef[]) : [];
  } catch {
    return [];
  }
}

export async function saveItem(item: ItemDef): Promise<ItemDef[]> {
  const items = await loadSavedItems();
  const next = [...items.filter((i) => i.id !== item.id), item];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function deleteSavedItem(id: string): Promise<ItemDef[]> {
  const items = await loadSavedItems();
  const next = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
