'use client';

import { COLORS } from '@/lib/constants';
import { Arrow } from './WindField';

const FORCE_SCALE = 0.0008; // N -> m 표시 스케일

export function ForceArrows({ forces, wind }) {
  if (!forces || !forces.total) return null;
  const { CE } = forces;
  const { lift, drag, drive, heel, liftDir, dragDir } = forces.total;

  // 양력·항력
  const liftLen = Math.min(8, Math.max(0.4, lift * FORCE_SCALE));
  const dragLen = Math.min(8, Math.max(0.2, drag * FORCE_SCALE));

  // drive (x축), heel (z축)
  const driveLen = Math.min(8, Math.max(0.2, Math.abs(drive) * FORCE_SCALE));
  const heelLen = Math.min(8, Math.max(0.2, Math.abs(heel) * FORCE_SCALE));

  const driveDir = drive >= 0 ? [1, 0, 0] : [-1, 0, 0];
  const heelDir = heel >= 0 ? [0, 0, 1] : [0, 0, -1];

  return (
    <group>
      {/* Lift */}
      <Arrow
        from={CE}
        dir={liftDir}
        length={liftLen}
        color={COLORS.lift}
        label={`Lift ${(lift / 1).toFixed(0)} N`}
        headSize={0.5}
      />
      {/* Drag */}
      <Arrow
        from={CE}
        dir={dragDir}
        length={dragLen}
        color={COLORS.drag}
        label={`Drag ${(drag / 1).toFixed(0)} N`}
        headSize={0.4}
      />
      {/* Drive (보트 진행방향) */}
      <Arrow
        from={[CE[0], 0.5, CE[2]]}
        dir={driveDir}
        length={driveLen}
        color={COLORS.drive}
        label={`Drive ${drive.toFixed(0)} N`}
        headSize={0.5}
      />
      {/* Heeling */}
      <Arrow
        from={[CE[0], 0.5, CE[2]]}
        dir={heelDir}
        length={heelLen}
        color={COLORS.heel}
        label={`Heel ${heel.toFixed(0)} N`}
        headSize={0.5}
      />
    </group>
  );
}
