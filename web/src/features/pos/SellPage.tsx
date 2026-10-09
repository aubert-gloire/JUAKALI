import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, X, Plus, Minus, Trash2, ShoppingCart,
  Banknote, Smartphone, CreditCard, AlertCircle, CheckCircle2, Tag,
} from 'lucide-react';
import { productsApi, categoriesApi, type Product, type Category } from '@/lib/inventoryApi';
import { salesApi, customersApi, type PaymentMethod, type Customer, PAYMENT_LABELS } from '@/lib/salesApi';
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

  return (
    <button
      onClick={() => onAdd(product)}
      className="relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-left hover:border-primary-300 hover:shadow-md dark:hover:border-primary-700 transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {/* Category color strip */}
      <div className="w-8 h-1.5 rounded-full mb-2" style={{ backgroundColor: color }} />

      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight flex-1">
        {product.name}
      </p>
      <p className="text-[10px] text-slate-400 mt-1 font-mono">{product.sku}</p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
          {product.sellingPrice.toLocaleString()}
        </span>
        <span
          className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            product.stockQty === 0
              ? 'bg-red-100 text-red-600'
              : product.stockQty <= product.reorderLevel
              ? 'bg-amber-100 text-amber-600'
              : 'bg-green-100 text-green-600',
          )}
        >
          {product.stockQty}
        </span>
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
  onConfirm: (tendered?: number) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [tendered, setTendered] = useState('');

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
          <div className="p-4 text-center">
            <p className="text-sm text-slate-500">
              Confirm {PAYMENT_LABELS[paymentMethod]} payment of
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              RWF {total.toLocaleString()}
            </p>
          </div>
        )}

        {/* Confirm button */}
        <div className="p-3 pt-0">
          <button
            onClick={() =>
              onConfirm(paymentMethod === 'cash' && tenderedNum > 0 ? tenderedNum : undefined)
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

// ── Receipt toast ─────────────────────────────────────────────────────────────

function showReceipt(sale: { saleNumber: string; total: number; change?: number }) {
  toast.success(
    `Sale ${sale.saleNumber} — RWF ${sale.total.toLocaleString()}${
      sale.change ? ` · Change: RWF ${sale.change.toLocaleString()}` : ''
    }`,
    { duration: 5000 },
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
      showReceipt(data.sale);
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

  const handleConfirmPayment = (tendered?: number) => {
    completeSale.mutate({
      items: cart.map((l) => ({ productId: l.product._id, qty: l.qty })),
      discountAmount: discountAmt,
      paymentMethod,
      amountTendered: tendered,
      customerId: selectedCustomer?._id,
      customerName: selectedCustomer?.name,
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
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {selectedCustomer.name}
            </p>
            <button
              onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
              className="text-blue-400 hover:text-blue-600"
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
          disabled={cart.length === 0}
          className="btn-primary w-full text-base py-3.5 disabled:opacity-40"
        >
          Charge RWF {total.toLocaleString()}
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
    </div>
  );
}
