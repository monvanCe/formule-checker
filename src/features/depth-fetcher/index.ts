import { OrderBookWalls } from '../../types';
import { sleep, log } from '../../utils';

const BINANCE_DEPTH_URL = 'https://api.binance.com/api/v3/depth';
const DEPTH_LIMIT = 500;
/** depth limit=500 → weight 25; weight limitini şişirmemek için ardışık istek */
const RATE_LIMIT_MS = 1200;

type OrderBookLevel = [string, string]; // [price, quantity]

interface DepthResponse {
  lastUpdateId: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

/** USDT bazında (price × qty) en yüklü emrin fiyatını bulur. */
function findHeaviestWallPrice(levels: OrderBookLevel[]): number {
  let maxNotional = 0;
  let wallPrice = 0;

  for (let i = 0; i < levels.length; i++) {
    const price = parseFloat(levels[i][0]);
    const qty = parseFloat(levels[i][1]);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) continue;

    const notional = price * qty;
    if (notional > maxNotional) {
      maxNotional = notional;
      wallPrice = price;
    }
  }

  return wallPrice;
}

/**
 * Binance emir defterinden alım/satış likidite duvarlarını çeker.
 * bids → buyWallPrice, asks → sellWallPrice (USDT notional max).
 */
export async function fetchOrderBookWalls(symbol: string): Promise<OrderBookWalls> {
  const url = `${BINANCE_DEPTH_URL}?symbol=${symbol}&limit=${DEPTH_LIMIT}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Depth çekme hatası [${symbol}]: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as DepthResponse;

  const buyWallPrice = findHeaviestWallPrice(data.bids);
  const sellWallPrice = findHeaviestWallPrice(data.asks);

  if (buyWallPrice <= 0 || sellWallPrice <= 0) {
    throw new Error(`Depth duvar bulunamadı [${symbol}]`);
  }

  return { buyWallPrice, sellWallPrice };
}

export interface SymbolWallData {
  symbol: string;
  walls: OrderBookWalls;
}

/**
 * Semboller için emir defteri duvarlarını rate-limit dostu ardışık döngüyle çeker.
 * Promise.all kullanılmaz — Binance weight limitini korur.
 */
export async function fetchAllOrderBookWalls(
  symbols: string[]
): Promise<SymbolWallData[]> {
  const results: SymbolWallData[] = [];
  const total = symbols.length;

  log.info(
    `${total} sembol için depth (limit=${DEPTH_LIMIT}) çekiliyor — ardışık, ~${RATE_LIMIT_MS}ms aralık...`
  );
  log.info(`Tahmini süre: ~${Math.ceil((total * RATE_LIMIT_MS) / 60_000)} dakika`);

  for (let i = 0; i < total; i++) {
    const symbol = symbols[i];
    const progress = `[${i + 1}/${total}]`;

    try {
      const walls = await fetchOrderBookWalls(symbol);
      results.push({ symbol, walls });

      if ((i + 1) % 10 === 0 || i + 1 === total) {
        log.info(
          `${progress} Depth ilerleme: %${Math.round(((i + 1) / total) * 100)} — son: ${symbol}` +
            ` (buy=${walls.buyWallPrice}, sell=${walls.sellWallPrice})`
        );
      } else {
        process.stdout.write(`\r  ${progress} ${symbol}...          `);
      }
    } catch (err) {
      log.warn(`${progress} ${symbol} depth atlandı: ${(err as Error).message}`);
    }

    if (i < total - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  process.stdout.write('\n');
  log.ok(`Depth verisi tamamlandı. Başarılı: ${results.length}/${total}`);
  return results;
}
