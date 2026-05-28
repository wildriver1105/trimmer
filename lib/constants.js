// Sail trimming simulator — tuning constants.
// 단위는 가능한 한 SI지만 시각/교육 목적이라 일부는 "느낌" 단위로 튜닝되어 있다.

export const SAIL = {
  // 메인세일 기본 치수 (32ft 크루저 가정)
  luffLength: 12,        // 마스트 방향 길이 (m)
  footLength: 4.5,       // 붐 방향 길이 (m, foot)
  headWidth: 0.15,       // 헤드 보드 폭 (m)
  spanStations: 9,       // 단면 개수
  chordPoints: 24,       // 각 단면을 따라 샘플링할 포인트 수
  defaultCamber: 0.12,   // 기본 캠버 비율
  defaultDraftPos: 0.45, // 기본 드래프트 위치 (0=러프, 1=리치)
};

export const RIG = {
  mastHeight: 13.5,
  mastRadius: 0.07,
  boomLength: 4.8,
  boomRadius: 0.06,
  boomHeight: 1.6,   // 갑판으로부터 붐의 높이
  hullLength: 9.8,
  hullBeam: 3.2,
  hullDepth: 1.1,
};

// 트림 컨트롤 → 단면 매개변수에 미치는 영향 강도.
// 각 값은 0~1 (또는 -1~1) 슬라이더가 movement의 최대 amplitude를 정함.
export const TRIM_EFFECTS = {
  // 캠버
  outhaulToFootCamber: -0.10,        // outhaul=1일 때 foot 캠버를 -0.10만큼 감소
  backstayToUpperCamber: -0.08,      // backstay=1일 때 상부 캠버 -0.08
  backstayToLowerCamber: -0.02,      // 하부에도 약간 영향
  // 드래프트 위치
  cunninghamToDraftPos: -0.15,       // cunningham=1일 때 draft 0.15만큼 앞으로 이동
  halyardToDraftPos: -0.08,
  // 트위스트 (헤드와 풋의 AoA 차이, rad)
  vangBaseTwist: 0.55,               // vang=0일 때 자연스러운 twist
  vangToTwist: -0.55,                // vang=1일 때 트위스트 제거
  sheetEaseToTwist: 0.30,            // sheet ease할수록 twist 추가
  // boom angle (rad) — 시트와 트래블러
  sheetToBoomAngle: -0.95,           // sheet=1(in)일 때 boom이 거의 중심선
  sheetEaseMaxAngle: 1.20,           // sheet=0(out) 최대 boom 각도 (rad)
  travelerToBoomAngle: 0.35,         // traveler ±1에 따른 추가 boom 각도
  // 마스트 벤드
  backstayToMastBend: 0.35,          // backstay=1일 때 마스트 굽힘량 (m, 최대)
  // 붐 라이즈 — sheet ease + vang loose일 때 boom이 위로 들리는 최대 각도 (rad)
  maxBoomRise: 0.35,                 // ≈ 20°
};

export const AERO = {
  airDensity: 1.225,        // kg/m³
  ktsToMs: 0.5144,
  // 얇은 익형 근사: CL = 2π·sin(α - α0). 캠버가 α0를 음으로 이동시킴.
  liftSlope: Math.PI * 2,
  alphaStall: (15 * Math.PI) / 180,
  postStallCL: 0.85,        // stall 직후 CL이 떨어지는 값
  // 항력
  CD0: 0.06,                // 형상항력 (cloth+rigging)
  inducedDragK: 0.18,       // 유도항력 계수
  // 캠버가 zero-lift AoA에 미치는 영향: α0 ≈ -2·camber (rad)
  camberToAlpha0: 2.0,
};

export const SLIDER = {
  // [min, max, step, default, unit, label]
  TWS:        { min: 0,   max: 30,  step: 0.5, def: 12,  unit: 'kt',  label: 'True Wind Speed',     desc: '진풍속 (실제 바람 세기)' },
  TWA:        { min: 0,   max: 180, step: 1,   def: 45,  unit: '°',   label: 'True Wind Angle',     desc: '진풍각 (보트 진행방향에서 바람까지의 각도)' },
  SOG:        { min: 0,   max: 10,  step: 0.1, def: 5.0, unit: 'kt',  label: 'Boat Speed',          desc: '보트 속도 (대수 속도)' },

  outhaul:    { min: 0, max: 1, step: 0.01, def: 0.50, unit: '',  label: 'Outhaul',              desc: 'foot 장력 — 당기면 하단이 평평해져 고풍속/클로즈홀드에 유리' },
  cunningham: { min: 0, max: 1, step: 0.01, def: 0.30, unit: '',  label: 'Cunningham',           desc: '러프 다운홀 — 당기면 드래프트가 앞쪽으로 이동, 고풍속에 유리' },
  halyard:    { min: 0, max: 1, step: 0.01, def: 0.50, unit: '',  label: 'Halyard',              desc: '메인 할리어드 — 러프 장력 (cunningham과 유사)' },
  backstay:   { min: 0, max: 1, step: 0.01, def: 0.30, unit: '',  label: 'Backstay / Mast Bend', desc: '백스테이 — 마스트를 휘게 하여 상단을 평평하게 만듦' },
  vang:       { min: 0, max: 1, step: 0.01, def: 0.30, unit: '',  label: 'Boom Vang',            desc: '붐뱅 — 붐을 누르므로 leech 장력↑, 트위스트↓' },
  sheet:      { min: 0, max: 1, step: 0.01, def: 0.60, unit: '',  label: 'Mainsheet',            desc: '메인시트 — 1=완전히 당김(트림 인), 0=풀어줌(eased)' },
  traveler:   { min: -1, max: 1, step: 0.01, def: 0.00, unit: '', label: 'Traveler',             desc: '트래블러 — windward(+)/leeward(-). 시트와 독립적으로 boom 각도 조정' },
};

export const COLORS = {
  sky:     '#0b1d2d',
  horizon: '#1f4761',
  sea:     '#08324d',
  grid:    '#0f3a55',
  sail:    '#f4f6fa',
  mast:    '#2a2f38',
  boom:    '#2a2f38',
  hull:    '#1b2230',
  lift:    '#3ddc84',
  drag:    '#ff8c42',
  drive:   '#ffd84d',
  heel:    '#ff5d6c',
  trueWind:   '#5fb6ff',
  appWind:    '#ff7a9e',
};
