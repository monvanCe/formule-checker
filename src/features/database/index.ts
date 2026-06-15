import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { Candle, SymbolKlineData } from '../../types';
import { log } from '../../utils';

const DB_PATH = path.resolve(process.cwd(), 'data', 'klines.db');
const DB_DIR  = path.dirname(DB_PATH);

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    log.info(`Mevcut veritabanı yüklendi: ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    log.info('Yeni veritabanı oluşturuldu.');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS symbols (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS candles (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol    TEXT    NOT NULL,
      open_time INTEGER NOT NULL,
      open      REAL    NOT NULL,
      high      REAL    NOT NULL,
      low       REAL    NOT NULL,
      close     REAL    NOT NULL,
      volume    REAL    NOT NULL,
      UNIQUE(symbol, open_time)
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_candles_symbol ON candles(symbol);`);

  return db;
}

function persistDb(database: Database): void {
  const data = database.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function clearDatabase(): Promise<void> {
  const database = await getDb();
  database.run('DELETE FROM candles');
  database.run('DELETE FROM symbols');
  persistDb(database);
  log.ok('Veritabanı temizlendi (--clean modu).');
}

export async function isDatabasePopulated(): Promise<boolean> {
  const database = await getDb();
  const result = database.exec('SELECT COUNT(*) as cnt FROM symbols');
  const count = result[0]?.values[0]?.[0] as number ?? 0;
  return count > 0;
}

export async function saveKlineData(dataList: SymbolKlineData[]): Promise<void> {
  const database = await getDb();
  const total = dataList.length;

  log.info(`${total} sembol veritabanına yazılıyor...`);

  // Toplu insert için transaction kullan (sql.js'de hız kritik)
  database.run('BEGIN TRANSACTION');

  try {
    const insertSymbol = database.prepare(
      'INSERT OR IGNORE INTO symbols (symbol) VALUES (?)'
    );
    const insertCandle = database.prepare(`
      INSERT OR IGNORE INTO candles (symbol, open_time, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < dataList.length; i++) {
      const { symbol, candles } = dataList[i];
      insertSymbol.run([symbol]);

      for (const c of candles) {
        insertCandle.run([symbol, c.openTime, c.open, c.high, c.low, c.close, c.volume]);
      }

      if ((i + 1) % 50 === 0 || i + 1 === total) {
        log.info(`  DB yazma: ${i + 1}/${total} sembol tamamlandı`);
      }
    }

    insertSymbol.free();
    insertCandle.free();

    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }

  persistDb(database);
  log.ok(`Veritabanına yazma tamamlandı → ${DB_PATH}`);
}

export async function loadKlineData(): Promise<SymbolKlineData[]> {
  const database = await getDb();

  const symbolResult = database.exec('SELECT symbol FROM symbols ORDER BY symbol');
  if (!symbolResult[0]) return [];

  const symbols = symbolResult[0].values.map((row) => row[0] as string);
  const results: SymbolKlineData[] = [];

  log.info(`Veritabanından ${symbols.length} sembol yükleniyor...`);

  for (const symbol of symbols) {
    const candleResult = database.exec(
      `SELECT open_time, open, high, low, close, volume
       FROM candles WHERE symbol = ? ORDER BY open_time ASC`,
      [symbol]
    );

    if (!candleResult[0]) continue;

    const candles: Candle[] = candleResult[0].values.map((row) => ({
      openTime: row[0] as number,
      open:     row[1] as number,
      high:     row[2] as number,
      low:      row[3] as number,
      close:    row[4] as number,
      volume:   row[5] as number,
    }));

    results.push({ symbol, candles });
  }

  log.ok(`${results.length} sembol veritabanından yüklendi.`);
  return results;
}
