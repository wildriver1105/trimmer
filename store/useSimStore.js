'use client';

import { create } from 'zustand';
import { SLIDER } from '@/lib/constants';

const defaults = Object.fromEntries(
  Object.entries(SLIDER).map(([k, v]) => [k, v.def])
);

export const useSimStore = create((set) => ({
  // Wind & speed
  TWS: defaults.TWS,
  TWA: defaults.TWA,
  SOG: defaults.SOG,

  // Trim controls
  outhaul:    defaults.outhaul,
  cunningham: defaults.cunningham,
  halyard:    defaults.halyard,
  backstay:   defaults.backstay,
  vang:       defaults.vang,
  sheet:      defaults.sheet,
  traveler:   defaults.traveler,

  // Visualization toggles
  showPressure: true,
  showTelltales: true,
  showForces: true,
  showWind: true,
  showStreamlines: true,
  wireframe: false,

  // 시각화 매개변수
  streamDensity: defaults.streamDensity,

  set: (key, value) => set({ [key]: value }),
  reset: () => set({ ...defaults }),
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
}));
