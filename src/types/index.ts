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
  trainCandles: Candle[];   // ilk 750
  testCandles: Candle[];    // son 250
}

export interface BacktestResult {
  symbol: string;
  signal: TradeSignal;
  tp1Reached: boolean;
  tp1ReachedAt?: number; // candle openTime
  highestPrice: number;
  lowestPrice: number;
}

export interface ReportSummary {
  totalAnalyzed: number;
  tp1Hit: number;
  tp1HitRate: number; // yüzde
  results: BacktestResult[];
}
