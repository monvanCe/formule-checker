import { Candle, OrderBookWalls, TradeSignal } from '../../types';
import {
  calculateATR,
  calculateAverageVolume,
  getCurrentVolume,
} from './utils';

/** Hacim filtresi: mevcut mum ≥ son 20 mum ortalamasının 1.5 katı */
const VOLUME_LOOKBACK = 20;
const VOLUME_MULTIPLIER = 1.5;

/** ATR / fiyat oranı bu eşiğin altındaysa piyasa hareketsiz sayılır */
const MIN_ATR_RATIO = 0.005; // %0.5

/** Alım–satım duvarı arası minimum marj */
const MIN_WALL_SPREAD_PCT = 10;

/** Fiyat, alım duvarına en fazla %20 uzaklıkta olmalı (range içinde) */
const MAX_BUY_WALL_PROXIMITY = 0.20;

const ATR_PERIOD = 14;

function zeroSignal(entryPrice: number): TradeSignal {
  return {
    score: 0,
    entryPrice,
    stopLoss: 0,
    takeProfits: { tp1: 0, tp2: 0, tp3: 0 },
  };
}

function buildTargets(
  entryPrice: number,
  buyWallPrice: number,
  sellWallPrice: number
): TradeSignal {
  const stopLoss = buyWallPrice * 0.99;       // buy wall %1 altı
  const tp1 = sellWallPrice * 0.95;           // sell wall %5 altı
  const tp2 = sellWallPrice * 0.99;           // sell wall %1 altı
  const tp3 = sellWallPrice;                  // duvarın kendisi (rapor uyumu)

  return {
    score: 100,
    entryPrice,
    stopLoss,
    takeProfits: { tp1, tp2, tp3 },
  };
}

/**
 * Likidite & hacim odaklı ticaret skoru.
 * Kuralların tümü geçerse 100, aksi halde 0 döner.
 */
export function calculateLiquidityScore(
  candles: Candle[],
  walls: OrderBookWalls
): TradeSignal {
  if (candles.length === 0) return zeroSignal(0);

  const currentPrice = candles[candles.length - 1].close;
  const { buyWallPrice, sellWallPrice } = walls;

  if (
    !Number.isFinite(buyWallPrice) ||
    !Number.isFinite(sellWallPrice) ||
    buyWallPrice <= 0 ||
    sellWallPrice <= buyWallPrice
  ) {
    return zeroSignal(currentPrice);
  }

  // ── KURAL 1: Hacim ve zombi tahta filtresi ─────────────────────────────
  const atr = calculateATR(candles, ATR_PERIOD);
  const atrRatio = currentPrice > 0 ? atr / currentPrice : 0;
  const avgVolume = calculateAverageVolume(candles, VOLUME_LOOKBACK);
  const currentVolume = getCurrentVolume(candles);

  const hasVolumeSpike =
    avgVolume > 0 && currentVolume >= avgVolume * VOLUME_MULTIPLIER;
  const hasEnoughVolatility = atrRatio >= MIN_ATR_RATIO;

  if (!hasVolumeSpike || !hasEnoughVolatility) {
    return zeroSignal(currentPrice);
  }

  // ── KURAL 2: Minimum marj (duvarlar arası spread) ──────────────────────
  const spreadPct = ((sellWallPrice - buyWallPrice) / buyWallPrice) * 100;
  if (spreadPct < MIN_WALL_SPREAD_PCT) {
    return zeroSignal(currentPrice);
  }

  // ── KURAL 3: %80/20 yakınlık oranı ─────────────────────────────────────
  // Fiyat, buy→sell aralığının en fazla %20'si kadar alım duvarından uzak olmalı.
  const range = sellWallPrice - buyWallPrice;
  const proximityFromBuy = (currentPrice - buyWallPrice) / range;

  if (proximityFromBuy > MAX_BUY_WALL_PROXIMITY) {
    return zeroSignal(currentPrice);
  }

  // ── Hedef ve stop ──────────────────────────────────────────────────────
  return buildTargets(currentPrice, buyWallPrice, sellWallPrice);
}

/** Geriye dönük uyumluluk alias'ı */
export const calculateTradeScore = calculateLiquidityScore;
