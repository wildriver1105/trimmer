// 공력 계산 — 상대풍, 단면별 CL/CD, 힘 적분.
// 좌표계 약속:
//   - 보트 좌표계: x=앞, y=위, z=좌현(좌)
//   - 진풍각 TWA(°): 0=정면바람(close-hauled 불가), 90=beam, 180=run.
//     실제 세일링에서는 0° head-to-wind이며 그쪽에서는 동력 없음. UI에서 30~180 정도가 유효.
//   - TWA는 우현(starboard tack) 기준이라고 가정 — 바람이 보트의 +z 쪽에서 -z 쪽으로 분다.
//     즉 진풍 벡터의 방향: 바람이 불어가는 방향 = ( -cos(TWA), 0, +sin(TWA) ) 가 아니라 보트로 들어오는 방향.
//   여기서는 "바람이 불어오는(=시작) 방향"으로 W_dir을 정의하고, 흐름은 그 반대.

import { AERO, SAIL } from './constants';

const RAD = Math.PI / 180;

/**
 * 진풍을 보트 좌표계에서의 "바람이 향하는 흐름 벡터" (즉 -windFrom)으로 반환.
 * 흐름 벡터의 방향은 바람이 부는 방향(즉 보트가 받는 공기 흐름의 진행 방향).
 *
 * @param {number} twsKt — true wind speed (knots)
 * @param {number} twaDeg — true wind angle (deg). +면 starboard tack
 * @param {number} sogKt — boat speed (knots), 보트는 +x 방향으로 진행
 * @returns {{ TW: [vx,vy,vz], AW: [vx,vy,vz], AWS: number, AWA: number(rad) }}
 *          AW = 흐름 벡터 (바람이 보트에 대해 향하는 방향).
 *          AWA = +x로부터 -z쪽으로의 각도 (>0이면 흐름이 starboard에서 port로 감)
 */
export function computeWind(twsKt, twaDeg, sogKt) {
  const tws = twsKt * AERO.ktsToMs;
  const sog = sogKt * AERO.ktsToMs;
  const twa = twaDeg * RAD;

  // 진풍이 향하는 흐름 벡터 (TW가 바람이 가는 방향).
  // starboard tack: 바람이 보트의 우현(+z쪽 가정...?)에서 옴.
  //   보트 진행은 +x. 진풍이 보트 앞쪽 방향과 이루는 각이 TWA.
  //   바람이 "오는" 방향 (시점, source) = (cos(TWA), 0, sin(TWA))
  //   바람의 흐름 벡터 (목적지 방향) = -source = (-cos(TWA), 0, -sin(TWA))
  // 여기서 -z를 port(좌현)로 보면 starboard tack에서는 바람이 +z(우현)에서 옴.
  const TWx = -Math.cos(twa) * tws;
  const TWz = -Math.sin(twa) * tws;
  // 보트 속도 vector (보트 진행 방향): +x로 sog.
  // 보트가 받는 공기의 흐름 = 진풍 흐름 - 보트 속도
  const AWx = TWx - sog;
  const AWz = TWz - 0;
  const AWS = Math.hypot(AWx, AWz);
  // AWA: 보트 진행방향(+x) 대비 흐름 방향의 부호 있는 각도.
  // 흐름은 보트 쪽으로 오므로 "받는 바람"의 각도는 -AW의 방향.
  // sailing 관습의 AWA = 보트 정면 기준으로 바람이 들어오는 각도.
  const windFromX = -AWx;
  const windFromZ = -AWz;
  const AWA = Math.atan2(windFromZ, windFromX); // rad, 0~π 사이 (starboard tack)

  return {
    TW: [TWx, 0, TWz],
    AW: [AWx, 0, AWz],
    AWS,
    AWA,
  };
}

// 단순 양력/항력 곡선
function liftCoeff(alpha, camber) {
  const alpha0 = -AERO.camberToAlpha0 * camber;
  const alphaEff = alpha - alpha0;
  const absAlpha = Math.abs(alphaEff);
  if (absAlpha <= AERO.alphaStall) {
    return AERO.liftSlope * Math.sin(alphaEff);
  }
  // post-stall: 부드럽게 감소
  const sign = Math.sign(alphaEff);
  const t = Math.min(1, (absAlpha - AERO.alphaStall) / (Math.PI / 2 - AERO.alphaStall));
  const peak = AERO.liftSlope * Math.sin(AERO.alphaStall);
  return sign * (peak * (1 - t) + AERO.postStallCL * t * Math.cos(absAlpha));
}

function dragCoeff(cl) {
  return AERO.CD0 + AERO.inducedDragK * cl * cl;
}

/**
 * 세일 형상과 상대풍에서 단면별 힘과 합력을 계산.
 *
 * @param {object} shape — buildSailShape 결과
 * @param {object} geomData — buildSailGeometry 결과 (stationData)
 * @param {object} wind — computeWind 결과
 * @returns {{
 *   total: { lift, drag, drive, heel, Fx, Fz },
 *   stationForces: [{ alpha, CL, CD, dL, dD, isStalled, ... }],
 *   CE: [x, y, z],   // center of effort 위치
 * }}
 */
export function computeForces(shape, geomData, wind) {
  const [awx, , awz] = wind.AW;
  const AWS = wind.AWS;
  if (AWS < 0.05) {
    return {
      total: { lift: 0, drag: 0, drive: 0, heel: 0, Fx: 0, Fz: 0, fxArrow: [0,0,0], fzArrow: [0,0,0], liftDir: [0,0,0], dragDir: [0,0,0] },
      stationForces: [],
      CE: [0, SAIL.luffLength / 2, SAIL.footLength / 3],
    };
  }
  // 흐름 단위 벡터 (보트가 받는 바람의 진행 방향)
  const fx = awx / AWS;
  const fz = awz / AWS;
  // 양력 방향: 흐름에 수직, 위로 향한 단면 노멀 쪽 = 세일이 leeward로 부풀어 있는 쪽.
  // 2D(xz) 평면에서 fz의 수직은 (-fz, 0, fx) 또는 (fz, 0, -fx).
  // 양력은 세일이 바람을 받아 leeward로 빨려가는 방향(여기서는 -z 가정, port쪽)에 수직.
  // 부호는 단면 자체의 AoA가 양일 때 양력이 그 방향을 향하도록.
  // 일반적으로 starboard tack에서 양력은 -z (port) 쪽으로 향함.
  // perp1 = (-fz, 0, fx). starboard tack에서 fz<0 (-cos(TWA)는 음... 0<TWA<180에서 -sin(TWA)<0), 따라서 -fz>0... 즉 perp1 = (+, 0, ?). 너무 케이스를 신경쓰지 말고, 양력은 단면 노멀에 가까운 방향으로 부호 보정 (CL 부호로 자연스럽게 맞음).
  const liftDirX = -fz;
  const liftDirZ = fx;

  const stationForces = [];
  let totalFx = 0, totalFz = 0;
  let CEx = 0, CEy = 0, CEz = 0, totalMag = 0;

  const stations = geomData.stationData;
  const N = stations.length;

  for (let i = 0; i < N; i++) {
    const st = stations[i];
    // 단면의 코드 방향 (luff -> leech) 단위벡터
    const lx = Math.cos(st.angle);
    const lz = -Math.sin(st.angle);
    // 단면이 풍하측(camber bulge)으로 향하는 방향
    const nx = -Math.sin(st.angle);
    const nz = -Math.cos(st.angle);

    // 받음각: 단면의 코드선과 흐름 사이 각도.
    // 흐름 방향 (fx, fz). 코드선 (lx, lz).
    // alpha = atan2(cross, dot) 부호 있는 각도
    // cross_y = lx*fz - lz*fx (2D in xz plane)
    const dot = lx * fx + lz * fz;
    const cross = lx * fz - lz * fx;
    // 흐름이 코드 정면에서 약간 비스듬히 들어옴. alpha는 코드와 흐름 사이 양의 각도.
    // 흐름이 leech쪽에서 들어오는 경우 (downwind sail에서) dot<0
    let alpha = Math.atan2(cross, dot);
    // 정상적인 sail-in-wind에서는 흐름이 luff 쪽으로 들어오므로 alpha의 부호는 nx,nz와 일치해야 양력 +
    // 노멀과 흐름의 부호 일치 체크: 흐름이 노멀 반대쪽에서 오면 alpha를 부호 반전
    // alpha를 항상 [-π, π]로 두고, 양력 부호로 처리.

    const CL = liftCoeff(alpha, st.camber);
    const CD = dragCoeff(CL);

    // 단면별 면적: chord × dh.
    // dh는 각 station에 명시 가능 (jib처럼 span이 가변). 없으면 SAIL.luffLength/(N-1) 사용.
    const dh = st.dh ?? (SAIL.luffLength / (N - 1));
    const area = st.chord * dh;
    const q = 0.5 * AERO.airDensity * AWS * AWS;

    const dL = q * CL * area;
    const dD = q * CD * area;

    // 단면 힘 벡터 (xz 평면): lift는 흐름에 수직, drag는 흐름 방향.
    // lift 방향 부호는 alpha 부호와 단면 노멀로 결정.
    // 단순화: liftDir이 단면 노멀 (nx, nz)과 양의 dot를 갖도록 부호 정렬.
    const liftAlign = (liftDirX * nx + liftDirZ * nz) >= 0 ? 1 : -1;
    const lvx = liftDirX * liftAlign;
    const lvz = liftDirZ * liftAlign;

    const FxStation = dL * lvx + dD * fx;
    const FzStation = dL * lvz + dD * fz;

    totalFx += FxStation;
    totalFz += FzStation;

    // CE 가중치
    const mag = Math.hypot(FxStation, FzStation);
    const cx = (st.luff[0] + st.leech[0]) / 2;
    const cy = (st.luff[1] + st.leech[1]) / 2;
    const cz = (st.luff[2] + st.leech[2]) / 2;
    CEx += cx * mag;
    CEy += cy * mag;
    CEz += cz * mag;
    totalMag += mag;

    const isStalled = Math.abs(alpha + AERO.camberToAlpha0 * st.camber) > AERO.alphaStall;

    stationForces.push({
      alpha,
      alphaDeg: alpha * 180 / Math.PI,
      CL,
      CD,
      dL,
      dD,
      Fx: FxStation,
      Fz: FzStation,
      isStalled,
      h: st.h,
    });
  }

  const CE = totalMag > 0
    ? [CEx / totalMag, CEy / totalMag, CEz / totalMag]
    : [0, SAIL.luffLength / 2, SAIL.footLength / 3];

  // 합력 분해
  const totalForce = Math.hypot(totalFx, totalFz);
  const drag = totalFx * fx + totalFz * fz;          // 흐름 방향 성분
  const lift = -totalFx * fz + totalFz * fx;          // 흐름 수직 성분 (부호 무관)
  const drive = totalFx;                              // 보트 진행 방향(+x) 성분
  const heel = totalFz;                               // 횡력 (z 방향)

  return {
    total: {
      lift: Math.abs(lift),
      drag: Math.abs(drag),
      drive,
      heel,
      Fx: totalFx,
      Fz: totalFz,
      total: totalForce,
      liftDir: [-fz, 0, fx],
      dragDir: [fx, 0, fz],
    },
    stationForces,
    CE,
  };
}
