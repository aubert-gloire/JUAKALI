import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';
import { Errors } from '../../utils/errors';
import { CreditAccount } from '../../models/CreditAccount';
import { AddInstallmentSchema, RecordPaymentSchema, UpdateCreditSchema } from './validation';

export const creditsRouter = Router();

creditsRouter.use(requireAuth, requireTenant);

function shopFilter(req: Parameters<typeof requireTenant>[0]) {
  return { shopId: req.tenant!.shopId };
}

// ── REMINDERS (notification bell) ─────────────────────────────────────────────

creditsRouter.get(
  '/reminders',
  asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const accounts = await CreditAccount.find({
      ...shopFilter(req),
      status: { $in: ['active', 'overdue'] },
      'installments.status': { $in: ['pending', 'partial', 'overdue'] },
    }).lean();

    const items: {
      creditAccountId: string;
      customerName: string;
      customerPhone?: string;
      saleNumber: string;
      amount: number;
      dueDate: string;
      type: 'overdue' | 'today' | 'upcoming';
    }[] = [];

    for (const account of accounts) {
      for (const inst of account.installments) {
        if (inst.status === 'paid') continue;
        const due = new Date(inst.dueDate);
        const remaining = inst.amount - inst.paidAmount;
        if (remaining <= 0) continue;

        let type: 'overdue' | 'today' | 'upcoming' | null = null;
        if (due < todayStart) type = 'overdue';
        else if (due <= today) type = 'today';
        else {
          // upcoming within 3 days
          const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          if (diff <= 3) type = 'upcoming';
        }

        if (type) {
          items.push({
            creditAccountId: account._id.toString(),
            customerName: account.customerName,
            customerPhone: account.customerPhone,
            saleNumber: account.saleNumber,
            amount: remaining,
            dueDate: due.toISOString().slice(0, 10),
            type,
          });
        }
      }
    }

    items.sort((a, b) => {
      const order = { overdue: 0, today: 1, upcoming: 2 };
      return order[a.type] - order[b.type] || a.dueDate.localeCompare(b.dueDate);
    });

    res.json({
      overdueCount: items.filter((i) => i.type === 'overdue').length,
      todayCount: items.filter((i) => i.type === 'today').length,
      upcomingCount: items.filter((i) => i.type === 'upcoming').length,
      total: items.length,
      items,
    });
  }),
);

// ── LIST ──────────────────────────────────────────────────────────────────────

creditsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '30', status } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 30);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { ...shopFilter(req) };
    if (status && status !== 'all') filter.status = status;

    const [accounts, total] = await Promise.all([
      CreditAccount.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      CreditAccount.countDocuments(filter),
    ]);

    res.json({ accounts, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  }),
);

// ── GET ONE ───────────────────────────────────────────────────────────────────

creditsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await CreditAccount.findOne({ _id: req.params.id, ...shopFilter(req) }).lean();
    if (!account) throw Errors.notFound('Credit account');
    res.json({ account });
  }),
);

// ── UPDATE (notes, phone) ─────────────────────────────────────────────────────

creditsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = UpdateCreditSchema.parse(req.body);
    const account = await CreditAccount.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      { $set: body },
      { new: true },
    );
    if (!account) throw Errors.notFound('Credit account');
    res.json({ account });
  }),
);

// ── ADD INSTALLMENT ───────────────────────────────────────────────────────────

creditsRouter.post(
  '/:id/installments',
  asyncHandler(async (req, res) => {
    const body = AddInstallmentSchema.parse(req.body);
    const account = await CreditAccount.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!account) throw Errors.notFound('Credit account');
    if (account.status === 'paid') throw Errors.validation('Account is already paid');

    account.installments.push({
      dueDate: new Date(body.dueDate),
      amount: body.amount,
      paidAmount: 0,
      status: 'pending',
      notes: body.notes,
    } as never);

    await account.save();
    res.json({ account });
  }),
);

// ── RECORD PAYMENT ────────────────────────────────────────────────────────────

creditsRouter.post(
  '/:id/payment',
  asyncHandler(async (req, res) => {
    const body = RecordPaymentSchema.parse(req.body);
    const account = await CreditAccount.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!account) throw Errors.notFound('Credit account');
    if (account.status === 'paid') throw Errors.validation('Account is already fully paid');

    let remaining = body.amount;

    if (body.installmentId) {
      // Apply to a specific installment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (account.installments as any).id(body.installmentId) as (typeof account.installments)[0] | null;
      if (!inst) throw Errors.notFound('Installment');
      const canPay = inst.amount - inst.paidAmount;
      const paying = Math.min(remaining, canPay);
      inst.paidAmount += paying;
      if (inst.paidAmount >= inst.amount) {
        inst.status = 'paid';
        inst.paidAt = new Date();
      } else {
        inst.status = 'partial';
      }
      remaining -= paying;
    } else {
      // Apply to oldest unpaid installments first
      const unpaid = account.installments
        .filter((i) => i.status !== 'paid')
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      for (const inst of unpaid) {
        if (remaining <= 0) break;
        const canPay = inst.amount - inst.paidAmount;
        const paying = Math.min(remaining, canPay);
        inst.paidAmount += paying;
        if (inst.paidAmount >= inst.amount) {
          inst.status = 'paid';
          inst.paidAt = new Date();
        } else {
          inst.status = 'partial';
        }
        remaining -= paying;
      }
    }

    account.amountPaid += body.amount - remaining;
    account.balance = account.totalAmount - account.amountPaid;

    if (account.balance <= 0) {
      account.status = 'paid';
      account.balance = 0;
    } else {
      // Re-evaluate overdue status
      const now = new Date();
      const hasOverdue = account.installments.some(
        (i) => i.status !== 'paid' && new Date(i.dueDate) < now,
      );
      account.status = hasOverdue ? 'overdue' : 'active';
    }

    await account.save();
    res.json({ account });
  }),
);

// ── MARK OVERDUE (cron-style, manager+) ──────────────────────────────────────

creditsRouter.post(
  '/mark-overdue',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const accounts = await CreditAccount.find({
      ...shopFilter(req),
      status: { $in: ['active'] },
    });

    let updated = 0;
    for (const account of accounts) {
      let changed = false;
      for (const inst of account.installments) {
        if (inst.status === 'pending' && new Date(inst.dueDate) < now) {
          inst.status = 'overdue';
          changed = true;
        }
      }
      if (changed) {
        account.status = 'overdue';
        await account.save();
        updated++;
      }
    }

    res.json({ updated });
  }),
);
