// 하루 시각(0~24h)에서 태양 방향·색·조명 세기를 계산.
// 결과는 Sky, directionalLight, Water(Ocean), fog가 공유한다.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function toHex([r, g, b]) {
  const h = (x) => clamp(Math.round(x * 255), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * @param {number} hour 0~24 (6=일출, 12=정오, 18=일몰, 0/24=자정)
 * @returns {{
 *   dir:[x,y,z],          // 태양 방향 단위벡터 (y up)
 *   sunColor:string,      // 햇빛 색 (hex)
 *   sunIntensity:number,  // directional light 세기
 *   ambient:number, hemi:number,
 *   fogColor:string,      // 수평선/안개 색
 *   up:number,            // 태양 고도 factor 0(밤/수평선)~1(정오)
 *   turbidity:number, rayleigh:number, // drei Sky 파라미터
 * }}
 */
export function computeSun(hour) {
  const dayPhase = (hour - 6) / 12;                  // 0=일출, 1=일몰
  const elevation = Math.sin(dayPhase * Math.PI) * (Math.PI * 0.46); // rad, 밤엔 음수
  const azimuth = (dayPhase - 0.5) * Math.PI * 1.15; // 동→서 스윕
  const cosEl = Math.cos(elevation);
  const sinEl = Math.sin(elevation);
  const dir = [cosEl * Math.sin(azimuth), sinEl, -cosEl * Math.cos(azimuth)];

  const up = clamp(sinEl, 0, 1);
  const t = Math.pow(up, 0.5);

  // 햇빛 색: 낮은 고도=따뜻한 주황, 정오=거의 흰색
  const sunColor = toHex(mix3([1.0, 0.45, 0.18], [1.0, 0.95, 0.88], t));

  const sunIntensity = 0.05 + up * 1.8;
  const ambient = 0.10 + up * 0.28;
  const hemi = 0.14 + up * 0.42;

  // 안개/수평선 색: 밤=짙은 남색, 낮=옅은 청회색, 저녁/새벽=따뜻한 기운
  let fog = mix3([0.05, 0.08, 0.13], [0.55, 0.66, 0.74], Math.pow(up, 0.7));
  const lowSun = clamp(1 - up, 0, 1) * clamp(up * 4, 0, 1); // 일출/일몰에서 최대
  fog = mix3(fog, [0.85, 0.55, 0.40], lowSun * 0.45);
  const fogColor = toHex(fog);

  const turbidity = 2 + (1 - up) * 8;
  const rayleigh = 0.6 + (1 - up) * 2.8;

  return { dir, sunColor, sunIntensity, ambient, hemi, fogColor, up, turbidity, rayleigh };
}
