import { Candle } from '../../types';

// ─── ATR ──────────────────────────────────────────────────────────────────────
// True Range: bir mumun "gerçek" hareket aralığı. Önceki kapanışla gap'i de hesaba katar.
export function calculateATR(candles: Candle[], period: number): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high  = candles[i].high;
    const low   = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low  - prevClose)
    );
    trueRanges.push(tr);
  }

  // Son `period` adet TR'nin ortalaması
  const slice = trueRanges.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

// ─── SMA ──────────────────────────────────────────────────────────────────────
function calculateSMA(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / period);
  }
  return result;
}

// ─── BOLLINGER BANDWIDTH ──────────────────────────────────────────────────────
// Bantların genişliği: sıkışma (düşük) → kırılım (yüksek) sinyali verir.
export function calculateBollingerBandwidth(candles: Candle[], period: number): number {
  if (candles.length < period) return 0;

  const closes = candles.slice(-period).map((c) => c.close);
  const sma = closes.reduce((s, v) => s + v, 0) / period;

  const variance = closes.reduce((s, v) => s + Math.pow(v - sma, 2), 0) / period;
  const stdDev   = Math.sqrt(variance);

  const upperBand = sma + 2 * stdDev;
  const lowerBand = sma - 2 * stdDev;

  // Normalize: bandwidth = (upper - lower) / middle
  return sma !== 0 ? (upperBand - lowerBand) / sma : 0;
}

// ─── VOLATILITY MULTIPLIER ────────────────────────────────────────────────────
// ATR yüksek + bant geniş = kırılım beklentisi → çarpan artar
// ATR düşük  + bant dar   = sıkışma             → çarpan düşer
export function evaluateVolatility(atr: number, bandwidth: number): number {
  // bandwidth genellikle 0.01 – 0.15 arasında olur
  // atr/bandwidth kombinasyonuna göre 0.1 ile 1.5 arasında normalize ediyoruz
  const raw = bandwidth * 10; // 0.01 → 0.1, 0.15 → 1.5
  return Math.min(Math.max(raw, 0.1), 1.5);
}

// ─── FIBONACCI ────────────────────────────────────────────────────────────────
// Son N mumun swing high/low'una göre Fibonacci geri çekilme seviyeleri
export interface FiboLevels {
  swingHigh: number;
  swingLow: number;
  level236: number;
  level382: number;
  level500: number;
  level618: number;
  level786: number;
}

export function calculateFibonacciLevels(candles: Candle[], lookback = 50): FiboLevels {
  const slice = candles.slice(-lookback);
  const swingHigh = Math.max(...slice.map((c) => c.high));
  const swingLow  = Math.min(...slice.map((c) => c.low));
  const range     = swingHigh - swingLow;

  return {
    swingHigh,
    swingLow,
    level236: swingHigh - range * 0.236,
    level382: swingHigh - range * 0.382,
    level500: swingHigh - range * 0.500,
    level618: swingHigh - range * 0.618,
    level786: swingHigh - range * 0.786,
  };
}

// Fiyat ne kadar Fibonacci seviyesine yakınsa o kadar yüksek puan
export function evaluateProximityToFibo(price: number, levels: FiboLevels): number {
  const keyLevels = [
    levels.level382,
    levels.level500,
    levels.level618,
    levels.level786,
  ];

  const range = levels.swingHigh - levels.swingLow;
  if (range === 0) return 0;

  // Her seviyeye olan mesafeyi yüzde olarak hesapla; en yakın seviyeyi al
  const distances = keyLevels.map((lvl) => Math.abs(price - lvl) / range);
  const minDistance = Math.min(...distances);

  // %5 içindeyse 100, %20 uzaksa 0 olacak şekilde lineer interpolasyon
  const score = Math.max(0, 1 - minDistance / 0.20) * 100;
  return Math.min(score, 100);
}

// ─── OBV ──────────────────────────────────────────────────────────────────────
// On-Balance Volume: hacim fiyat yönüne göre birikir.
// Fiyat düşerken OBV artıyorsa → gizli alım (bullish divergence)
export function calculateOBV(candles: Candle[]): number[] {
  const obv: number[] = [0];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i].close;
    const vol  = candles[i].volume;

    if (curr > prev)      obv.push(obv[i - 1] + vol);
    else if (curr < prev) obv.push(obv[i - 1] - vol);
    else                  obv.push(obv[i - 1]);
  }

  return obv;
}

// Son N mumda fiyat düşüyor ama OBV artıyorsa → bullish divergence
export function checkOBVDivergence(candles: Candle[], obv: number[], lookback = 20): boolean {
  if (candles.length < lookback) return false;

  const recentCandles = candles.slice(-lookback);
  const recentOBV     = obv.slice(-lookback);

  const firstClose = recentCandles[0].close;
  const lastClose  = recentCandles[recentCandles.length - 1].close;

  const firstOBV = recentOBV[0];
  const lastOBV  = recentOBV[recentOBV.length - 1];

  // Fiyat düşüyor ama OBV artıyor = gizli birikim
  return lastClose < firstClose && lastOBV > firstOBV;
}

// ─── RSI ──────────────────────────────────────────────────────────────────────
export function calculateRSI(candles: Candle[], period: number): number {
  if (candles.length < period + 1) return 50;

  const closes  = candles.map((c) => c.close);
  const changes = closes.slice(1).map((c, i) => c - closes[i]);

  const gains  = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));

  // İlk ortalama
  let avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;

  // Wilder smoothing (gerisi)
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─── MACD ─────────────────────────────────────────────────────────────────────
export interface MACDResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

function calculateEMA(values: number[], period: number): number[] {
  const k      = 2 / (period + 1);
  const ema: number[] = [];
  let prev = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  ema.push(prev);

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    ema.push(prev);
  }

  return ema;
}

export function calculateMACD(
  candles: Candle[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MACDResult {
  const closes = candles.map((c) => c.close);

  if (closes.length < slowPeriod + signalPeriod) {
    return { macdLine: 0, signalLine: 0, histogram: 0 };
  }

  const fastEMA   = calculateEMA(closes, fastPeriod);
  const slowEMA   = calculateEMA(closes, slowPeriod);

  // EMA uzunlukları farklı; ortak noktadan itibaren fark al
  const offset    = fastEMA.length - slowEMA.length;
  const macdLine  = fastEMA.slice(offset).map((v, i) => v - slowEMA[i]);

  const signal    = calculateEMA(macdLine, signalPeriod);
  const lastMACD  = macdLine[macdLine.length - 1];
  const lastSig   = signal[signal.length - 1];

  return {
    macdLine:   lastMACD,
    signalLine: lastSig,
    histogram:  lastMACD - lastSig,
  };
}
