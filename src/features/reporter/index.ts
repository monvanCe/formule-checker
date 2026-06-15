import * as fs from 'fs';
import * as path from 'path';
import { ReportSummary } from '../../types';
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

function formatReport(summary: ReportSummary): string {
  const lines: string[] = [];
  const sep = '═'.repeat(70);
  const thin = '─'.repeat(70);

  lines.push(sep);
  lines.push('  TRADE ANALYZER — BACKTEST RAPORU');
  lines.push(`  Oluşturulma: ${new Date().toLocaleString('tr-TR')}`);
  lines.push(sep);
  lines.push('');
  lines.push('  ÖZET');
  lines.push(thin);
  lines.push(`  Toplam analiz edilen sembol : ${summary.totalAnalyzed}`);
  lines.push(`  TP1'e ulaşan sinyal         : ${summary.tp1Hit}`);
  lines.push(`  TP1 isabet oranı            : %${summary.tp1HitRate}`);
  lines.push('');

  // TP1'e ulaşanlar
  const hits   = summary.results.filter((r) => r.tp1Reached);
  const misses = summary.results.filter((r) => !r.tp1Reached);

  lines.push(sep);
  lines.push(`  TP1'E ULAŞANLAR (${hits.length} adet)`);
  lines.push(sep);

  if (hits.length === 0) {
    lines.push('  — Yok');
  } else {
    lines.push(
      '  ' + ['SEMBOL'.padEnd(12), 'SKOR'.padEnd(8), 'GİRİŞ'.padEnd(14),
               'STOP'.padEnd(14), 'TP1'.padEnd(14), 'EN YÜKSEK'].join('')
    );
    lines.push('  ' + thin);
    for (const r of hits) {
      lines.push(
        '  ' + [
          r.symbol.padEnd(12),
          r.signal.score.toFixed(1).padEnd(8),
          r.signal.entryPrice.toFixed(4).padEnd(14),
          r.signal.stopLoss.toFixed(4).padEnd(14),
          r.signal.takeProfits.tp1.toFixed(4).padEnd(14),
          r.highestPrice.toFixed(4),
        ].join('')
      );
    }
  }

  lines.push('');
  lines.push(sep);
  lines.push(`  TUTMAYAN SİNYALLER (${misses.length} adet)`);
  lines.push(sep);

  if (misses.length === 0) {
    lines.push('  — Yok');
  } else {
    lines.push(
      '  ' + ['SEMBOL'.padEnd(12), 'SKOR'.padEnd(8), 'GİRİŞ'.padEnd(14),
               'STOP'.padEnd(14), 'TP1'.padEnd(14), 'EN YÜKSEK'].join('')
    );
    lines.push('  ' + thin);
    for (const r of misses) {
      lines.push(
        '  ' + [
          r.symbol.padEnd(12),
          r.signal.score.toFixed(1).padEnd(8),
          r.signal.entryPrice.toFixed(4).padEnd(14),
          r.signal.stopLoss.toFixed(4).padEnd(14),
          r.signal.takeProfits.tp1.toFixed(4).padEnd(14),
          r.highestPrice.toFixed(4),
        ].join('')
      );
    }
  }

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
