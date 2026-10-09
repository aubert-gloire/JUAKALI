import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';
import { Sale } from '../../models/Sale';
import { Expense } from '../../models/Expense';
import { Product } from '../../models/Product';
import { CreditAccount } from '../../models/CreditAccount';

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireTenant, requireRole('manager'));

function shopId(req: Parameters<typeof requireTenant>[0]) {
  return req.tenant!.shopId;
}

function parsePeriod(query: Record<string, string>) {
  const now = new Date();
  let from: Date;
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (query.from) {
    from = new Date(query.from);
    if (query.to) {
      to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
    }
  } else {
    const period = query.period ?? 'month';
    if (period === 'today') {
      from = new Date(now); from.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      from = new Date(now.getFullYear(), 0, 1);
    } else {
      // month
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }
  return { from, to };
}

// ── OVERVIEW (P&L + payment breakdown) ───────────────────────────────────────

reportsRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const { from, to } = parsePeriod(req.query as Record<string, string>);
    const sid = shopId(req);

    const dateMatch = { $gte: from, $lte: to };

    const [salesAgg, expenseAgg, paymentAgg, dailyTrend] = await Promise.all([
      Sale.aggregate([
        { $match: { shopId: sid, status: 'completed', createdAt: dateMatch } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            cost: { $sum: '$totalCost' },
            profit: { $sum: '$profit' },
            transactions: { $sum: 1 },
            avgSale: { $avg: '$total' },
            totalDiscount: { $sum: '$discountAmount' },
          },
        },
      ]),

      Expense.aggregate([
        { $match: { shopId: sid, date: dateMatch } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      Sale.aggregate([
        { $match: { shopId: sid, status: 'completed', createdAt: dateMatch } },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            total: { $sum: '$total' },
          },
        },
        { $sort: { total: -1 } },
      ]),

      Sale.aggregate([
        { $match: { shopId: sid, status: 'completed', createdAt: dateMatch } },
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
      ]),
    ]);

    const s = salesAgg[0] ?? { revenue: 0, cost: 0, profit: 0, transactions: 0, avgSale: 0, totalDiscount: 0 };
    const expenses = expenseAgg[0]?.total ?? 0;

    res.json({
      period: { from, to },
      revenue: s.revenue,
      cost: s.cost,
      grossProfit: s.profit,
      expenses,
      netProfit: s.profit - expenses,
      transactions: s.transactions,
      avgSaleValue: Math.round(s.avgSale ?? 0),
      totalDiscount: s.totalDiscount,
      grossMargin: s.revenue > 0 ? Math.round((s.profit / s.revenue) * 100) : 0,
      paymentBreakdown: paymentAgg,
      dailyTrend,
    });
  }),
);

// ── TOP PRODUCTS ──────────────────────────────────────────────────────────────

reportsRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { from, to } = parsePeriod(req.query as Record<string, string>);
    const limit = Math.min(20, parseInt((req.query as Record<string, string>).limit ?? '10'));
    const sid = shopId(req);

    const [topRevenue, topQty, stockStats] = await Promise.all([
      Sale.aggregate([
        { $match: { shopId: sid, status: 'completed', createdAt: { $gte: from, $lte: to } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { productId: '$items.productId', name: '$items.productName', sku: '$items.sku' },
            revenue: { $sum: '$items.totalPrice' },
            qty: { $sum: '$items.qty' },
            cost: { $sum: '$items.totalCost' },
            profit: { $sum: { $subtract: ['$items.totalPrice', '$items.totalCost'] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: limit },
      ]),

      Sale.aggregate([
        { $match: { shopId: sid, status: 'completed', createdAt: { $gte: from, $lte: to } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { productId: '$items.productId', name: '$items.productName', sku: '$items.sku' },
            revenue: { $sum: '$items.totalPrice' },
            qty: { $sum: '$items.qty' },
            cost: { $sum: '$items.totalCost' },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: limit },
      ]),

      Product.aggregate([
        { $match: { shopId: sid, isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            inventoryValueCost: { $sum: { $multiply: ['$stockQty', '$costPrice'] } },
            inventoryValueRetail: { $sum: { $multiply: ['$stockQty', '$sellingPrice'] } },
            outOfStock: { $sum: { $cond: [{ $eq: ['$stockQty', 0] }, 1, 0] } },
            lowStock: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$stockQty', 0] }, { $lte: ['$stockQty', '$reorderLevel'] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    res.json({
      period: { from, to },
      topByRevenue: topRevenue,
      topByQty: topQty,
      stockSnapshot: stockStats[0] ?? {
        totalProducts: 0, inventoryValueCost: 0, inventoryValueRetail: 0, outOfStock: 0, lowStock: 0,
      },
    });
  }),
);

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

reportsRouter.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const { from, to } = parsePeriod(req.query as Record<string, string>);
    const limit = Math.min(20, parseInt((req.query as Record<string, string>).limit ?? '10'));
    const sid = shopId(req);
    const now = new Date();

    const [topCustomers, creditAging] = await Promise.all([
      Sale.aggregate([
        {
          $match: {
            shopId: sid,
            status: 'completed',
            createdAt: { $gte: from, $lte: to },
            customerName: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: { customerId: '$customerId', name: '$customerName' },
            totalSpent: { $sum: '$total' },
            transactions: { $sum: 1 },
            avgSale: { $avg: '$total' },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: limit },
      ]),

      CreditAccount.aggregate([
        { $match: { shopId: sid, status: { $in: ['active', 'overdue'] } } },
        {
          $addFields: {
            ageInDays: {
              $divide: [{ $subtract: [now, '$createdAt'] }, 1000 * 60 * 60 * 24],
            },
          },
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lte: ['$ageInDays', 30] }, then: '0-30' },
                  { case: { $lte: ['$ageInDays', 60] }, then: '31-60' },
                  { case: { $lte: ['$ageInDays', 90] }, then: '61-90' },
                ],
                default: '90+',
              },
            },
            count: { $sum: 1 },
            balance: { $sum: '$balance' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ period: { from, to }, topCustomers, creditAging });
  }),
);

// ── EXPENSES ──────────────────────────────────────────────────────────────────

reportsRouter.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    const { from, to } = parsePeriod(req.query as Record<string, string>);
    const sid = shopId(req);

    const [byCategory, monthly] = await Promise.all([
      Expense.aggregate([
        { $match: { shopId: sid, date: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),

      Expense.aggregate([
        { $match: { shopId: sid, date: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Africa/Kigali' } },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const grandTotal = byCategory.reduce((s: number, c: { total: number }) => s + c.total, 0);

    res.json({ period: { from, to }, byCategory, monthly, grandTotal });
  }),
);
