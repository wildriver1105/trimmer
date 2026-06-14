'use client';

import { create } from 'zustand';
import { SLIDER } from '@/lib/constants';
import { SAIL_ORDER, SAIL_TYPES, SLOT_MEMBERS, allDefaults } from '@/lib/sails';

const sliderDefaults = Object.fromEntries(
  Object.entries(SLIDER).map(([k, v]) => [k, v.def])
);

const trimDefaults = allDefaults();

export const useSimStore = create((set, get) => ({
  // Wind & speed
  TWS: sliderDefaults.TWS,
  TWA: sliderDefaults.TWA,
  SOG: sliderDefaults.SOG,

  // 세일 활성화 (slot별 mutex)
  activeMain: true,
  activeHeadsail: null,    // 'jib' | 'genoa' | null
  activeDownwind: null,    // 'spinnaker' | 'gennaker' | null

  // 세일별 트림 (nested)
  trim: trimDefaults,

  // 시각화 토글
  showPressure: true,
  showTelltales: true,
  showForces: true,
  showWind: true,
  showStreamlines: true,
  showHeel: false,            // 힐(보트 기울임) 시각화 — 기본 OFF
  wireframe: false,

  // 시각화 매개변수
  streamDensity: sliderDefaults.streamDensity,

  // 환경
  timeOfDay: sliderDefaults.timeOfDay,

  // ----- Actions -----

  // 글로벌 슬라이더(TWS/TWA/SOG/streamDensity)에 대한 setter
  set: (key, value) => set({ [key]: value }),

  toggle: (key) => set((s) => ({ [key]: !s[key] })),

  // 세일별 트림 setter
  setTrim: (sailKey, paramName, value) =>
    set((s) => ({
      trim: {
        ...s.trim,
        [sailKey]: { ...s.trim[sailKey], [paramName]: value },
      },
    })),

  // 헤드세일 mutex (null 또는 'jib'/'genoa')
  setHeadsail: (key) => {
    if (key !== null && !SLOT_MEMBERS.headsail.includes(key)) return;
    set({ activeHeadsail: key });
  },

  // 다운윈드 mutex (null 또는 'spinnaker'/'gennaker')
  setDownwind: (key) => {
    if (key !== null && !SLOT_MEMBERS.downwind.includes(key)) return;
    set({ activeDownwind: key });
  },

  // 메인세일 토글
  toggleMain: () => set((s) => ({ activeMain: !s.activeMain })),

  // 전체 리셋
  reset: () => set({
    TWS: sliderDefaults.TWS,
    TWA: sliderDefaults.TWA,
    SOG: sliderDefaults.SOG,
    activeMain: true,
    activeHeadsail: null,
    activeDownwind: null,
    trim: allDefaults(),
    streamDensity: sliderDefaults.streamDensity,
    timeOfDay: sliderDefaults.timeOfDay,
  }),
}));

// ----- Selectors / 헬퍼 -----

/** 현재 활성화된 세일 키 배열 (렌더 순서대로) */
export function getActiveSails(state) {
  const list = [];
  if (state.activeMain) list.push('main');
  if (state.activeHeadsail) list.push(state.activeHeadsail);
  if (state.activeDownwind) list.push(state.activeDownwind);
  return list;
}
