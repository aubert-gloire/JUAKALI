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
import { CompleteSaleSchema, VoidSaleSchema, CustomerSchema, ExpenseSchema } from './validation';

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
    const { page = '1', limit = '30', status } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 30);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { ...shopFilter(req) };
    if (status) filter.status = status;

    const [sales, total] = await Promise.all([
      Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Sale.countDocuments(filter),
    ]);

    res.json({ sales, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  }),
);

salesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, ...shopFilter(req) }).lean();
    if (!sale) throw Errors.notFound('Sale');
    res.json({ sale });
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

    // Validate stock and build sale items
    const saleItems = [];
    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) throw Errors.notFound(`Product ${item.productId}`);
      if (product.stockQty < item.qty) {
        throw Errors.negativeStock(product.name);
      }
      saleItems.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        qty: item.qty,
        unitCost: product.costPrice,
        unitPrice: product.sellingPrice,
        totalCost: item.qty * product.costPrice,
        totalPrice: item.qty * product.sellingPrice,
      });
    }

    const subtotal = saleItems.reduce((s, i) => s + i.totalPrice, 0);
    const discountAmount = Math.min(body.discountAmount ?? 0, subtotal);
    const total = subtotal - discountAmount;
    const totalCost = saleItems.reduce((s, i) => s + i.totalCost, 0);
    const profit = total - totalCost;

    const seq = await nextSeq(req.tenant!.shopId, 'sale');
    const saleNumber = `S-${String(seq).padStart(6, '0')}`;

    const sale = await Sale.create({
      ...shopFilter(req),
      saleNumber,
      items: saleItems,
      subtotal,
      discountAmount,
      total,
      totalCost,
      profit,
      paymentMethod: body.paymentMethod,
      amountTendered: body.amountTendered,
      change: body.amountTendered != null ? Math.max(0, body.amountTendered - total) : undefined,
      customerId: body.customerId ? new mongoose.Types.ObjectId(body.customerId) : undefined,
      customerName: body.customerName,
      cashierId: req.user!.id,
      notes: body.notes,
    });

    // Decrement stock + create movements
    for (const item of saleItems) {
      const product = productMap.get(item.productId.toString())!;
      const qtyBefore = product.stockQty;
      const qtyAfter = qtyBefore - item.qty;
      await Product.updateOne({ _id: product._id }, { $inc: { stockQty: -item.qty } });
      await StockMovement.create({
        shopId: req.tenant!.shopId,
        productId: product._id,
        productName: product.name,
        type: 'sale',
        qty: -item.qty,
        qtyBefore,
        qtyAfter,
        reference: saleNumber,
        createdBy: req.user!.id,
      });
    }

    // Update customer total spent
    if (sale.customerId) {
      await Customer.updateOne({ _id: sale.customerId }, { $inc: { totalSpent: total } });
    }

    res.status(201).json({ sale });
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

    // Restore stock
    for (const item of sale.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const qtyBefore = product.stockQty;
      const qtyAfter = qtyBefore + item.qty;
      await Product.updateOne({ _id: product._id }, { $inc: { stockQty: item.qty } });
      await StockMovement.create({
        shopId: req.tenant!.shopId,
        productId: product._id,
        productName: product.name,
        type: 'return',
        qty: item.qty,
        qtyBefore,
        qtyAfter,
        reference: sale.saleNumber,
        notes: `Void: ${reason}`,
        createdBy: req.user!.id,
      });
    }

    // Reverse customer total spent
    if (sale.customerId) {
      await Customer.updateOne(
        { _id: sale.customerId },
        { $inc: { totalSpent: -sale.total } },
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

// ── EXPENSES ──────────────────────────────────────────────────────────────────

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

salesRouter.delete(
  '/expenses/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, ...shopFilter(req) });
    if (!expense) throw Errors.notFound('Expense');
    res.json({ ok: true });
  }),
);
