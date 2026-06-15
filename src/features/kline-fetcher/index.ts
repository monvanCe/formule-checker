import { Candle, SymbolKlineData } from '../../types';
import { sleep, log } from '../../utils';

const BINANCE_KLINE_URL = 'https://api.binance.com/api/v3/klines';
const INTERVAL = '4h';
const LIMIT = 1000;
const RATE_LIMIT_MS = 1000; // saniyede 1 istek

type RawKline = [
  number,  // [0] openTime
  string,  // [1] open
  string,  // [2] high
  string,  // [3] low
  string,  // [4] close
  string,  // [5] volume
  number,  // [6] closeTime
  ...unknown[]
];

async function fetchKlinesForSymbol(symbol: string): Promise<Candle[]> {
  const url = `${BINANCE_KLINE_URL}?symbol=${symbol}&interval=${INTERVAL}&limit=${LIMIT}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Kline çekme hatası [${symbol}]: ${response.status} ${response.statusText}`);
  }

  const raw = await response.json() as RawKline[];

  return raw.map((k) => ({
    openTime: k[0],
    open:     parseFloat(k[1]),
    high:     parseFloat(k[2]),
    low:      parseFloat(k[3]),
    close:    parseFloat(k[4]),
    volume:   parseFloat(k[5]),
  }));
}

export async function fetchAllKlines(symbols: string[]): Promise<SymbolKlineData[]> {
  const results: SymbolKlineData[] = [];
  const total = symbols.length;

  log.info(`${total} sembol için kline verisi çekiliyor (${INTERVAL}, ${LIMIT} mum, saniyede 1 istek)...`);
  log.info(`Tahmini süre: ~${Math.ceil(total / 60)} dakika`);

  for (let i = 0; i < total; i++) {
    const symbol = symbols[i];
    const progress = `[${i + 1}/${total}]`;

    try {
      const candles = await fetchKlinesForSymbol(symbol);
      results.push({ symbol, candles });

      if ((i + 1) % 10 === 0 || i + 1 === total) {
        log.info(`${progress} İlerleme: %${Math.round(((i + 1) / total) * 100)} — son: ${symbol} (${candles.length} mum)`);
      } else {
        process.stdout.write(`\r  ${progress} ${symbol}...          `);
      }
    } catch (err) {
      log.warn(`${progress} ${symbol} atlandı: ${(err as Error).message}`);
    }

    if (i < total - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  process.stdout.write('\n');
  log.ok(`Kline verisi tamamlandı. Başarılı: ${results.length}/${total}`);
  return results;
}
