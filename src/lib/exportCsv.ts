import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import type { Transaction } from '../types';

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
}

export async function exportTransactionsCsv(
  transactions: Transaction[],
  filename: string = 'mekha-transactions.csv'
): Promise<void> {
  const headers = [
    'ID',
    'Date',
    'Payment Method',
    'Amount (THB)',
    'Amount (SAT)',
    'BTC Rate',
    'Discount',
    'VAT',
    'Status',
  ];

  const rows = transactions.map((t) => [
    t.id,
    t.created_at,
    t.payment_method,
    t.amount_thb.toString(),
    t.amount_sat?.toString() ?? '',
    t.btc_rate_thb?.toString() ?? '',
    t.discount_amount.toString(),
    t.vat_amount.toString(),
    t.status,
  ]);

  const csv = toCsv([headers, ...rows]);
  const file = new File(Paths.document, filename);
  if (!file.exists) file.create();
  file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}

export async function exportLightningReportCsv(
  transactions: Transaction[],
  startDate: string,
  endDate: string,
  shopName: string = 'Mekha'
): Promise<void> {
  const totalThb = transactions.reduce((sum, t) => sum + t.amount_thb, 0);
  const totalSats = transactions.reduce((sum, t) => sum + (t.amount_sat ?? 0), 0);

  const summaryRows: string[][] = [
    ['รายงานยอดชำระ Lightning'],
    ['ร้าน', shopName],
    ['ช่วงเวลา', `${startDate} ถึง ${endDate}`],
    ['จำนวนรายการ', transactions.length.toString()],
    ['ยอดรวม (THB)', totalThb.toFixed(2)],
    ['ยอดรวม (sats)', totalSats.toString()],
    [''],
    ['วันที่', 'เวลา', 'ยอด (THB)', 'ยอด (sats)', 'อัตรา BTC/THB', 'Preimage'],
  ];

  const dataRows = transactions.map((t) => [
    t.created_at.substring(0, 10),
    t.created_at.substring(11, 19),
    t.amount_thb.toFixed(2),
    t.amount_sat?.toString() ?? '',
    t.btc_rate_thb?.toString() ?? '',
    t.lightning_preimage ?? '',
  ]);

  const csv = toCsv([...summaryRows, ...dataRows]);
  const filename = `mekha-lightning-report-${startDate}-${endDate}.csv`;
  const file = new File(Paths.document, filename);
  if (!file.exists) file.create();
  file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
