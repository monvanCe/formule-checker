import { log } from './utils';
import { getCleanSymbolList } from './features/market-data';
import { fetchAllKlines } from './features/kline-fetcher';
import {
  clearDatabase,
  isDatabasePopulated,
  saveKlineData,
  loadKlineData,
} from './features/database';
import { calculateTradeScore } from './features/math-engine';
import { runBacktest } from './features/backtester';
import { writeReport } from './features/reporter';
import { AnalysisResult, SymbolKlineData } from './types';

const TRAIN_SIZE = 1000;
const TEST_SIZE  = 0;
const IS_CLEAN   = process.argv.includes('--clean');

async function main(): Promise<void> {
  console.log('\n' + '█'.repeat(60));
  console.log('  TRADE ANALYZER — Başlatılıyor');
  console.log('  Mod: ' + (IS_CLEAN ? '--clean (veri yeniden çekilecek)' : 'normal (DB kullanılacak)'));
  console.log('█'.repeat(60) + '\n');

  // ── 1. VERİTABANI HAZIRLIK ──────────────────────────────────────────
  log.step('ADIM 1 / 4 — Veri Kaynağı Belirleniyor');

  if (IS_CLEAN) {
    await clearDatabase();
  }

  let allData: SymbolKlineData[];

  if (!IS_CLEAN && await isDatabasePopulated()) {
    log.info('Veritabanında mevcut veri bulundu. DB\'den yükleniyor...');
    allData = await loadKlineData();
  } else {
    log.info('Binance\'ten veri çekme işlemi başlıyor...');

    const symbols = await getCleanSymbolList();
    const fetched = await fetchAllKlines(symbols);

    log.info('Veriler veritabanına kaydediliyor...');
    await saveKlineData(fetched);

    allData = fetched;
  }

  log.ok(`Toplam kullanılabilir sembol: ${allData.length}`);

  // ── 2. ANALİZ (İlk 750 mum) ─────────────────────────────────────────
  log.step('ADIM 2 / 4 — Matematik Motoru Çalışıyor (Train: ilk 750 mum)');

  const analysisResults: AnalysisResult[] = [];
  let skipped = 0;

  for (const item of allData) {
    if (item.candles.length < TRAIN_SIZE + TEST_SIZE) {
      skipped++;
      continue;
    }

    const trainCandles = item.candles.slice(0, TRAIN_SIZE);
    const testCandles  = item.candles.slice(TRAIN_SIZE, TRAIN_SIZE + TEST_SIZE);
    const signal       = calculateTradeScore(trainCandles);

    analysisResults.push({
      symbol: item.symbol,
      signal,
      trainCandles,
      testCandles,
    });
  }

  log.ok(`Analiz tamamlandı. İşlenen: ${analysisResults.length} | Atlatılan (yetersiz mum): ${skipped}`);

  // ── 3. BACKTEST (Kalan 250 mum) ──────────────────────────────────────
  log.step('ADIM 3 / 4 — Backtest Çalışıyor (Test: 751-1000. mumlar)');

  const summary = runBacktest(analysisResults);

  // ── 4. RAPOR ─────────────────────────────────────────────────────────
  log.step('ADIM 4 / 4 — Rapor Yazılıyor');

  const reportContent = writeReport(summary);

  // Terminal özet
  console.log('\n' + reportContent);
}

main().catch((err) => {
  log.err(`Beklenmeyen hata: ${(err as Error).message}`);
  log.err((err as Error).stack ?? '');
  process.exit(1);
});
