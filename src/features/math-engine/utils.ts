import { Candle } from '../../types';

// ─── ATR ──────────────────────────────────────────────────────────────────────
// True Range: bir mumun "gerçek" hareket aralığı. Önceki kapanışla gap'i de hesaba katar.
export function calculateATR(candles: Candle[], period: number): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  const slice = trueRanges.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

// ─── VOLUME ───────────────────────────────────────────────────────────────────
/** Son `period` mumun ortalama hacmi (mevcut mum hariç). */
export function calculateAverageVolume(candles: Candle[], period: number): number {
  if (candles.length < period + 1) return 0;

  const past = candles.slice(-(period + 1), -1);
  return past.reduce((sum, c) => sum + c.volume, 0) / period;
}

export function getCurrentVolume(candles: Candle[]): number {
  if (candles.length === 0) return 0;
  return candles[candles.length - 1].volume;
}
