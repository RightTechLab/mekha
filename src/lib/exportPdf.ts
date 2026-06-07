import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Transaction, OrderItem } from '../types';
import { formatBangkokDate, formatBangkokDateTime, formatBangkokTime, getBangkokDateKey } from './time';

interface ReceiptData {
  shopName: string;
  transaction: Transaction;
  items: OrderItem[];
}

export async function generateReceipt(data: ReceiptData): Promise<void> {
  const { shopName, transaction, items } = data;

  const itemRows = items
    .map(
      (item) =>
        `<tr>
          <td>${item.menu_name}</td>
          <td style="text-align:center">${item.quantity}</td>
          <td style="text-align:right">฿${item.item_total.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const html = `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
          h1 { text-align: center; color: #7C3AED; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          td { padding: 4px 0; font-size: 14px; }
          .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
          .total { font-size: 18px; font-weight: bold; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 16px; }
        </style>
      </head>
      <body>
        <h1>${shopName}</h1>
        <div class="divider"></div>
        <p style="font-size:12px;color:#666;">${formatBangkokDateTime(transaction.created_at)}</p>
        <table>
          <tr style="font-weight:bold;border-bottom:1px solid #ddd;">
            <td>Item</td>
            <td style="text-align:center">Qty</td>
            <td style="text-align:right">Price</td>
          </tr>
          ${itemRows}
        </table>
        <div class="divider"></div>
        ${transaction.discount_amount > 0 ? `<p>Discount: -฿${transaction.discount_amount.toFixed(2)}</p>` : ''}
        ${transaction.vat_amount > 0 ? `<p>VAT: ฿${transaction.vat_amount.toFixed(2)}</p>` : ''}
        <p class="total">Total: ฿${transaction.amount_thb.toFixed(2)}</p>
        <p>Payment: ${transaction.payment_method.toUpperCase()}</p>
        <div class="divider"></div>
        <p class="footer">Thank you!</p>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
}

export async function generateLightningReport(
  transactions: Transaction[],
  startDate: string,
  endDate: string,
  shopName: string = 'Mekha'
): Promise<void> {
  const totalThb = transactions.reduce((sum, t) => sum + t.amount_thb, 0);
  const totalSats = transactions.reduce((sum, t) => sum + (t.amount_sat ?? 0), 0);

  const rows = transactions
    .map(
      (t) =>
        `<tr>
          <td>${formatBangkokDate(t.created_at)}</td>
          <td>${formatBangkokTime(t.created_at)}</td>
          <td style="text-align:right">฿${t.amount_thb.toFixed(2)}</td>
          <td style="text-align:right">${t.amount_sat?.toLocaleString() ?? '-'}</td>
          <td style="text-align:right">${t.btc_rate_thb?.toLocaleString() ?? '-'}</td>
        </tr>`
    )
    .join('');

  const html = `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 32px; max-width: 800px; margin: 0 auto; color: #1A1523; }
          h1 { color: #7C3AED; font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 14px; color: #6B7280; font-weight: normal; margin-top: 0; }
          .summary { background: #F9F5FF; border-radius: 12px; padding: 16px; margin: 20px 0; display: flex; gap: 24px; }
          .summary-item { flex: 1; }
          .summary-label { font-size: 12px; color: #6B7280; }
          .summary-value { font-size: 20px; font-weight: bold; color: #7C3AED; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { text-align: left; padding: 8px 4px; border-bottom: 2px solid #E5E7EB; color: #6B7280; font-size: 11px; text-transform: uppercase; }
          td { padding: 6px 4px; border-bottom: 1px solid #F3F4F6; }
          tr:nth-child(even) { background: #FAFAFA; }
          .footer { margin-top: 24px; font-size: 11px; color: #9CA3AF; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${shopName}</h1>
        <h2>รายงานยอดชำระ Lightning</h2>
        <p style="font-size:13px;color:#6B7280;">ช่วงเวลา: ${startDate} ถึง ${endDate}</p>

        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">จำนวนรายการ</div>
            <div class="summary-value">${transactions.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">ยอดรวม (THB)</div>
            <div class="summary-value">฿${totalThb.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">ยอดรวม (sats)</div>
            <div class="summary-value">${totalSats.toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>วันที่</th>
              <th>เวลา</th>
              <th style="text-align:right">ยอด (THB)</th>
              <th style="text-align:right">sats</th>
              <th style="text-align:right">อัตรา BTC/THB</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="footer">
          สร้างโดย ${shopName} via Mekha POS — ${getBangkokDateKey()}
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
}
