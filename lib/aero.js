// 공력 계산 — 상대풍, 단면별 양력/항력(2D 익형 + Viterna post-stall), 힘 적분.
//
// 좌표계: 보트 프레임 x=앞(bow +), y=위, z=좌현(port +).
//
// 설계 원칙 (이전의 부호 추측을 제거):
//   - chord·normal은 실제 지오메트리 벡터에서 직접 구한다.
//       chord ĉ = (leech - luff)의 수평 성분 (luff=앞전, leech=뒷전)
//       suction normal n̂ = camberDir의 수평 성분 (세일이 부푸는 풍하/흡입면 방향)
//   - 받음각 α = 코드 대비 자유류 f의 부호 있는 각도 (흡입면 방향이 +).
//       C_L(α): |α|<stall 얇은 익형 2π·sin, 그 이상은 Viterna-Corrigan 외삽.
//   - 양력 = q·c·dh·C_L, 방향은 자유류 f에 수직 + 흡입면(n̂)측.  (C_L<0이면 역풍 → 반대)
//   - 항력 = q·c·dh·C_D, 방향은 자유류 f (하류).
//   - 합력을 drive(x)·heel(z), 그리고 lift(⊥f)·drag(∥f)로 분해.

import { AERO, SAIL } from './constants';

const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * 진풍/보트속도에서 상대풍(보트가 받는 공기 흐름) 계산.
 *   W_true(공기 속도) = (-cosTWA, -sinTWA)·TWS,  V_boat = (SOG, 0).
 *   W_app = W_true - V_boat = 보트에 대한 공기의 진행 방향(자유류).
 * @returns { TW, AW:[vx,0,vz], AWS, AWA(rad, 뱃머리 기준 들어오는 각) }
 */
export function computeWind(twsKt, twaDeg, sogKt) {
  const tws = twsKt * AERO.ktsToMs;
  const sog = sogKt * AERO.ktsToMs;
  const twa = twaDeg * RAD;
  const TWx = -Math.cos(twa) * tws;
  const TWz = -Math.sin(twa) * tws;
  const AWx = TWx - sog;
  const AWz = TWz;
  const AWS = Math.hypot(AWx, AWz);
  // 들어오는 바람의 방향(= -자유류)이 뱃머리(+x)와 이루는 각.
  const AWA = Math.atan2(-AWz, -AWx);
  return { TW: [TWx, 0, TWz], AW: [AWx, 0, AWz], AWS, AWA };
}

// ── 익형 계수 (Viterna-Corrigan post-stall 외삽) ──
// ae = 유효 받음각 (zero-lift 기준). 전 영역 [-π,π]에서 매끈하게 정의.
function clCurve(ae) {
  const aStall = AERO.alphaStall;
  const a = ae;
  const absA = Math.abs(a);
  const attached = AERO.liftSlope * Math.sin(a);
  if (absA <= aStall) return attached;
  // Viterna: 평판 거동으로 부드럽게 전이
  const CDmax = AERO.CDmax;
  const clVit = 0.5 * CDmax * Math.sin(2 * a);
  const clStall = Math.sign(a) * AERO.liftSlope * Math.sin(aStall);
  const t = clamp((absA - aStall) / (16 * RAD), 0, 1);
  return clStall * (1 - t) + clVit * t;
}
function cdCurve(ae, CL) {
  const aStall = AERO.alphaStall;
  const absA = Math.abs(ae);
  const cdAtt = AERO.CD0 + AERO.inducedDragK * CL * CL;
  if (absA <= aStall) return cdAtt;
  const cdSep = AERO.CD0 + AERO.CDmax * Math.sin(absA) * Math.sin(absA);
  const t = clamp((absA - aStall) / (75 * RAD), 0, 1);
  return cdAtt * (1 - t) + cdSep * t;
}

/**
 * 세일 형상 + 상대풍에서 단면별 힘과 합력.
 * @returns {{ total, stationForces, CE }}
 *   total: { lift, drag, drive, heel, Fx, Fz, total, liftDir, dragDir, flow:[fx,0,fz] }
 *   stationForces[i]: { alphaDeg, CL, CD, dL, dD, Fx, Fz, gamma, isStalled, fill, luff, collapse, h }
 */
export function computeForces(shape, geomData, wind) {
  const AWS = wind.AWS;
  const stations = geomData.stationData;
  const N = stations.length;

  if (AWS < 0.05 || N === 0) {
    return {
      total: { lift: 0, drag: 0, drive: 0, heel: 0, Fx: 0, Fz: 0, total: 0,
        liftDir: [0, 0, 0], dragDir: [0, 0, 0], flow: [1, 0, 0] },
      stationForces: [],
      CE: [0, SAIL.luffLength / 2, SAIL.footLength / 3],
    };
  }

  // 자유류 단위벡터 (수평)
  const fx = wind.AW[0] / AWS;
  const fz = wind.AW[2] / AWS;
  const q = 0.5 * AERO.airDensity * AWS * AWS;

  // ── 세일 천 동적 상태(fill/luff/collapse) — AWA 운용범위 모델 (시각용, 힘과 독립) ──
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const awaDeg = Math.abs(wind.AWA) * 180 / Math.PI;
  const sk = shape.sailKey;
  let fillBase, luffBase, collapseBase;
  if (sk === 'spinnaker' || sk === 'gennaker') {
    const lo = sk === 'spinnaker' ? 62 : 50;
    const fillF = smooth(lo, lo + 26, awaDeg);
    fillBase = fillF - (1 - fillF) * 0.7;
    collapseBase = Math.max(0, -fillBase);
    luffBase = (1 - fillF) * smooth(lo - 22, lo, awaDeg) * 0.5;
  } else {
    const fillF = smooth(16, 30, awaDeg);
    fillBase = fillF;
    luffBase = 1 - fillF;
    collapseBase = 0;
    if ((sk === 'jib' || sk === 'genoa') && awaDeg > 150) {
      const bl = smooth(150, 178, awaDeg);
      luffBase = Math.max(luffBase, bl * 0.6);
      fillBase = Math.min(fillBase, 1 - bl * 0.5);
    }
  }

  const stationForces = [];
  let totalFx = 0, totalFz = 0;
  let CEx = 0, CEy = 0, CEz = 0, totalMag = 0;

  for (let i = 0; i < N; i++) {
    const st = stations[i];

    // 실제 지오메트리에서 chord(앞전→뒷전)·suction normal 수평 성분
    let cx = st.leech[0] - st.luff[0];
    let cz = st.leech[2] - st.luff[2];
    const clen = Math.hypot(cx, cz);
    if (clen < 1e-4) {
      stationForces.push(zeroStation(st));
      continue;
    }
    cx /= clen; cz /= clen;
    const cdir = st.camberDir || [0, 0, 1];
    let nx = cdir[0], nz = cdir[2];
    const nlen = Math.hypot(nx, nz) || 1;
    nx /= nlen; nz /= nlen;

    // 받음각: 코드 대비 자유류 f, 흡입면(n̂) 방향이 +.
    const fpar = fx * cx + fz * cz;      // 코드 성분 (앞전→뒷전 +)
    const fperp = fx * nx + fz * nz;     // 흡입면 normal 성분
    const alpha = Math.atan2(fperp, fpar);
    const alpha0 = -AERO.camberToAlpha0 * st.camber;   // 캠버 zero-lift (음)
    const ae = alpha - alpha0;

    const CL = clCurve(ae);
    const CD = cdCurve(ae, CL);

    // 단면 높이로 변주한 fill/luff/collapse
    const hw = 0.7 + 0.6 * st.h;
    const fill = clamp(fillBase, -0.7, 1);
    const luff = clamp(luffBase * hw, 0, 1);
    const collapse = clamp(collapseBase * (0.85 + 0.3 * st.h), 0, 1);
    // 소프트 세일 유효도: 채워졌을 때만 힘 발생. 붕괴(fill<0)→0, 펄럭임→감소.
    const eff = Math.max(0, fill) * (1 - 0.8 * luff);

    const dh = st.dh ?? (SAIL.luffLength / (N - 1));
    const area = st.chord * dh;
    const dL = q * CL * area * eff;
    const dD = q * (CD * eff + AERO.CD0 * (1 - eff) * 0.5) * area; // 펄럭이는 천도 약간의 항력

    // 양력 방향: f에 수직, 흡입면 n̂ 측 (+90° 회전 후 n̂과 같은 쪽으로 정렬)
    let lpx = -fz, lpz = fx;
    if (lpx * nx + lpz * nz < 0) { lpx = -lpx; lpz = -lpz; }
    // 힘 = 양력(CL 부호 포함) + 항력(하류 f)
    const FxS = dL * lpx + dD * fx;
    const FzS = dL * lpz + dD * fz;

    totalFx += FxS;
    totalFz += FzS;

    // 순환 Γ = ½·V·c·C_L·eff  (스트림라인 vortex 강도 — 안 채워지면 직진)
    const gamma = 0.5 * AWS * st.chord * CL * eff;

    const mag = Math.hypot(FxS, FzS);
    const mx = (st.luff[0] + st.leech[0]) / 2;
    const my = (st.luff[1] + st.leech[1]) / 2;
    const mz = (st.luff[2] + st.leech[2]) / 2;
    CEx += mx * mag; CEy += my * mag; CEz += mz * mag; totalMag += mag;

    const isStalled = eff > 0.2 && Math.abs(ae) > AERO.alphaStall;

    stationForces.push({
      alphaDeg: alpha / RAD,
      aeDeg: ae / RAD,
      CL, CD, dL, dD,
      Fx: FxS, Fz: FzS,
      gamma, eff,
      isStalled,
      fill, luff, collapse,
      h: st.h,
    });
  }

  const CE = totalMag > 0
    ? [CEx / totalMag, CEy / totalMag, CEz / totalMag]
    : [0, SAIL.luffLength / 2, SAIL.footLength / 3];

  // 합력 분해
  const drag = totalFx * fx + totalFz * fz;            // 자유류 방향 성분 (하류 +)
  let lvx = totalFx - drag * fx;                       // f에 수직 성분 = 양력 벡터
  let lvz = totalFz - drag * fz;
  const lift = Math.hypot(lvx, lvz);
  const liftDir = lift > 1e-6 ? [lvx / lift, 0, lvz / lift] : [0, 0, 0];

  return {
    total: {
      lift,
      drag: Math.abs(drag),
      drive: totalFx,            // 보트 진행(+x) 성분
      heel: totalFz,             // 횡력(z)
      Fx: totalFx, Fz: totalFz,
      total: Math.hypot(totalFx, totalFz),
      liftDir,
      dragDir: [fx, 0, fz],
      flow: [fx, 0, fz],
    },
    stationForces,
    CE,
  };
}

function zeroStation(st) {
  return {
    alphaDeg: 0, aeDeg: 0, CL: 0, CD: 0, dL: 0, dD: 0, Fx: 0, Fz: 0,
    gamma: 0, isStalled: false, fill: 1, luff: 0, collapse: 0, h: st.h,
  };
}
