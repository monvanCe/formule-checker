import * as fs from 'fs';
import * as path from 'path';
import { BacktestResult, ReportSummary } from '../../types';
import { log } from '../../utils';

function generateFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const hour  = pad(now.getHours());
  const min   = pad(now.getMinutes());
  const day   = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year  = now.getFullYear();

  return `report_${hour}${min}_${day}${month}${year}.txt`;
}

function sortResults(results: BacktestResult[]): BacktestResult[] {
  return [...results].sort((a, b) => {
    if (a.tp1Reached !== b.tp1Reached) return a.tp1Reached ? -1 : 1;
    return b.signal.score - a.signal.score;
  });
}

function formatDetailTable(results: BacktestResult[]): string[] {
  const thin = '─'.repeat(106);
  const lines: string[] = [];

  lines.push(
    '  ' + [
      'SEMBOL'.padEnd(14), 'SKOR'.padEnd(8), 'SONUÇ'.padEnd(10),
      'GİRİŞ'.padEnd(14), 'STOP'.padEnd(14),
      'TP1'.padEnd(14), 'TP2'.padEnd(14), 'TP3'.padEnd(14),
      'EN YÜKSEK',
    ].join('')
  );
  lines.push('  ' + thin);

  for (const r of results) {
    const { tp1, tp2, tp3 } = r.signal.takeProfits;
    lines.push(
      '  ' + [
        r.symbol.padEnd(14),
        r.signal.score.toFixed(1).padEnd(8),
        (r.tp1Reached ? 'TUTTU' : 'TUTMADI').padEnd(10),
        r.signal.entryPrice.toFixed(4).padEnd(14),
        r.signal.stopLoss.toFixed(4).padEnd(14),
        tp1.toFixed(4).padEnd(14),
        tp2.toFixed(4).padEnd(14),
        tp3.toFixed(4).padEnd(14),
        r.highestPrice.toFixed(4),
      ].join('')
    );
  }

  return lines;
}

function formatReport(summary: ReportSummary): string {
  const lines: string[] = [];
  const sep = '═'.repeat(106);
  const thin = '─'.repeat(106);

  lines.push(sep);
  lines.push('  TRADE ANALYZER — BACKTEST RAPORU');
  lines.push(
    `  ${new Date().toLocaleString('tr-TR')} | ${summary.totalAnalyzed} sembol | TP1: ${summary.tp1Hit}/${summary.totalAnalyzed} (%${summary.tp1HitRate})`
  );
  lines.push(sep);
  lines.push('');
  lines.push('  SKOR GRUPLARI');
  lines.push(thin);
  lines.push(
    '  ' + ['GRUP'.padEnd(10), 'ADET'.padEnd(8), 'TP1 İSABET'.padEnd(14), 'BAŞARI'].join('')
  );
  lines.push('  ' + thin);

  for (const g of summary.scoreGroups) {
    if (g.total === 0) continue;
    lines.push(
      '  ' + [
        g.label.padEnd(10),
        String(g.total).padEnd(8),
        `${g.tp1Hit}/${g.total}`.padEnd(14),
        `%${g.tp1HitRate}`,
      ].join('')
    );
  }

  lines.push('');
  lines.push(sep);
  lines.push('  TÜM SİNYALLER  (önce tutanlar, skor yüksekten düşüğe)');
  lines.push(sep);
  lines.push(...formatDetailTable(sortResults(summary.results)));
  lines.push('');
  lines.push(sep);
  return lines.join('\n');
}

export function writeReport(summary: ReportSummary): string {
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const fileName = generateFileName();
  const filePath = path.join(reportsDir, fileName);
  const content  = formatReport(summary);

  fs.writeFileSync(filePath, content, 'utf-8');
  log.ok(`Rapor yazıldı → ${filePath}`);

  return content;
}
