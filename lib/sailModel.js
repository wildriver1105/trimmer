// 트림 매개변수 -> 단면별 세일 형상 매개변수 매핑.
// 좌표계 (씬 기준):
//   x: 보트 진행방향 (앞 +)
//   y: 위 (헤드 +)
//   z: 보트 좌우 (좌현 +)
// 메인세일은 마스트(z=0, x=0)에서 leech(앞쪽) 방향으로 펼쳐진다.
// boom angle = boom이 보트 중심선(x축, 즉 leech가 정확히 앞 방향)으로부터 풍하쪽으로 벌어진 각도(rad).

import { SAIL, TRIM_EFFECTS, RIG } from './constants';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * 트림 입력에서 세일 형상 기술자를 만든다.
 *
 * 반환:
 *   {
 *     boomAngle: number,          // y축 주위 boom 회전 (rad). +면 풍하쪽으로 벌어짐
 *     mastBend: number,           // 마스트 끝이 뒤쪽(+x 반대=-x)으로 휘는 양 (m)
 *     stations: [                 // foot(0)에서 head(1)까지 N개 단면
 *       { h, chord, camber, draftPos, twist }, ...
 *     ]
 *   }
 *   여기서 twist는 boom 평면 대비 단면의 추가 풍하 회전 (rad, foot=0, head=최대).
 */
export function buildSailShape(trim) {
  const { outhaul, cunningham, halyard, backstay, vang, sheet, traveler } = trim;

  // boom angle: sheet=1 (in)이면 boom이 거의 0도, sheet=0이면 sheetEaseMaxAngle.
  const sheetAngle = lerp(TRIM_EFFECTS.sheetEaseMaxAngle, 0.05, sheet);
  // traveler: -1=leeward(boom 더 벌어짐), +1=windward(중심선 안쪽).
  // 단순화: traveler가 boom angle을 -traveler * sheetToBoomAngle 만큼 추가.
  const boomAngle = sheetAngle - traveler * TRIM_EFFECTS.travelerToBoomAngle;

  // 총 twist (foot vs head AoA 차이): vang 풀수록 + sheet ease할수록 증가
  const baseTwist = TRIM_EFFECTS.vangBaseTwist + (1 - vang) * TRIM_EFFECTS.vangToTwist * -1;
  const twistTotal = clamp(baseTwist + (1 - sheet) * TRIM_EFFECTS.sheetEaseToTwist, 0, 1.2);

  // 마스트 벤드: backstay에 비례, 최대 시 마스트 끝이 0.35m 뒤로
  const mastBend = backstay * TRIM_EFFECTS.backstayToMastBend;

  // 드래프트 위치
  const draftBase = SAIL.defaultDraftPos
    + cunningham * TRIM_EFFECTS.cunninghamToDraftPos
    + halyard * TRIM_EFFECTS.halyardToDraftPos;

  const N = SAIL.spanStations;
  const stations = [];
  for (let i = 0; i < N; i++) {
    const h = i / (N - 1); // 0=foot, 1=head
    // 코드 길이: 삼각형 — foot에서 head로 갈수록 감소 (headWidth로 끝).
    const chord = lerp(SAIL.footLength, SAIL.headWidth, h);

    // 캠버: outhaul은 하단에 강하게, backstay는 상단에 강하게
    const outhaulFactor = (1 - h);   // foot 근처에서 강함
    const backstayFactor = h;        // head 근처에서 강함
    const camber = clamp(
      SAIL.defaultCamber
        + outhaul * TRIM_EFFECTS.outhaulToFootCamber * outhaulFactor
        + backstay * (TRIM_EFFECTS.backstayToUpperCamber * backstayFactor
                    + TRIM_EFFECTS.backstayToLowerCamber * (1 - backstayFactor)),
      0.02, 0.22
    );

    // 드래프트 위치는 거의 균일 (cunningham/halyard로 이동)
    const draftPos = clamp(draftBase, 0.20, 0.70);

    // 단면별 twist: 높을수록(head 쪽) 풍하로 더 열림.
    // 2차 곡선으로 부드럽게: foot 근처 거의 0, head에서 최대.
    const twist = twistTotal * (h * h);

    stations.push({ h, chord, camber, draftPos, twist });
  }

  return { boomAngle, mastBend, stations };
}
