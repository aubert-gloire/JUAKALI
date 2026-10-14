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
    const now = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const in3Days = new Date(todayEnd.getTime() + 3 * 24 * 60 * 60 * 1000);

    const accounts = await CreditAccount.find({
      ...shopFilter(req),
      status: { $in: ['active', 'overdue'] },
      dueDate: { $lte: in3Days },
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
      if (!account.dueDate || account.balance <= 0) continue;
      const due = new Date(account.dueDate);

      let type: 'overdue' | 'today' | 'upcoming';
      if (due < todayStart) type = 'overdue';
      else if (due <= todayEnd) type = 'today';
      else type = 'upcoming';

      items.push({
        creditAccountId: account._id.toString(),
        customerName: account.customerName,
        customerPhone: account.customerPhone,
        saleNumber: account.saleNumber,
        amount: account.balance,
        dueDate: due.toISOString().slice(0, 10),
        type,
      });
    }

    // Also include overdue accounts without a dueDate
    const overdueNoDue = await CreditAccount.find({
      ...shopFilter(req),
      status: 'overdue',
      dueDate: { $exists: false },
    }).lean();

    for (const account of overdueNoDue) {
      if (account.balance <= 0) continue;
      items.push({
        creditAccountId: account._id.toString(),
        customerName: account.customerName,
        customerPhone: account.customerPhone,
        saleNumber: account.saleNumber,
        amount: account.balance,
        dueDate: now.toISOString().slice(0, 10),
        type: 'overdue',
      });
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
    const { page = '1', limit = '30', status, search } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 30);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { ...shopFilter(req) };
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { saleNumber: { $regex: search, $options: 'i' } },
      ];
    }

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
    const update: Record<string, unknown> = { ...body };
    if (body.dueDate !== undefined) {
      update.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      delete update.dueDate; // handled separately
    }
    const account = await CreditAccount.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!account) throw Errors.notFound('Credit account');
    if (body.notes !== undefined) account.notes = body.notes;
    if (body.customerPhone !== undefined) account.customerPhone = body.customerPhone;
    if (body.dueDate !== undefined) account.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    // Re-evaluate overdue status when dueDate changes
    if (body.dueDate !== undefined && account.status !== 'paid') {
      const now = new Date();
      account.status = account.dueDate && account.dueDate < now ? 'overdue' : 'active';
    }
    await account.save();
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

    const paying = Math.min(body.amount, account.balance);

    // Record in payments array
    account.payments.push({
      amount: paying,
      recordedAt: new Date(),
      notes: body.notes,
      recordedBy: req.user!.id as unknown as import('mongoose').Types.ObjectId,
    } as never);

    account.amountPaid += paying;
    account.balance = account.totalAmount - account.amountPaid;

    if (account.balance <= 0) {
      account.status = 'paid';
      account.balance = 0;
    } else {
      const now = new Date();
      account.status = account.dueDate && account.dueDate < now ? 'overdue' : 'active';
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

// Delete credit account — manager only, only if balance is zero or for write-off
creditsRouter.delete(
  '/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const account = await CreditAccount.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!account) throw Errors.notFound('Credit account');
    await CreditAccount.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  }),
);
