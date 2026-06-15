import { Candle, TradeSignal } from '../../types';
import {
  calculateATR,
  calculateBollingerBandwidth,
  evaluateVolatility,
  calculateFibonacciLevels,
  evaluateProximityToFibo,
  calculateOBV,
  checkOBVDivergence,
  calculateRSI,
  calculateMACD,
  shouldRejectForMeanExtension,
  shouldRejectFallingKnife,
  detectVTypeReversal,
} from './utils';

// =====================================================================
// ANA TİCARET ALGORİTMASI (Her 4 saatlik mum kapandığında tetiklenir)
// =====================================================================
export function calculateTradeScore(candles: Candle[]): TradeSignal {

  const currentCandle = candles[candles.length - 1];
  const currentPrice  = currentCandle.close;

  // =====================================================================
  // 1. "JÜRİ BAŞKANI" - VOLATİLİTE VE ÇARPAN SİSTEMİ
  // =====================================================================
  const atr       = calculateATR(candles, 14);
  const bandwidth = calculateBollingerBandwidth(candles, 20);

  // Hacimsiz piyasada puanı düşüren, kırılımda puanı uçuran çarpan (0.1 - 1.5)
  const volatilityMultiplier = evaluateVolatility(atr, bandwidth);

  // =====================================================================
  // 2. ANA PUANLAYICILAR (Her biri 0 - 100 arası Base Score üretir)
  // =====================================================================

  // A. Fibonacci Puanı (Balina maliyetlenme bölgeleri)
  const fiboLevels = calculateFibonacciLevels(candles);
  const fiboScore  = evaluateProximityToFibo(currentPrice, fiboLevels);

  // B. OBV Puanı (Fiyat-Hacim uyumsuzluğu / Gizli mal toplama)
  const obv         = calculateOBV(candles);
  const volumeScore = checkOBVDivergence(candles, obv) ? 100 : 20;

  // C. RSI Puanı (Aşırı satım / Ucuzluk)
  const rsi      = calculateRSI(candles, 14);
  const rsiScore = (rsi < 30) ? 90 : (rsi > 70) ? 10 : 50;

  // D. MACD Puanı (Kısa vade trend dönüş onayı)
  const macd      = calculateMACD(candles, 12, 26, 9);
  const macdScore = (macd.histogram > 0 && macd.macdLine > macd.signalLine) ? 80 : 20;

  // =====================================================================
  // 3. AĞIRLIKLI ORTALAMA HESABI (Weighted Score)
  // =====================================================================
  const WEIGHTS = {
    fibo:   0.40,
    volume: 0.30,
    rsi:    0.15,
    macd:   0.15,
  };

  const baseScore =
    (fiboScore   * WEIGHTS.fibo)   +
    (volumeScore * WEIGHTS.volume) +
    (rsiScore    * WEIGHTS.rsi)    +
    (macdScore   * WEIGHTS.macd);

  let finalScore = Math.min(baseScore * volatilityMultiplier, 100);

  // Ortalamadan aşırı uzaklaşma filtresi: pump tepesinde skoru sıfırla
  if (shouldRejectForMeanExtension(candles, currentPrice)) {
    finalScore = 0;
  }

  // Düşen bıçak vs. V-Tipi dönüş: çekiç mumu diğer kuralları ezer
  const isCapitulation = detectVTypeReversal(candles, atr, 20);
  const isFallingKnife = shouldRejectFallingKnife(candles, atr, 12);

  if (isCapitulation) {
    finalScore = 100;
  } else if (isFallingKnife) {
    finalScore = 0;
  }

  // =====================================================================
  // 4. DİNAMİK HEDEF VE STOP BELİRLEME (ATR Tabanlı)
  // =====================================================================
  const calculatedStop = currentPrice - (atr * 1.5);

  const calculatedTPs = {
    tp1: currentPrice + (atr * 1.5),
    tp2: currentPrice + (atr * 3.0),
    tp3: currentPrice + (atr * 5.0),
  };

  return {
    score:       finalScore,
    entryPrice:  currentPrice,
    stopLoss:    calculatedStop,
    takeProfits: calculatedTPs,
  };
}
