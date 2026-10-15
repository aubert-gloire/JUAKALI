import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { purchasesApi, productsApi, suppliersApi, type Product, type Supplier } from '@/lib/inventoryApi';

export function RestockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState(
    product.reorderLevel > product.stockQty ? String(product.reorderLevel - product.stockQty) : '',
  );
  const [unitCost, setUnitCost] = useState(String(product.costPrice || ''));
  const [sellingPrice, setSellingPrice] = useState(String(product.sellingPrice || ''));
  const [supplierId, setSupplierId] = useState('');
  const [supplierInput, setSupplierInput] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const suppliersQ = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => suppliersApi.list(),
    staleTime: 60_000,
  });
  const suppliers: Supplier[] = suppliersQ.data?.suppliers ?? [];
  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(supplierInput.toLowerCase()),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const costNum = parseInt(unitCost) || 0;
      const sellNum = parseInt(sellingPrice) || 0;
      const { order } = await purchasesApi.create({
        supplierId: supplierId || undefined,
        supplierName: supplierInput || undefined,
        lines: [{ productId: product._id, qty: parseInt(qty), unitCost: costNum }],
        notes: notes || undefined,
      });
      await purchasesApi.receive(order._id);
      if (costNum !== product.costPrice || sellNum !== product.sellingPrice) {
        await productsApi.update(product._id, { costPrice: costNum, sellingPrice: sellNum });
      }
    },
    onSuccess: () => {
      toast.success(`${parseInt(qty)} ${product.unit} added to ${product.name}`);
      qc.invalidateQueries({ queryKey: ['inventory', 'products'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'purchases'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'lowStock'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const qtyNum = parseInt(qty) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{product.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Current stock: <span className={product.stockQty === 0 ? 'text-red-500 font-semibold' : 'text-amber-500 font-semibold'}>{product.stockQty} {product.unit}</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Qty */}
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Qty received *</label>
            <input
              type="number"
              min={1}
              className="input mt-1.5"
              placeholder="e.g. 20"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            {qtyNum > 0 && (
              <p className="text-xs text-emerald-600 mt-1 font-medium">
                → New stock: {product.stockQty + qtyNum} {product.unit}
              </p>
            )}
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost price</label>
              <input
                type="number"
                min={0}
                className="input mt-1.5"
                placeholder="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sell price</label>
              <input
                type="number"
                min={0}
                className="input mt-1.5"
                placeholder="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Supplier combobox */}
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Supplier</label>
            <div className="relative mt-1.5">
              <input
                className="input"
                placeholder="Type name or pick from list…"
                value={supplierInput}
                onChange={(e) => {
                  setSupplierInput(e.target.value);
                  setSupplierId('');
                  setSupplierOpen(true);
                }}
                onFocus={() => setSupplierOpen(true)}
                onBlur={() => setTimeout(() => setSupplierOpen(false), 150)}
                autoComplete="off"
              />
              {supplierOpen && filteredSuppliers.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl max-h-36 overflow-y-auto">
                  {filteredSuppliers.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSupplierInput(s.name);
                        setSupplierId(s._id);
                        setSupplierOpen(false);
                      }}
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
                      {s.phone && <span className="ml-2 text-[10px] text-slate-400">{s.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notes</label>
            <input
              className="input mt-1.5"
              placeholder="Optional…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={qtyNum <= 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
