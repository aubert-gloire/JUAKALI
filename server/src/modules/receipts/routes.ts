import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { Sale } from '../../models/Sale';
import { Shop } from '../../models/Shop';
import { verifyReceiptToken } from '../../lib/receiptToken';

export const receiptsRouter = Router();

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const METHOD_LABEL: Record<string, string> = {
  cash:         'Cash',
  mobile_money: 'Mobile Money (MoMo)',
  card:         'Card',
  credit:       'Credit',
};

receiptsRouter.get(
  '/:saleId',
  asyncHandler(async (req, res) => {
    const saleId = req.params.saleId as string;
    const t = typeof req.query.t === 'string' ? req.query.t : '';

    if (!t || !verifyReceiptToken(saleId, t)) {
      res.status(403).send('<h3>Invalid or missing receipt token.</h3>');
      return;
    }

    const sale = await Sale.findById(saleId).lean();
    if (!sale) {
      res.status(404).send('<h3>Receipt not found.</h3>');
      return;
    }

    const shop = await Shop.findById(sale.shopId).lean();

    const dateStr = new Date(sale.createdAt).toLocaleString('en-RW', {
      timeZone: shop?.timezone ?? 'Africa/Kigali',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemRows = sale.items
      .map(
        (item) => `
      <tr>
        <td>${esc(item.productName)}<br><span class="sku">${esc(item.sku)}</span></td>
        <td class="center">${item.qty}</td>
        <td class="right">${item.unitPrice.toLocaleString()}</td>
        <td class="right"><strong>${item.totalPrice.toLocaleString()}</strong></td>
      </tr>`,
      )
      .join('');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${esc(sale.saleNumber)} — ${esc(shop?.name ?? 'Shop')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f0f2f5;
      display: flex;
      justify-content: center;
      padding: 24px 12px 48px;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      width: 100%;
      max-width: 420px;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      overflow: hidden;
    }
    .header {
      background: #ea580c;
      color: #fff;
      padding: 22px 20px 18px;
      text-align: center;
    }
    .header h1 { font-size: 20px; font-weight: 700; letter-spacing: .5px; }
    .header p  { font-size: 12px; opacity: .85; margin-top: 3px; }
    .meta {
      display: flex;
      justify-content: space-between;
      padding: 14px 20px;
      background: #fff8f5;
      border-bottom: 1px dashed #f0d0c0;
      font-size: 12px;
      color: #666;
    }
    .meta strong { color: #1e293b; display: block; font-size: 13px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      background: #dcfce7;
      color: #16a34a;
    }
    .badge.credit { background: #fef9c3; color: #a16207; }
    .badge.voided { background: #fee2e2; color: #dc2626; }
    .body { padding: 16px 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .6px; color: #94a3b8;
      padding: 4px 0; border-bottom: 1px solid #e2e8f0;
      text-align: left;
    }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    td {
      padding: 8px 0; font-size: 13px; color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .sku { font-size: 10px; color: #94a3b8; }
    .totals { border-top: 2px solid #e2e8f0; padding-top: 10px; }
    .totals-row {
      display: flex; justify-content: space-between;
      font-size: 13px; color: #475569; padding: 3px 0;
    }
    .totals-row.total {
      font-size: 16px; font-weight: 700; color: #ea580c;
      border-top: 1px dashed #e2e8f0; margin-top: 6px; padding-top: 8px;
    }
    .totals-row.change { color: #16a34a; }
    .customer {
      margin-top: 12px; padding: 10px 12px;
      background: #f8fafc; border-radius: 8px;
      font-size: 12px; color: #475569;
    }
    .customer strong { color: #1e293b; font-size: 13px; }
    .footer {
      margin-top: 16px; text-align: center;
      font-size: 11px; color: #94a3b8; padding-bottom: 4px;
    }
    .footer p { margin-top: 4px; }
    .wa-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin: 16px 0 4px;
      padding: 11px;
      background: #25d366; color: #fff;
      border-radius: 8px; font-size: 13px; font-weight: 600;
      text-decoration: none;
    }
    .wa-btn svg { margin-right: 6px; }
    @media print {
      body { background: #fff; padding: 0; }
      .card { box-shadow: none; border-radius: 0; max-width: 100%; }
      .wa-btn, .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${esc(shop?.name ?? 'JUAKALI STORE')}</h1>
      <p>${esc(shop?.location ?? '')}${shop?.phone ? ` · ${esc(shop.phone)}` : ''}</p>
    </div>

    <div class="meta">
      <div>
        <strong>${esc(sale.saleNumber)}</strong>
        ${dateStr}
      </div>
      <div style="text-align:right">
        <strong>Payment</strong>
        ${esc(METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod)}
      </div>
    </div>

    <div class="body">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="center">Qty</th>
            <th class="right">Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="totals">
        ${sale.discountAmount > 0 ? `
        <div class="totals-row">
          <span>Subtotal</span><span>${sale.subtotal.toLocaleString()} RWF</span>
        </div>
        <div class="totals-row" style="color:#16a34a">
          <span>Discount</span><span>−${sale.discountAmount.toLocaleString()} RWF</span>
        </div>` : ''}
        <div class="totals-row total">
          <span>TOTAL</span><span>${sale.total.toLocaleString()} RWF</span>
        </div>
        ${sale.amountTendered != null ? `
        <div class="totals-row" style="margin-top:4px">
          <span>Tendered</span><span>${sale.amountTendered.toLocaleString()} RWF</span>
        </div>
        <div class="totals-row change">
          <span>Change</span><span>${(sale.change ?? 0).toLocaleString()} RWF</span>
        </div>` : ''}
        ${sale.paymentMethod === 'credit' ? `
        <div class="totals-row" style="color:#d97706; margin-top:4px">
          <span>⚠ Credit — balance outstanding</span>
        </div>` : ''}
      </div>

      ${sale.customerName ? `
      <div class="customer">
        <strong>${esc(sale.customerName)}</strong>
        ${sale.customerPhone ? `<br>${esc(sale.customerPhone)}` : ''}
      </div>` : ''}

      ${sale.status === 'voided' ? `
      <div style="text-align:center;margin-top:14px">
        <span class="badge voided">DELETED / VOIDED</span>
      </div>` : ''}

      ${sale.customerPhone ? `
      <a class="wa-btn no-print" href="https://wa.me/${sale.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! Here is your receipt for ${sale.saleNumber}: ${req.protocol}://${req.get('host')}/api/receipts/${sale._id}?t=${t}`)}" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        Share on WhatsApp
      </a>` : ''}

      <div class="footer">
        ${shop?.receiptFooter ? `<p>${esc(shop.receiptFooter)}</p>` : '<p>Thank you for your business!</p>'}
        <p style="margin-top:8px">
          <a href="javascript:window.print()" style="color:#ea580c;font-size:11px;text-decoration:none">🖨 Print receipt</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(html);
  }),
);
