/** Keep the existing physical-pixel allowance without multiplying it again
 * by display density. A 3× display needs 2× CSS oversampling, not 6×. */
export const standeeRasterScale = (pixelRatio: number, allowance: number) =>
  Math.max(1, allowance / (Number.isFinite(pixelRatio) ? Math.max(1, pixelRatio) : 1));
