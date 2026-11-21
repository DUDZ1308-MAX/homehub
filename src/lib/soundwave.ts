export const SOUNDWAVE_CURVE_COUNT = 64;
export const SOUNDWAVE_WIDTH = 960;
export const SOUNDWAVE_HEIGHT = 190;
export const SOUNDWAVE_LANE_COUNT = 4;
export const SOUNDWAVE_LANE_HEIGHT = SOUNDWAVE_HEIGHT / SOUNDWAVE_LANE_COUNT;
export const SOUNDWAVE_CENTER = SOUNDWAVE_HEIGHT / 2;
export const SOUNDWAVE_OVERSCAN = 80;

export const SOUNDWAVE_GRADIENTS: string[][] = [
  ['#06b6d4', '#22d3ee', '#3b82f6'],
  ['#a855f7', '#c084fc', '#d8b4fe'],
  ['#ec4899', '#f472b6', '#fcd34d'],
  ['#fbbf24', '#fde047', '#f59e0b'],
  ['#10b981', '#34d399', '#22d3ee'],
];

export type SoundwaveBandId = 'voice' | 'bass' | 'treble' | 'rhythm';

export type SoundwaveBand = {
  id: SoundwaveBandId;
  label: string;
  accent: string;
  palette: string[];
  centerY: number;
  cycleScale: number;
  amplitudeScale: number;
};

const laneCenter = (index: number) =>
  ((index + 0.5) / SOUNDWAVE_LANE_COUNT) * SOUNDWAVE_HEIGHT;

export const SOUNDWAVE_BANDS: SoundwaveBand[] = [
  {
    id: 'voice',
    label: 'Voice',
    accent: '#f472b6',
    palette: ['#c084fc', '#a855f7', '#d946ef', '#ec4899', '#f472b6'],
    centerY: laneCenter(0),
    cycleScale: 1,
    amplitudeScale: 0.9,
  },
  {
    id: 'bass',
    label: 'Bass',
    accent: '#38bdf8',
    palette: ['#22d3ee', '#0ea5e9', '#3b82f6', '#4f46e5', '#6366f1'],
    centerY: laneCenter(1),
    cycleScale: 0.72,
    amplitudeScale: 1,
  },
  {
    id: 'treble',
    label: 'Treble',
    accent: '#fbbf24',
    palette: ['#fde047', '#facc15', '#f59e0b', '#f97316', '#fb923c'],
    centerY: laneCenter(2),
    cycleScale: 1.55,
    amplitudeScale: 0.78,
  },
  {
    id: 'rhythm',
    label: 'Rhythm',
    accent: '#4ade80',
    palette: ['#a3e635', '#4ade80', '#22c55e', '#10b981', '#2dd4bf'],
    centerY: laneCenter(3),
    cycleScale: 1.15,
    amplitudeScale: 0.88,
  },
];

export type SoundwaveCurve = {
  path: string;
  band: SoundwaveBandId;
  bandIndex: number;
  centerY: number;
  opacity: number;
  strokeWidth: number;
};

const families = [
  { center: 0.12, width: 0.16, amplitude: 30 },
  { center: 0.25, width: 0.12, amplitude: 50 },
  { center: 0.38, width: 0.1, amplitude: 48 },
  { center: 0.51, width: 0.1, amplitude: 68 },
  { center: 0.6, width: 0.095, amplitude: 82 },
  { center: 0.7, width: 0.11, amplitude: 58 },
  { center: 0.81, width: 0.1, amplitude: 52 },
  { center: 0.91, width: 0.08, amplitude: 38 },
];

const seeded = (index: number, salt: number) => {
  const value =
    Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

const wavePacket = (
  x: number,
  center: number,
  width: number,
  cycles: number,
  phase: number
) =>
  Math.exp(-Math.pow((x - center) / width, 2)) *
  Math.cos(2 * Math.PI * cycles * ((x - center) / width) + phase);

const smoothPath = (points: [number, number][]) => {
  let path = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const control1X = current[0] + (next[0] - previous[0]) / 6;
    const control1Y = current[1] + (next[1] - previous[1]) / 6;
    const control2X = next[0] - (after[0] - current[0]) / 6;
    const control2Y = next[1] - (after[1] - current[1]) / 6;
    path += `C${control1X.toFixed(2)},${control1Y.toFixed(2)} ${control2X.toFixed(2)},${control2Y.toFixed(2)} ${next[0].toFixed(2)},${next[1].toFixed(2)}`;
  }
  return path;
};

const drawWidth = SOUNDWAVE_WIDTH + SOUNDWAVE_OVERSCAN * 2;

const buildCurves = () =>
  Array.from({ length: SOUNDWAVE_CURVE_COUNT }, (_, index) => {
    const bandIndex = Math.floor(
      index / (SOUNDWAVE_CURVE_COUNT / SOUNDWAVE_LANE_COUNT)
    );
    const band = SOUNDWAVE_BANDS[bandIndex];
    const family = families[
      (index * 3 + bandIndex * 5) % families.length
    ];
    const center = family.center + (seeded(index, 1) - 0.5) * 0.035;
    const width = family.width * (0.8 + seeded(index, 2) * 0.7);
    const cycles =
      (0.46 + seeded(index, 3) * 0.42) * band.cycleScale;
    const phase =
      seeded(index, 4) > 0.72 ? Math.PI : (seeded(index, 4) - 0.5) * 0.6;
    const rawAmplitude = family.amplitude * (0.5 + seeded(index, 5) * 0.7);
    const secondaryFamily =
      families[(index * 3 + 2) % families.length];
    const secondaryCenter =
      secondaryFamily.center + (seeded(index, 6) - 0.5) * 0.06;
    const secondaryWidth =
      secondaryFamily.width * (0.9 + seeded(index, 7) * 0.9);
    const secondaryCycles =
      (0.45 + seeded(index, 8) * 0.5) * band.cycleScale;
    const secondaryPhase = seeded(index, 9) > 0.6 ? Math.PI : 0;
    const secondaryAmplitude =
      rawAmplitude *
      (0.12 + seeded(index, 10) * 0.32) *
      (seeded(index, 11) > 0.45 ? 1 : -1);
    const flowFrequency = 0.55 + seeded(index, 12) * 0.8;
    const flowPhase = (seeded(index, 13) - 0.5) * Math.PI * 2;
    const flowAmplitude = rawAmplitude * (0.08 + seeded(index, 14) * 0.16);
    const offset = (seeded(index, 15) - 0.5) * 2.6;
    const raw: number[] = [];
    let peak = 0;
    for (let sample = 0; sample <= 56; sample += 1) {
      const t = sample / 56;
      const primary =
        wavePacket(t, center, width, cycles, phase) * rawAmplitude;
      const secondary =
        wavePacket(
          t,
          secondaryCenter,
          secondaryWidth,
          secondaryCycles,
          secondaryPhase
        ) * secondaryAmplitude;
      const flow =
        Math.sin(2 * Math.PI * flowFrequency * t + flowPhase) * flowAmplitude;
      const value = primary + secondary + flow;
      raw.push(value);
      peak = Math.max(peak, Math.abs(value));
    }
    const maxAmplitude =
      SOUNDWAVE_LANE_HEIGHT * 0.4 * band.amplitudeScale;
    const scale = peak > maxAmplitude ? maxAmplitude / peak : 1;
    const points = raw.map((value, sample) => {
      const t = sample / 56;
      const edge = Math.pow(Math.sin(Math.PI * t), 0.38);
      return [
        -SOUNDWAVE_OVERSCAN + t * drawWidth,
        band.centerY + (offset + value * scale) * edge,
      ] as [number, number];
    });
    return {
      path: smoothPath(points),
      band: band.id,
      bandIndex,
      centerY: band.centerY,
      opacity: 0.42 + (index % 6) * 0.075,
      strokeWidth: 1.2 + (index % 5) * 0.08,
    };
  });

export const SOUNDWAVE_CURVES = buildCurves();
