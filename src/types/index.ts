export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  score: number;
  entryPrice: number;
  stopLoss: number;
  takeProfits: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
}

export interface SymbolKlineData {
  symbol: string;
  candles: Candle[];
}

export interface AnalysisResult {
  symbol: string;
  signal: TradeSignal;
  trainCandles: Candle[];
  testCandles: Candle[];
}

export interface BacktestResult {
  symbol: string;
  signal: TradeSignal;
  tp1Reached: boolean;
  tp1ReachedAt?: number;
  highestPrice: number;
  lowestPrice: number;
}

export interface ScoreGroupStats {
  label: string;
  min: number;
  max: number;
  total: number;
  tp1Hit: number;
  tp1HitRate: number;
}

export interface ReportSummary {
  totalAnalyzed: number;
  tp1Hit: number;
  tp1HitRate: number;
  results: BacktestResult[];
  scoreGroups: ScoreGroupStats[];
}
