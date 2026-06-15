import { AnalysisResult, BacktestResult, ReportSummary, ScoreGroupStats } from '../../types';
import { log } from '../../utils';

const GROUP_SIZE = 10;

function buildScoreGroups(): { label: string; min: number; max: number }[] {
  const groups: { label: string; min: number; max: number }[] = [];
  for (let min = 0; min < 100; min += GROUP_SIZE) {
    const max = min + GROUP_SIZE;
    groups.push({ label: `${min}-${max}`, min, max });
  }
  return groups;
}

const SCORE_GROUPS = buildScoreGroups();

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

function hitRate(hit: number, total: number): number {
  return total > 0 ? parseFloat(((hit / total) * 100).toFixed(2)) : 0;
}

function buildGroupStats(results: BacktestResult[]): ScoreGroupStats[] {
  return SCORE_GROUPS.map(({ label, min, max }) => {
    const group = results.filter((r) => {
      const score = r.signal.score;
      return score >= min && (max === 100 ? score <= max : score < max);
    });
    const tp1Hit = group.filter((r) => r.tp1Reached).length;
    return {
      label,
      min,
      max,
      total:      group.length,
      tp1Hit,
      tp1HitRate: hitRate(tp1Hit, group.length),
    };
  });
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
  const tp1HitRate = hitRate(tp1Hit, results.length);
  const scoreGroups = buildGroupStats(results);

  log.ok(`Backtest tamamlandı. TP1 isabet: ${tp1Hit}/${results.length} (%${tp1HitRate})`);

  return {
    totalAnalyzed: results.length,
    tp1Hit,
    tp1HitRate,
    results,
    scoreGroups,
  };
}
