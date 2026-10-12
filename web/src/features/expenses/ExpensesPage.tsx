import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Receipt, Plus, Trash2, X, AlertCircle, Pencil, TrendingUp, Printer, Download, FileText } from 'lucide-react';
import type { Expense } from '@/lib/salesApi';
import { exportCSV, printTable, exportPDF } from '@/lib/exportUtils';

const EXPENSE_COLS = [
  { label: 'Category',       value: (e: Expense) => e.category },
  { label: 'Description',    value: (e: Expense) => e.description },
  { label: 'Date',           value: (e: Expense) => new Date(e.date).toLocaleDateString('en-RW') },
  { label: 'Amount (RWF)',   value: (e: Expense) => e.amount },
];
import {
  expensesApi,
  type ExpenseBody,
  type ExpenseCategory,
  type ExpenseCategorySummary,
  EXPENSE_LABELS,
} from '@/lib/salesApi';

// ── Form schema ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];

const schema = z.object({
  category: z.enum(EXPENSE_CATEGORIES as [ExpenseCategory, ...ExpenseCategory[]]),
  amount: z.coerce.number().int().min(1, 'Amount is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1, 'Date is required'),
});
type FormData = z.infer<typeof schema>;

// ── Category badge ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  rent:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  utilities:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  salary:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  transport:   'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  supplies:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  other:       'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function CategoryBadge({ cat }: { cat: ExpenseCategory }) {
  return (
    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[cat]}`}>
      {EXPENSE_LABELS[cat]}
    </span>
  );
}

// ── Add expense modal ─────────────────────────────────────────────────────────

function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      category: 'supplies',
    },
  });

  const mutation = useMutation({
    mutationFn: (body: ExpenseBody) => expensesApi.create(body),
    onSuccess: () => {
      toast.success('Expense recorded');
      qc.invalidateQueries({ queryKey: ['sales', 'expenses'] });
      qc.invalidateQueries({ queryKey: ['sales', 'stats'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Record Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="form-label">Category *</label>
            <select className="input" {...register('category')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
              ))}
            </select>
            {errors.category && <p className="form-error">{errors.category.message}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="form-label">Amount (RWF) *</label>
            <input
              type="number"
              min={1}
              className="input"
              placeholder="e.g. 50000"
              {...register('amount')}
            />
            {errors.amount && <p className="form-error">{errors.amount.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description *</label>
            <input className="input" placeholder="e.g. Monthly rent payment" {...register('description')} />
            {errors.description && <p className="form-error">{errors.description.message}</p>}
          </div>

          {/* Date */}
          <div>
            <label className="form-label">Date *</label>
            <input type="date" className="input" {...register('date')} />
            {errors.date && <p className="form-error">{errors.date.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Saving…' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit expense modal ────────────────────────────────────────────────────────

function EditExpenseModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date.slice(0, 10),
    },
  });
  const mutation = useMutation({
    mutationFn: (body: Partial<ExpenseBody>) => expensesApi.update(expense._id, body),
    onSuccess: () => {
      toast.success('Expense updated');
      qc.invalidateQueries({ queryKey: ['sales', 'expenses'] });
      qc.invalidateQueries({ queryKey: ['sales', 'stats'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Edit Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-5 space-y-4">
          <div>
            <label className="form-label">Category *</label>
            <select className="input" {...register('category')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
              ))}
            </select>
            {errors.category && <p className="form-error">{errors.category.message}</p>}
          </div>
          <div>
            <label className="form-label">Amount (RWF) *</label>
            <input type="number" min={1} className="input" {...register('amount')} />
            {errors.amount && <p className="form-error">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="form-label">Description *</label>
            <input className="input" {...register('description')} />
            {errors.description && <p className="form-error">{errors.description.message}</p>}
          </div>
          <div>
            <label className="form-label">Date *</label>
            <input type="date" className="input" {...register('date')} />
            {errors.date && <p className="form-error">{errors.date.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({
  expenseId,
  description,
  onClose,
}: {
  expenseId: string;
  description: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => expensesApi.delete(expenseId),
    onSuccess: () => {
      toast.success('Expense deleted');
      qc.invalidateQueries({ queryKey: ['sales', 'expenses'] });
      qc.invalidateQueries({ queryKey: ['sales', 'stats'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-xs shadow-2xl p-5 text-center">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">Delete expense?</p>
        <p className="text-xs text-slate-400 mb-4">"{description}"</p>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-danger flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ranked summary ────────────────────────────────────────────────────────────

function ExpenseSummary() {
  const { data } = useQuery({
    queryKey: ['sales', 'expenses', 'summary'],
    queryFn: () => expensesApi.summary(),
    staleTime: 30_000,
  });

  const rows: ExpenseCategorySummary[] = data?.categories ?? [];
  const grandTotal = data?.total ?? 0;

  if (rows.length === 0) return null;

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} className="text-primary-500" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Top Expenses</h2>
        <span className="ml-auto text-xs text-slate-400">All time · RWF {grandTotal.toLocaleString()}</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((row, i) => {
          const pct = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
          return (
            <div key={row.category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-4 text-right">{i + 1}</span>
                  <CategoryBadge cat={row.category} />
                  <span className="text-[10px] text-slate-400">{row.count} record{row.count !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    RWF {row.total.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1.5">{pct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden ml-6">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'expenses', page],
    queryFn: () => expensesApi.list(page),
    staleTime: 15_000,
  });

  const expenses = data?.expenses ?? [];
  const pages = data?.pages ?? 1;
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Expenses</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${data.total} records` : '…'}
            {expenses.length > 0 && ` · RWF ${grandTotal.toLocaleString()} this page`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expenses.length > 0 && (<>
            <button onClick={() => printTable(expenses, EXPENSE_COLS, 'Expenses')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Printer size={13} /> Print</button>
            <button onClick={() => exportCSV(expenses, EXPENSE_COLS, 'expenses')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Download size={13} /> CSV</button>
            <button onClick={() => exportPDF(expenses, EXPENSE_COLS, 'Expenses')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><FileText size={13} /> PDF</button>
          </>)}
          <button className="btn-primary gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>

      {/* Ranked breakdown */}
      <ExpenseSummary />

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <Receipt size={32} className="opacity-30" />
            <p className="text-sm">No expenses recorded yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e._id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <CategoryBadge cat={e.category} />
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                    {e.description}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">
                    {new Date(e.date).toLocaleDateString('en-RW', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                    RWF {e.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditTarget(e)}
                        className="p-1.5 rounded text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: e._id, description: e.description })}
                        className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            className="btn-ghost text-xs px-3 py-1"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page} of {pages}
          </span>
          <button
            className="btn-ghost text-xs px-3 py-1"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} />}
      {editTarget && <EditExpenseModal expense={editTarget} onClose={() => setEditTarget(null)} />}
      {deleteTarget && (
        <DeleteConfirm
          expenseId={deleteTarget.id}
          description={deleteTarget.description}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
