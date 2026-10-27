import type { Dye } from '../engine/shades.ts';

export interface DyeLook {
  name: string;
  letter: string;
  /** Tailwind background class. */
  fill: string;
  /** Text class with enough contrast on `fill`. */
  ink: string;
}

/** Colours come from historical dye plants (madder, weld, woad); names stay plain for legibility. */
export const DYE_LOOKS: readonly DyeLook[] = [
  { name: 'Red', letter: 'R', fill: 'bg-madder', ink: 'text-cloth' },
  { name: 'Yellow', letter: 'Y', fill: 'bg-weld', ink: 'text-slate-deep' },
  { name: 'Blue', letter: 'B', fill: 'bg-woad', ink: 'text-cloth' },
];

export function dyeLook(dye: Dye): DyeLook {
  return DYE_LOOKS[dye];
}

/** Every cloth has a name so players can follow one across seasons. */
export const CLOTH_NAMES: readonly string[] = [
  'Calico', 'Chintz', 'Damask', 'Gingham', 'Muslin', 'Percale',
  'Poplin', 'Lawn', 'Voile', 'Serge', 'Twill', 'Tweed',
  'Velvet', 'Linen', 'Hessian', 'Crepe', 'Batiste', 'Cambric',
];

export function clothName(clothId: number): string {
  return CLOTH_NAMES[clothId] ?? `Cloth ${clothId + 1}`;
}
