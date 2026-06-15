import { AnalysisResult, BacktestResult, ReportSummary } from '../../types';
import { log } from '../../utils';

// Test mumlarında fiyat TP1'e ulaştı mı?
function didReachTP1(testCandles: AnalysisResult['testCandles'], tp1: number): {
  reached: boolean;
  reachedAt?: number;
  highestPrice: number;
  lowestPrice: number;
} {
  let highestPrice = -Infinity;
  let lowestPrice  =  Infinity;

  for (const candle of testCandles) {
    if (candle.high > highestPrice) highestPrice = candle.high;
    if (candle.low  < lowestPrice)  lowestPrice  = candle.low;

    // Mumun high'ı TP1'e değdi mi?
    if (candle.high >= tp1) {
      return {
        reached:      true,
        reachedAt:    candle.openTime,
        highestPrice,
        lowestPrice,
      };
    }
  }

  return { reached: false, highestPrice, lowestPrice };
}

export function runBacktest(analysisResults: AnalysisResult[]): ReportSummary {
  log.info(`${analysisResults.length} sinyal için backtest başlatılıyor...`);

  const results: BacktestResult[] = [];

  for (const item of analysisResults) {
    const tp1    = item.signal.takeProfits.tp1;
    const result = didReachTP1(item.testCandles, tp1);

    results.push({
      symbol:       item.symbol,
      signal:       item.signal,
      tp1Reached:   result.reached,
      tp1ReachedAt: result.reachedAt,
      highestPrice: result.highestPrice,
      lowestPrice:  result.lowestPrice,
    });
  }

  const tp1Hit     = results.filter((r) => r.tp1Reached).length;
  const tp1HitRate = results.length > 0
    ? parseFloat(((tp1Hit / results.length) * 100).toFixed(2))
    : 0;

  log.ok(`Backtest tamamlandı. TP1 isabet: ${tp1Hit}/${results.length} (%${tp1HitRate})`);

  return {
    totalAnalyzed: results.length,
    tp1Hit,
    tp1HitRate,
    results,
  };
}
