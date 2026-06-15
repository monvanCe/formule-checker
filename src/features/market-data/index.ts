import { log } from '../../utils';

const MINIMUM_VOLUME_USDT = 5_000_000;

interface Ticker {
  symbol: string;
  quoteVolume: string;
}

export async function getCleanSymbolList(): Promise<string[]> {
  log.info('Binance 24hr ticker snapshot çekiliyor...');

  const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');

  if (!response.ok) {
    throw new Error(`Binance snapshot hatası: ${response.status} ${response.statusText}`);
  }

  const allTickers = await response.json() as Ticker[];
  log.info(`Toplam ticker sayısı: ${allTickers.length}`);

  const cleanSymbols = allTickers
    .filter((ticker) => {
      const isUSDT = ticker.symbol.endsWith('USDT');
      const volumeInUSDT = parseFloat(ticker.quoteVolume);
      const hasEnoughVolume = volumeInUSDT > MINIMUM_VOLUME_USDT;
      return isUSDT && hasEnoughVolume;
    })
    .map((ticker) => ticker.symbol);

  log.ok(`Filtre sonrası sembol sayısı: ${cleanSymbols.length} (min hacim: $${MINIMUM_VOLUME_USDT.toLocaleString()})`);
  return cleanSymbols;
}
