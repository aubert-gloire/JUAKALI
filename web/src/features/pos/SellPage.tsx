import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, X, Plus, Minus, Trash2, ShoppingCart,
  Banknote, Smartphone, CreditCard, AlertCircle, CheckCircle2, Tag,
  Printer, MessageCircle, CheckCircle, Download,
} from 'lucide-react';
import { productsApi, categoriesApi, type Product, type Category } from '@/lib/inventoryApi';
import { salesApi, customersApi, type PaymentMethod, type Sale, type Customer, PAYMENT_LABELS } from '@/lib/salesApi';
import { clsx } from 'clsx';

// ── Cart types ────────────────────────────────────────────────────────────────

interface CartLine {
  product: Product;
  qty: number;
}

// ── Payment icons ─────────────────────────────────────────────────────────────

const PAYMENT_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  mobile_money: Smartphone,
  card: CreditCard,
  credit: Tag,
};

// ── Product card (text + category color) ─────────────────────────────────────

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) {
  const cat = product.categoryId as Category | null;
  const color = cat?.color ?? '#6B7280';
  const outOfStock = product.stockQty === 0;

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={clsx(
        'relative flex flex-col rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        outOfStock
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-50 cursor-not-allowed'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-300 hover:shadow-md dark:hover:border-primary-700 active:scale-[0.97]',
      )}
    >
      {/* Out of stock overlay label */}
      {outOfStock && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">
          No stock
        </span>
      )}

      {/* Category color strip */}
      <div className="w-8 h-1.5 rounded-full mb-2" style={{ backgroundColor: outOfStock ? '#94a3b8' : color }} />

      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight flex-1">
        {product.name}
      </p>
      <p className="text-[10px] text-slate-400 mt-1 font-mono">{product.sku}</p>

      <div className="flex items-center justify-between mt-2">
        <span className={clsx('text-sm font-bold', outOfStock ? 'text-slate-400' : 'text-primary-600 dark:text-primary-400')}>
          {product.sellingPrice.toLocaleString()}
        </span>
        {!outOfStock && (
          <span
            className={clsx(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
              product.stockQty <= product.reorderLevel
                ? 'bg-amber-100 text-amber-600'
                : 'bg-green-100 text-green-600',
            )}
          >
            {product.stockQty}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Payment modal ─────────────────────────────────────────────────────────────

function PaymentModal({
  open,
  total,
  paymentMethod,
  onChangeMethod,
  onConfirm,
  onClose,
  isPending,
}: {
  open: boolean;
  total: number;
  paymentMethod: PaymentMethod;
  onChangeMethod: (m: PaymentMethod) => void;
  onConfirm: (tendered?: number, creditDueDate?: string, creditUpfront?: number) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [tendered, setTendered] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditUpfront, setCreditUpfront] = useState('');

  if (!open) return null;

  const tenderedNum = parseFloat(tendered) || 0;
  const change = paymentMethod === 'cash' ? Math.max(0, tenderedNum - total) : 0;
  const canConfirm =
    paymentMethod !== 'cash' || tenderedNum >= total || tendered === '';

  const appendDigit = (d: string) => {
    setTendered((prev) => {
      if (d === '⌫') return prev.slice(0, -1);
      if (d === '00') return prev + '00';
      return prev + d;
    });
  };

  const QUICK = [
    total,
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 5000) * 5000,
    Math.ceil(total / 10000) * 10000,
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <p className="text-xs text-slate-400">Collect Payment</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              RWF {total.toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Payment method tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-3 border-b border-slate-100 dark:border-slate-700">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => {
            const Icon = PAYMENT_ICONS[m];
            return (
              <button
                key={m}
                onClick={() => onChangeMethod(m)}
                className={clsx(
                  'flex flex-col items-center gap-1 rounded-lg py-2 px-1 text-[10px] font-medium transition-colors',
                  paymentMethod === m
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
                )}
              >
                <Icon size={16} />
                {m === 'mobile_money' ? 'MoMo' : PAYMENT_LABELS[m]}
              </button>
            );
          })}
        </div>

        {/* Cash tendered section */}
        {paymentMethod === 'cash' && (
          <div className="p-3 space-y-3">
            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => setTendered(String(q))}
                  className={clsx(
                    'text-xs font-medium py-1.5 rounded-lg border transition-colors',
                    tenderedNum === q
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-primary-300',
                  )}
                >
                  {q.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Amount display */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 text-right">
              <p className="text-xs text-slate-400 mb-0.5">Amount tendered</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {tendered || '0'}
              </p>
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-1.5">
              {['1','2','3','4','5','6','7','8','9','00','0','⌫'].map((d) => (
                <button
                  key={d}
                  onClick={() => appendDigit(d)}
                  className={clsx(
                    'py-3 rounded-lg text-base font-semibold transition-colors',
                    d === '⌫'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Change */}
            {tenderedNum > 0 && (
              <div className="flex justify-between text-sm font-medium px-1">
                <span className="text-slate-500">Change</span>
                <span className={change >= 0 ? 'text-green-600 font-bold' : 'text-red-500'}>
                  RWF {change.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Non-cash confirmation */}
        {paymentMethod !== 'cash' && (
          <div className="p-4 space-y-3">
            <div className="text-center">
              <p className="text-sm text-slate-500">
                Confirm {PAYMENT_LABELS[paymentMethod]} payment of
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                RWF {total.toLocaleString()}
              </p>
            </div>
            {paymentMethod === 'credit' && (
              <div className="space-y-3 text-left">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Amount paid now <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">RWF</span>
                    <input
                      type="number"
                      min={0}
                      max={total}
                      className="input pl-10 text-sm"
                      placeholder="0"
                      value={creditUpfront}
                      onChange={(e) => setCreditUpfront(e.target.value)}
                    />
                  </div>
                </div>
                {parseFloat(creditUpfront) > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 flex justify-between text-xs">
                    <span className="text-slate-500">Balance remaining</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      RWF {Math.max(0, total - parseFloat(creditUpfront)).toLocaleString()}
                    </span>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Full payment due by <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={creditDueDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirm button */}
        <div className="p-3 pt-0">
          <button
            onClick={() =>
              onConfirm(
                paymentMethod === 'cash' && tenderedNum > 0 ? tenderedNum : undefined,
                paymentMethod === 'credit' && creditDueDate ? creditDueDate : undefined,
                paymentMethod === 'credit' && parseFloat(creditUpfront) > 0
                  ? Math.round(parseFloat(creditUpfront))
                  : undefined,
              )
            }
            disabled={isPending || !canConfirm}
            className="btn-primary w-full text-base py-3 disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={18} /> Complete Sale
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Receipt PDF generator ─────────────────────────────────────────────────────

async function generateReceiptPDF(sale: Sale) {
  const { jsPDF } = await import('jspdf');

  const SHOP_NAME    = 'JUAKALI STORE';
  const SHOP_LOCATION = 'Kigali, Rwanda';
  const SHOP_PHONE   = '+250 788 268 061';

  const W = 80;          // mm — 80mm thermal width
  const MARGIN = 6;
  const LINE = 5;        // mm per text line
  const doc = new jsPDF({ unit: 'mm', format: [W, 297], orientation: 'portrait' });

  let y = MARGIN;
  const mid = W / 2;

  const dash = () => {
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(180);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 4;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(SHOP_NAME, mid, y, { align: 'center' });
  y += LINE;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(SHOP_LOCATION, mid, y, { align: 'center' });
  y += LINE - 1;
  doc.text(SHOP_PHONE, mid, y, { align: 'center' });
  y += LINE;
  doc.setTextColor(0);

  dash();

  // Receipt meta
  doc.setFontSize(8);
  const dateStr = new Date(sale.createdAt).toLocaleString('en-RW', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  doc.text(`Receipt #: ${sale.saleNumber}`, MARGIN, y);
  y += LINE - 1;
  doc.text(`Date: ${dateStr}`, MARGIN, y);
  y += LINE;

  dash();

  // Items header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ITEM', MARGIN, y);
  doc.text('QTY', 44, y, { align: 'right' });
  doc.text('PRICE', 55, y, { align: 'right' });
  doc.text('TOTAL', W - MARGIN, y, { align: 'right' });
  y += 1;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 3;

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const item of sale.items) {
    const name = item.productName.length > 20 ? item.productName.slice(0, 19) + '…' : item.productName;
    doc.text(name, MARGIN, y);
    doc.text(String(item.qty), 44, y, { align: 'right' });
    doc.text(item.unitPrice.toLocaleString(), 55, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(item.totalPrice.toLocaleString(), W - MARGIN, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += LINE - 0.5;
  }

  y += 1;
  dash();

  // Totals
  doc.setFontSize(8);
  if (sale.discountAmount > 0) {
    doc.text('Subtotal', MARGIN, y);
    doc.text(`RWF ${sale.subtotal.toLocaleString()}`, W - MARGIN, y, { align: 'right' });
    y += LINE - 1;
    doc.setTextColor(34, 197, 94);
    doc.text('Discount', MARGIN, y);
    doc.text(`-RWF ${sale.discountAmount.toLocaleString()}`, W - MARGIN, y, { align: 'right' });
    doc.setTextColor(0);
    y += LINE - 1;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL (RWF)', MARGIN, y);
  doc.text(sale.total.toLocaleString(), W - MARGIN, y, { align: 'right' });
  y += LINE + 1;

  dash();

  // Payment
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Payment method', MARGIN, y);
  doc.setFont('helvetica', 'bold');
  doc.text(PAYMENT_LABELS[sale.paymentMethod], W - MARGIN, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += LINE - 1;

  if (sale.amountTendered != null) {
    doc.text('Amount tendered', MARGIN, y);
    doc.text(`RWF ${sale.amountTendered.toLocaleString()}`, W - MARGIN, y, { align: 'right' });
    y += LINE - 1;
  }
  if (sale.change != null && sale.change > 0) {
    doc.text('Change', MARGIN, y);
    doc.text(`RWF ${sale.change.toLocaleString()}`, W - MARGIN, y, { align: 'right' });
    y += LINE - 1;
  }

  // Customer
  if (sale.customerName || sale.customerPhone) {
    y += 1;
    dash();
    if (sale.customerName) {
      doc.text('Customer', MARGIN, y);
      doc.setFont('helvetica', 'bold');
      doc.text(sale.customerName, W - MARGIN, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += LINE - 1;
    }
    if (sale.customerPhone) {
      doc.text('Phone', MARGIN, y);
      doc.text(sale.customerPhone, W - MARGIN, y, { align: 'right' });
      y += LINE - 1;
    }
  }

  y += 2;
  dash();

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Thank you for your business!', mid, y, { align: 'center' });
  y += LINE - 1;
  doc.setFontSize(7);
  doc.text('Powered by JUAKALI', mid, y, { align: 'center' });

  // Trim page height to content
  doc.internal.pageSize.height = y + MARGIN;

  doc.save(`receipt-${sale.saleNumber}.pdf`);
}

// ── Receipt modal ─────────────────────────────────────────────────────────────

function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const shopName = 'JUAKALI STORE';
  const shopLocation = 'Kigali, Rwanda';
  const shopPhone = '+250 788 268 061';
  const [downloading, setDownloading] = useState(false);

  const dateStr = new Date(sale.createdAt).toLocaleString('en-RW', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    setDownloading(true);
    try { await generateReceiptPDF(sale); }
    finally { setDownloading(false); }
  };

  const handleWhatsApp = () => {
    const d = '─────────────────────';
    const lines = [
      `🧾 *${shopName}*`,
      `📍 ${shopLocation}  📞 ${shopPhone}`,
      d,
      `*Receipt #${sale.saleNumber}*`,
      `📅 ${dateStr}`,
      d,
      ...sale.items.map(
        (i) => `▪ ${i.productName}\n   ${i.qty} × RWF ${i.unitPrice.toLocaleString()} = *RWF ${i.totalPrice.toLocaleString()}*`
      ),
      d,
      sale.discountAmount > 0 ? `Subtotal:   RWF ${sale.subtotal.toLocaleString()}` : '',
      sale.discountAmount > 0 ? `Discount:  −RWF ${sale.discountAmount.toLocaleString()}` : '',
      `💰 *TOTAL:  RWF ${sale.total.toLocaleString()}*`,
      d,
      `Payment:   ${PAYMENT_LABELS[sale.paymentMethod]}`,
      sale.amountTendered ? `Tendered: RWF ${sale.amountTendered.toLocaleString()}` : '',
      sale.change ? `Change:    RWF ${sale.change.toLocaleString()}` : '',
      sale.customerName ? `\n👤 ${sale.customerName}${sale.customerPhone ? `  |  ${sale.customerPhone}` : ''}` : '',
      d,
      `🙏 Thank you for your business!`,
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  };

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #receipt-print {
            display: block !important;
            position: fixed; inset: 0; z-index: 9999;
            background: white;
          }
          #receipt-print .no-print { display: none !important; }
          #receipt-print .print-body {
            width: 80mm;
            margin: 0 auto;
            padding: 8mm 5mm;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.55;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/50 no-print" onClick={onClose} />
        <div
          id="receipt-print"
          className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl overflow-hidden"
        >
          {/* Header bar — screen only */}
          <div className="no-print flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <CheckCircle size={15} className="text-green-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sale Complete</span>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={16} />
            </button>
          </div>

          {/* ── Receipt body ─────────────────────────────────────────────────── */}
          <div className="print-body px-6 py-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:text-slate-100 max-h-[55vh] overflow-y-auto">

            {/* Shop header */}
            <div className="text-center mb-3">
              <p className="text-[13px] font-bold tracking-widest uppercase">{shopName}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[10px]">{shopLocation}</p>
              <p className="text-slate-400 text-[10px]">{shopPhone}</p>
            </div>

            <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2" />

            {/* Receipt meta */}
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
              <span>Receipt #</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{sale.saleNumber}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>Date</span>
              <span>{dateStr}</span>
            </div>

            <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2" />

            {/* Items header */}
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1 px-0.5">
              <span className="flex-1">Item</span>
              <span className="w-8 text-right">Qty</span>
              <span className="w-20 text-right">Price</span>
              <span className="w-20 text-right">Total</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 mb-2" />

            {/* Items */}
            <div className="space-y-2">
              {sale.items.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-baseline gap-1">
                    <span className="flex-1 text-slate-700 dark:text-slate-200 truncate text-[11px] font-medium">{item.productName}</span>
                    <span className="w-8 text-right text-slate-500 tabular-nums">{item.qty}</span>
                    <span className="w-20 text-right text-slate-500 tabular-nums text-[10px]">{item.unitPrice.toLocaleString()}</span>
                    <span className="w-20 text-right font-bold tabular-nums">{item.totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2" />

            {/* Totals */}
            <div className="space-y-0.5">
              {sale.discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Subtotal</span>
                    <span className="tabular-nums">RWF {sale.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span className="tabular-nums">−RWF {sale.discountAmount.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-[13px] pt-1 border-t border-slate-200 dark:border-slate-700 mt-1">
                <span>TOTAL</span>
                <span className="tabular-nums text-primary-600 dark:text-primary-400">RWF {sale.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2" />

            {/* Payment */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Payment</span>
                <span className="font-semibold">{PAYMENT_LABELS[sale.paymentMethod]}</span>
              </div>
              {sale.amountTendered != null && (
                <div className="flex justify-between text-slate-500">
                  <span>Tendered</span>
                  <span className="tabular-nums">RWF {sale.amountTendered.toLocaleString()}</span>
                </div>
              )}
              {sale.change != null && sale.change > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Change</span>
                  <span className="tabular-nums">RWF {sale.change.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Customer */}
            {(sale.customerName || sale.customerPhone) && (
              <>
                <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2" />
                <div className="space-y-0.5 text-[11px]">
                  {sale.customerName && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Customer</span>
                      <span className="font-semibold">{sale.customerName}</span>
                    </div>
                  )}
                  {sale.customerPhone && (
                    <div className="flex justify-between text-slate-500">
                      <span>Phone</span>
                      <span>{sale.customerPhone}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Footer */}
            <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2" />
            <p className="text-center text-[10px] text-slate-400 font-sans">Thank you for your business! 🙏</p>
            <p className="text-center text-[9px] text-slate-300 dark:text-slate-600 font-sans mt-0.5">Powered by JUAKALI</p>
          </div>

          {/* ── Action buttons — screen only ─────────────────────────────────── */}
          <div className="no-print px-4 pb-5 pt-3 grid grid-cols-4 gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleWhatsApp}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              <MessageCircle size={17} />
              <span className="text-[9px] font-semibold">WhatsApp</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-60"
            >
              {downloading
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                : <Download size={17} />
              }
              <span className="text-[9px] font-semibold">PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Printer size={17} />
              <span className="text-[9px] font-semibold">Print</span>
            </button>
            <button
              onClick={onClose}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              <CheckCircle2 size={17} />
              <span className="text-[9px] font-semibold">Done</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main POS Page ─────────────────────────────────────────────────────────────

export function SellPage() {
  const qc = useQueryClient();

  // Product search & filter state
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('');

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showPayment, setShowPayment] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  // Data
  const catsQ = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 60_000,
  });

  const productsQ = useQuery({
    queryKey: ['inventory', 'products', search, activeCat, 1],
    queryFn: () => productsApi.list({ search: search || undefined, category: activeCat || undefined, limit: 100 }),
    staleTime: 15_000,
  });

  const customersQ = useQuery({
    queryKey: ['sales', 'customers', customerSearch],
    queryFn: () => customersApi.list(customerSearch || undefined),
    enabled: customerSearch.length >= 1,
    staleTime: 15_000,
  });

  const completeSale = useMutation({
    mutationFn: salesApi.complete,
    onSuccess: (data) => {
      setReceiptSale(data.sale);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setShowPayment(false);
      setShowMobileCart(false);
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'products'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'stats'] });
    },
    onError: (e) => toast.error(e.message),
  });

  // Cart calculations
  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.product.sellingPrice * l.qty, 0), [cart]);
  const discountAmt = Math.min(discount, subtotal);
  const total = subtotal - discountAmt;

  const addToCart = useCallback((product: Product) => {
    if (product.stockQty === 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product._id === product._id);
      if (idx >= 0) {
        const updated = [...prev];
        const newQty = updated[idx].qty + 1;
        if (newQty > product.stockQty) {
          toast.error(`Only ${product.stockQty} in stock`);
          return prev;
        }
        updated[idx] = { ...updated[idx], qty: newQty };
        return updated;
      }
      return [...prev, { product, qty: 1 }];
    });
  }, []);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product._id !== productId) return l;
          const newQty = l.qty + delta;
          if (newQty <= 0) return null;
          if (newQty > l.product.stockQty) {
            toast.error(`Only ${l.product.stockQty} in stock`);
            return l;
          }
          return { ...l, qty: newQty };
        })
        .filter(Boolean) as CartLine[],
    );
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((l) => l.product._id !== productId));

  const handleConfirmPayment = (tendered?: number, creditDueDate?: string, creditUpfront?: number) => {
    completeSale.mutate({
      items: cart.map((l) => ({ productId: l.product._id, qty: l.qty })),
      discountAmount: discountAmt,
      paymentMethod,
      amountTendered: tendered,
      customerId: selectedCustomer?._id,
      customerName: selectedCustomer?.name,
      creditDueDate,
      creditUpfrontAmount: creditUpfront,
    });
  };

  const categories = catsQ.data?.categories ?? [];
  const products = productsQ.data?.products ?? [];

  // ── Cart panel (shared between desktop and mobile modal) ─────────────────

  const CartPanel = (
    <div className="flex flex-col h-full">
      {/* Cart header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          Current Sale
        </h2>
        {cart.length > 0 && (
          <button
            onClick={() => setCart([])}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-300 dark:text-slate-600 gap-2">
            <ShoppingCart size={32} />
            <p className="text-xs">Add products to start a sale</p>
          </div>
        ) : (
          cart.map((line) => (
            <div
              key={line.product._id}
              className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {line.product.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {line.product.sellingPrice.toLocaleString()} × {line.qty} ={' '}
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {(line.product.sellingPrice * line.qty).toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(line.product._id, -1)}
                  className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-xs font-bold tabular-nums">
                  {line.qty}
                </span>
                <button
                  onClick={() => updateQty(line.product._id, 1)}
                  className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => removeFromCart(line.product._id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700">
        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-1.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                {selectedCustomer.name}
              </p>
              {selectedCustomer.phone && (
                <p className="text-[10px] text-blue-500 dark:text-blue-400">{selectedCustomer.phone}</p>
              )}
            </div>
            <button
              onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
              className="text-blue-400 hover:text-blue-600 flex-shrink-0 ml-2"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              className="input text-xs py-1.5"
              placeholder="Search customer (optional)…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            {customersQ.data && customersQ.data.customers.length > 0 && customerSearch && (
              <div className="absolute z-10 bottom-full mb-1 left-0 right-0 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto">
                {customersQ.data.customers.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                    {c.phone && <span className="text-slate-400">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discount */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 flex-shrink-0">Discount (RWF)</label>
          <input
            type="number"
            min={0}
            max={subtotal}
            value={discount || ''}
            onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
            className="input text-xs py-1 text-right w-28 ml-auto"
            placeholder="0"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="px-4 pb-2 space-y-1 border-t border-slate-100 dark:border-slate-700 pt-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Subtotal</span>
          <span>RWF {subtotal.toLocaleString()}</span>
        </div>
        {discountAmt > 0 && (
          <div className="flex justify-between text-xs text-green-600">
            <span>Discount</span>
            <span>−RWF {discountAmt.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-slate-900 dark:text-slate-100 pt-1">
          <span>Total</span>
          <span>RWF {total.toLocaleString()}</span>
        </div>
      </div>

      {/* Charge button */}
      <div className="p-3">
        <button
          onClick={() => setShowPayment(true)}
          disabled={cart.length === 0 || completeSale.isPending}
          className="btn-primary w-full text-base py-3.5 disabled:opacity-40"
        >
          {completeSale.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing…
            </span>
          ) : (
            `Charge RWF ${total.toLocaleString()}`
          )}
        </button>
      </div>
    </div>
  );

  // ── Main layout ────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100dvh-0px)] md:h-screen overflow-hidden">
      {/* Left: product browser */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 py-2 text-sm"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Mobile cart button */}
          <button
            className="md:hidden relative btn-primary px-3 py-2"
            onClick={() => setShowMobileCart(true)}
          >
            <ShoppingCart size={18} />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 text-[9px] font-bold bg-white text-primary-600 rounded-full flex items-center justify-center">
                {cart.reduce((s, l) => s + l.qty, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 px-3 md:px-4 py-2 overflow-x-auto border-b border-slate-100 dark:border-slate-800 scrollbar-none bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveCat('')}
            className={clsx(
              'flex-shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition-colors',
              activeCat === ''
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300',
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              onClick={() => setActiveCat(activeCat === c._id ? '' : c._id)}
              className={clsx(
                'flex-shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition-colors',
                activeCat === c._id
                  ? 'text-white border-transparent'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300',
              )}
              style={activeCat === c._id ? { backgroundColor: c.color } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {productsQ.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <AlertCircle size={32} className="opacity-30" />
              <p className="text-sm">No products found</p>
            </div>
          ) : products.every((p) => p.stockQty === 0) ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {products.map((p) => (
                  <ProductCard key={p._id} product={p} onAdd={addToCart} />
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle size={16} className="flex-shrink-0" />
                All products are out of stock. Go to <strong className="mx-1">Products → Adjust Stock</strong> to add units before selling.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {products.map((p) => (
                <ProductCard key={p._id} product={p} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: cart panel (desktop only) */}
      <div className="hidden md:flex w-80 flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {CartPanel}
      </div>

      {/* Mobile cart modal */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 flex flex-col md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileCart(false)} />
          <div className="relative mt-auto bg-white dark:bg-slate-900 rounded-t-2xl h-[80dvh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <button onClick={() => setShowMobileCart(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{CartPanel}</div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      <PaymentModal
        open={showPayment}
        total={total}
        paymentMethod={paymentMethod}
        onChangeMethod={setPaymentMethod}
        onConfirm={handleConfirmPayment}
        onClose={() => setShowPayment(false)}
        isPending={completeSale.isPending}
      />

      {/* Receipt modal */}
      {receiptSale && (
        <ReceiptModal
          sale={receiptSale}
          onClose={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
}
