import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CarProfile } from '../core/types';

const KEY = 'packwise.savedCars.v1';

export async function loadSavedCars(): Promise<CarProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CarProfile[]) : [];
  } catch {
    return [];
  }
}

export async function saveCar(car: CarProfile): Promise<CarProfile[]> {
  const cars = await loadSavedCars();
  const next = [...cars.filter((c) => c.id !== car.id), car];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function deleteSavedCar(id: string): Promise<CarProfile[]> {
  const cars = await loadSavedCars();
  const next = cars.filter((c) => c.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
