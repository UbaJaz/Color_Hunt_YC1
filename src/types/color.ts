/**
 * Shared color primitives.
 *
 * `RGB` and `Region` are re-exported directly from `@color-science`
 * (packages/color-science) rather than redeclared here, so there is a
 * single source of truth for these shapes and no drift is possible between
 * the app and the algorithm package.
 */
export type { RGB, Region } from '@color-science';
import type { RGB } from '@color-science';

export interface TargetColor {
  id: string;
  name: string;
  hex: string;
  rgb: RGB;
}
