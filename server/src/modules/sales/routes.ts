import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';
import { Errors } from '../../utils/errors';
import { nextSeq } from '../../models/Counter';
import { Product } from '../../models/Product';
import { Sale } from '../../models/Sale';
import { StockMovement } from '../../models/StockMovement';
import { Customer } from '../../models/Customer';
import { Expense } from '../../models/Expense';
import { CreditAccount } from '../../models/CreditAccount';
import { CompleteSaleSchema, VoidSaleSchema, CustomerSchema, ExpenseSchema } from './validation';
import { signReceiptToken } from '../../lib/receiptToken';
import { config } from '../../config';

export const salesRouter = Router();

salesRouter.use(requireAuth, requireTenant);

function shopFilter(req: Parameters<typeof requireTenant>[0]) {
  return { shopId: req.tenant!.shopId };
}

// ── STATS (dashboard) ─────────────────────────────────────────────────────────

salesRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const { range = 'today' } = req.query as { range?: string };

    const now = new Date();
    let startDate: Date;

    if (range === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // today
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    }

    const [agg, count, expenseAgg] = await Promise.all([
      Sale.aggregate([
        {
          $match: {
            shopId: req.tenant!.shopId,
            status: 'completed',
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            cost: { $sum: '$totalCost' },
            profit: { $sum: '$profit' },
            transactions: { $sum: 1 },
          },
        },
      ]),
      Sale.countDocuments({ ...shopFilter(req), status: 'completed', createdAt: { $gte: startDate } }),
      Expense.aggregate([
        {
          $match: {
            shopId: req.tenant!.shopId,
            date: { $gte: startDate },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const stats = agg[0] ?? { revenue: 0, cost: 0, profit: 0, transactions: 0 };
    const expenses = expenseAgg[0]?.total ?? 0;

    res.json({
      range,
      revenue: stats.revenue,
      cost: stats.cost,
      profit: stats.profit,
      expenses,
      netProfit: stats.profit - expenses,
      transactions: count,
    });
  }),
);

// 30-day daily revenue/profit trend for dashboard chart
salesRouter.get(
  '/trend',
  asyncHandler(async (req, res) => {
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const trend = await Sale.aggregate([
      {
        $match: {
          shopId: req.tenant!.shopId,
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Kigali' },
          },
          revenue: { $sum: '$total' },
          profit: { $sum: '$profit' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in missing days with zeros
    const map = new Map(trend.map((d) => [d._id, d]));
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const entry = map.get(key);
      result.push({
        date: key,
        day: d.toLocaleDateString('en-RW', { weekday: 'short', month: 'short', day: 'numeric' }),
        revenue: entry?.revenue ?? 0,
        profit: entry?.profit ?? 0,
        transactions: entry?.transactions ?? 0,
      });
    }

    res.json({ trend: result });
  }),
);

// ── SALES ─────────────────────────────────────────────────────────────────────

salesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '30', status, paymentMethod, from, to, customerId } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 30);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { ...shopFilter(req) };
    if (status && status !== 'all') filter.status = status;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
    if (customerId) filter.customerId = new mongoose.Types.ObjectId(customerId);
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = toDate;
      }
      filter.createdAt = dateFilter;
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Sale.countDocuments(filter),
    ]);

    res.json({ sales, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  }),
);

salesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = CompleteSaleSchema.parse(req.body);

    // Load all products in one query
    const productIds = body.items.map((i) => new mongoose.Types.ObjectId(i.productId));
    const products = await Product.find({
      _id: { $in: productIds },
      ...shopFilter(req),
      isActive: true,
    });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Validate and atomically decrement stock — prevents overselling under concurrent requests.
    // findOneAndUpdate with stockQty >= qty is a single atomic operation in MongoDB;
    // if two requests race for the last unit, exactly one gets the updated doc, the other gets null.
    const saleItems = [];
    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) throw Errors.notFound(`Product ${item.productId}`);

      const stockFilter = req.tenant!.allowNegativeStock
        ? { _id: product._id, ...shopFilter(req) }
        : { _id: product._id, ...shopFilter(req), stockQty: { $gte: item.qty } };

      const updated = await Product.findOneAndUpdate(
        stockFilter,
        { $inc: { stockQty: -item.qty } },
        { new: false }, // return the doc as it was before decrement (gives us qtyBefore)
      );
      if (!updated) throw Errors.negativeStock(product.name);

      saleItems.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        qty: item.qty,
        unitCost: product.costPrice,
        unitPrice: product.sellingPrice,
        totalCost: item.qty * product.costPrice,
        totalPrice: item.qty * product.sellingPrice,
        _qtyBefore: updated.stockQty, // used for the ledger entry below
      });
    }

    const subtotal = saleItems.reduce((s, i) => s + i.totalPrice, 0);
    const discountAmount = Math.min(body.discountAmount ?? 0, subtotal);
    const total = subtotal - discountAmount;
    const totalCost = saleItems.reduce((s, i) => s + i.totalCost, 0);
    const profit = total - totalCost;

    const seq = await nextSeq(req.tenant!.shopId, 'sale');
    const saleNumber = `S-${String(seq).padStart(6, '0')}`;

    // Resolve customer: prefer explicit customerId, then upsert by phone if name+phone provided
    let resolvedCustomerId: mongoose.Types.ObjectId | undefined;
    let resolvedCustomerName: string | undefined = body.customerName;
    let resolvedCustomerPhone: string | undefined = body.customerPhone;
    let resolvedCustomerTin: string | undefined = body.customerTin;

    if (body.customerId) {
      const found = await Customer.findById(body.customerId).lean();
      resolvedCustomerId = new mongoose.Types.ObjectId(body.customerId);
      resolvedCustomerPhone = found?.phone ?? body.customerPhone;
      resolvedCustomerName = found?.name ?? body.customerName;
      resolvedCustomerTin = found?.tin ?? body.customerTin;
    } else if (body.customerName && body.customerPhone) {
      // Auto-save: upsert by phone so repeat visits merge into one record
      const upserted = await Customer.findOneAndUpdate(
        { shopId: req.tenant!.shopId, phone: body.customerPhone },
        { $setOnInsert: { name: body.customerName, shopId: req.tenant!.shopId, phone: body.customerPhone, isActive: true } },
        { upsert: true, new: true },
      );
      resolvedCustomerId = upserted._id as mongoose.Types.ObjectId;
      resolvedCustomerName = upserted.name;
      resolvedCustomerPhone = upserted.phone;
    }

    // Pre-generate the sale ID so we can sign the receipt URL before inserting
    const saleId = new mongoose.Types.ObjectId();
    const receiptToken = signReceiptToken(saleId.toString());
    const receiptUrl = `${config.APP_ORIGIN.replace(/\/$/, '')}/api/receipts/${saleId}?t=${receiptToken}`;

    const sale = await Sale.create({
      _id: saleId,
      ...shopFilter(req),
      saleNumber,
      items: saleItems.map(({ _qtyBefore: _q, ...rest }) => rest),
      subtotal,
      discountAmount,
      total,
      totalCost,
      profit,
      paymentMethod: body.paymentMethod,
      amountTendered: body.amountTendered,
      change: body.amountTendered != null ? Math.max(0, body.amountTendered - total) : undefined,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      customerTin: resolvedCustomerTin,
      receiptUrl,
      cashierId: req.user!.id,
      notes: body.notes,
    });

    // Write stock movement ledger entries (stock already decremented above)
    for (const item of saleItems) {
      const qtyBefore = item._qtyBefore;
      const qtyAfter = qtyBefore - item.qty;
      await StockMovement.create({
        shopId: req.tenant!.shopId,
        productId: item.productId,
        productName: item.productName,
        type: 'sale',
        qty: -item.qty,
        qtyBefore,
        qtyAfter,
        reference: saleNumber,
        createdBy: req.user!.id,
      });
    }

    // Update customer totals
    if (resolvedCustomerId) {
      await Customer.updateOne({ _id: resolvedCustomerId }, { $inc: { totalSpent: total, salesCount: 1 } });
    }

    // Auto-create credit account for credit sales
    if (body.paymentMethod === 'credit') {
      const upfront = body.creditUpfrontAmount ?? 0;
      const creditBalance = total - upfront;
      const initialPayments = upfront > 0
        ? [{ amount: upfront, recordedAt: new Date(), notes: 'Paid at time of sale', recordedBy: req.user!.id }]
        : [];

      const installments = (body.creditInstallments ?? []).map((inst) => ({
        dueDate: new Date(inst.dueDate),
        amount: inst.amount,
        paidAmount: 0,
        status: 'pending',
        notes: inst.notes,
      }));
      const lastDueDate = installments.length > 0
        ? installments[installments.length - 1].dueDate
        : (body.creditDueDate ? new Date(body.creditDueDate) : undefined);

      await CreditAccount.create({
        shopId: req.tenant!.shopId,
        saleId: sale._id,
        saleNumber: sale.saleNumber,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName ?? 'Walk-in Customer',
        customerPhone: resolvedCustomerPhone,
        totalAmount: total,
        amountPaid: upfront,
        balance: creditBalance,
        dueDate: lastDueDate,
        status: creditBalance <= 0 ? 'paid' : 'active',
        installments,
        payments: initialPayments,
        createdBy: req.user!.id,
      });
    }

    res.status(201).json({ sale, receiptUrl });
  }),
);

salesRouter.post(
  '/:id/void',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const { reason } = VoidSaleSchema.parse(req.body);
    const sale = await Sale.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!sale) throw Errors.notFound('Sale');
    if (sale.status === 'voided') throw Errors.validation('Sale is already voided');

    // Restore stock — use findOneAndUpdate so qtyBefore in the ledger is accurate
    for (const item of sale.items) {
      const before = await Product.findOneAndUpdate(
        { _id: item.productId },
        { $inc: { stockQty: item.qty } },
        { new: false },
      );
      if (!before) continue;
      await StockMovement.create({
        shopId: req.tenant!.shopId,
        productId: item.productId,
        productName: item.productName,
        type: 'return',
        qty: item.qty,
        qtyBefore: before.stockQty,
        qtyAfter: before.stockQty + item.qty,
        reference: sale.saleNumber,
        notes: `Void: ${reason}`,
        createdBy: req.user!.id,
      });
    }

    // Reverse customer totals
    if (sale.customerId) {
      await Customer.updateOne(
        { _id: sale.customerId },
        { $inc: { totalSpent: -sale.total, salesCount: -1 } },
      );
    }

    // Void linked credit account if this was a credit sale — balance no longer owed
    if (sale.paymentMethod === 'credit') {
      await CreditAccount.findOneAndUpdate(
        { saleId: sale._id, ...shopFilter(req) },
        { status: 'defaulted', notes: `Voided: ${reason}` },
      );
    }

    sale.status = 'voided';
    sale.voidedAt = new Date();
    sale.voidedBy = req.user!.id as unknown as mongoose.Types.ObjectId;
    sale.voidReason = reason;
    await sale.save();

    res.json({ sale });
  }),
);

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

salesRouter.get(
  '/customers/list',
  asyncHandler(async (req, res) => {
    const { search } = req.query as { search?: string };
    const filter: Record<string, unknown> = { ...shopFilter(req), isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const customers = await Customer.find(filter).sort({ name: 1 }).limit(100).lean();
    res.json({ customers });
  }),
);

salesRouter.post(
  '/customers',
  asyncHandler(async (req, res) => {
    const body = CustomerSchema.parse(req.body);
    const customer = await Customer.create({ ...shopFilter(req), ...body });
    res.status(201).json({ customer });
  }),
);

salesRouter.patch(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    const body = CustomerSchema.partial().parse(req.body);
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      body,
      { new: true },
    );
    if (!customer) throw Errors.notFound('Customer');
    res.json({ customer });
  }),
);

salesRouter.delete(
  '/customers/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      { isActive: false },
      { new: true },
    );
    if (!customer) throw Errors.notFound('Customer');
    res.json({ ok: true });
  }),
);

// ── EXPENSES ──────────────────────────────────────────────────────────────────

salesRouter.get(
  '/expenses/summary',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const pipeline = [
      {
        $match: {
          ...shopFilter(req),
          ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 as const } },
      {
        $project: {
          _id: 0,
          category: '$_id',
          total: 1,
          count: 1,
        },
      },
    ];

    const [rows, grandTotal] = await Promise.all([
      Expense.aggregate(pipeline),
      Expense.aggregate([
        { $match: { ...shopFilter(req), ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      categories: rows,
      total: grandTotal[0]?.total ?? 0,
    });
  }),
);

salesRouter.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '30' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 30);
    const skip = (pageNum - 1) * limitNum;

    const [expenses, total] = await Promise.all([
      Expense.find(shopFilter(req)).sort({ date: -1 }).skip(skip).limit(limitNum).lean(),
      Expense.countDocuments(shopFilter(req)),
    ]);
    res.json({ expenses, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  }),
);

salesRouter.post(
  '/expenses',
  asyncHandler(async (req, res) => {
    const body = ExpenseSchema.parse(req.body);
    const expense = await Expense.create({
      ...shopFilter(req),
      ...body,
      date: new Date(body.date),
      recordedBy: req.user!.id,
    });
    res.status(201).json({ expense });
  }),
);

salesRouter.patch(
  '/expenses/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = ExpenseSchema.partial().parse(req.body);
    const update: Record<string, unknown> = { ...body };
    if (body.date) update.date = new Date(body.date);
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      update,
      { new: true },
    );
    if (!expense) throw Errors.notFound('Expense');
    res.json({ expense });
  }),
);

salesRouter.delete(
  '/expenses/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, ...shopFilter(req) });
    if (!expense) throw Errors.notFound('Expense');
    res.json({ ok: true });
  }),
);

// ── PATCH /sales/:id — fix metadata (no stock effect) ────────────────────────

import { z } from 'zod';

const EditSaleSchema = z.object({
  customerName:  z.string().min(1).optional(),
  customerPhone: z.string().optional(),
  paymentMethod: z.enum(['cash', 'mobile_money', 'card', 'credit']).optional(),
  notes:         z.string().optional(),
});

salesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = EditSaleSchema.parse(req.body);
    const sale = await Sale.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req), status: 'completed' },
      body,
      { new: true },
    );
    if (!sale) throw Errors.notFound('Sale');
    res.json({ sale });
  }),
);

// /:id must be last — all literal paths above must resolve before this wildcard
salesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, ...shopFilter(req) }).lean();
    if (!sale) throw Errors.notFound('Sale');
    res.json({ sale });
  }),
);
