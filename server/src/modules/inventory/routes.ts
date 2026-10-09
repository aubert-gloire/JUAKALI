import { Router } from 'express';
import mongoose from 'mongoose';
import Papa from 'papaparse';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/roleGuard';
import { asyncHandler } from '../../utils/asyncHandler';
import { Errors } from '../../utils/errors';
import { nextSeq } from '../../models/Counter';
import { Category } from '../../models/Category';
import { Product } from '../../models/Product';
import { Supplier } from '../../models/Supplier';
import { PurchaseOrder } from '../../models/PurchaseOrder';
import { StockMovement } from '../../models/StockMovement';
import {
  CategoryBodySchema,
  ProductBodySchema,
  ProductPatchSchema,
  StockAdjustSchema,
  SupplierBodySchema,
  SupplierPatchSchema,
  PurchaseCreateSchema,
  PurchasePatchSchema,
  CsvImportSchema,
} from './validation';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth, requireTenant);

// ── HELPERS ───────────────────────────────────────────────────────────────────

function shopFilter(req: Parameters<typeof requireTenant>[0]) {
  return { shopId: req.tenant!.shopId };
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────

inventoryRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const cats = await Category.find(shopFilter(req)).sort({ name: 1 }).lean();
    res.json({ categories: cats });
  }),
);

inventoryRouter.post(
  '/categories',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = CategoryBodySchema.parse(req.body);
    const exists = await Category.findOne({ ...shopFilter(req), name: body.name });
    if (exists) throw Errors.conflict('Category name already exists');
    const cat = await Category.create({ ...shopFilter(req), ...body });
    res.status(201).json({ category: cat });
  }),
);

inventoryRouter.patch(
  '/categories/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = CategoryBodySchema.partial().parse(req.body);
    if (body.name) {
      const dup = await Category.findOne({
        ...shopFilter(req),
        name: body.name,
        _id: { $ne: req.params.id },
      });
      if (dup) throw Errors.conflict('Category name already exists');
    }
    const cat = await Category.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      body,
      { new: true },
    );
    if (!cat) throw Errors.notFound('Category');
    res.json({ category: cat });
  }),
);

inventoryRouter.delete(
  '/categories/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const inUse = await Product.exists({ ...shopFilter(req), categoryId: req.params.id });
    if (inUse) throw Errors.validation('Category is in use by products');
    const cat = await Category.findOneAndDelete({ _id: req.params.id, ...shopFilter(req) });
    if (!cat) throw Errors.notFound('Category');
    res.json({ ok: true });
  }),
);

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

inventoryRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { search, category, lowStock, page = '1', limit = '50' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { ...shopFilter(req), isActive: true };

    if (category) filter.categoryId = new mongoose.Types.ObjectId(category);
    if (lowStock === 'true') filter.$expr = { $lte: ['$stockQty', '$reorderLevel'] };

    let query = Product.find(filter);
    if (search) query = Product.find({ ...filter, $text: { $search: search } });

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit) || 50);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      query
        .populate('categoryId', 'name color')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  }),
);

inventoryRouter.get(
  '/products/stats',
  asyncHandler(async (req, res) => {
    const filter = { ...shopFilter(req), isActive: true };
    const [total, lowStock, valueAgg] = await Promise.all([
      Product.countDocuments(filter),
      Product.countDocuments({ ...filter, $expr: { $lte: ['$stockQty', '$reorderLevel'] } }),
      Product.aggregate([
        { $match: { shopId: req.tenant!.shopId, isActive: true } },
        { $group: { _id: null, totalValue: { $sum: { $multiply: ['$stockQty', '$costPrice'] } } } },
      ]),
    ]);
    res.json({
      total,
      lowStock,
      inventoryValue: valueAgg[0]?.totalValue ?? 0,
    });
  }),
);

inventoryRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, ...shopFilter(req) })
      .populate('categoryId', 'name color')
      .lean();
    if (!product) throw Errors.notFound('Product');
    res.json({ product });
  }),
);

inventoryRouter.post(
  '/products',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = ProductBodySchema.parse(req.body);
    let { sku } = body;

    if (!sku) {
      const seq = await nextSeq(req.tenant!.shopId, 'product');
      sku = `P-${String(seq).padStart(5, '0')}`;
    }

    const existing = await Product.findOne({ ...shopFilter(req), sku });
    if (existing) throw Errors.conflict(`SKU "${sku}" already exists`);

    const product = await Product.create({
      ...shopFilter(req),
      ...body,
      sku,
      categoryId: body.categoryId ? new mongoose.Types.ObjectId(body.categoryId) : undefined,
    });
    res.status(201).json({ product });
  }),
);

inventoryRouter.patch(
  '/products/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = ProductPatchSchema.parse(req.body);
    if (body.sku) {
      const dup = await Product.findOne({
        ...shopFilter(req),
        sku: body.sku,
        _id: { $ne: req.params.id },
      });
      if (dup) throw Errors.conflict(`SKU "${body.sku}" already in use`);
    }
    const update: Record<string, unknown> = { ...body };
    if (body.categoryId !== undefined) {
      update.categoryId = body.categoryId ? new mongoose.Types.ObjectId(body.categoryId) : null;
    }
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      update,
      { new: true },
    ).populate('categoryId', 'name color');
    if (!product) throw Errors.notFound('Product');
    res.json({ product });
  }),
);

inventoryRouter.delete(
  '/products/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      { isActive: false },
      { new: true },
    );
    if (!product) throw Errors.notFound('Product');
    res.json({ ok: true });
  }),
);

inventoryRouter.post(
  '/products/:id/adjust',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const { qty, notes } = StockAdjustSchema.parse(req.body);
    const product = await Product.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!product) throw Errors.notFound('Product');

    const qtyBefore = product.stockQty;
    const qtyAfter = qtyBefore + qty;

    if (qtyAfter < 0) throw Errors.negativeStock(product.name);

    product.stockQty = qtyAfter;
    await product.save();

    await StockMovement.create({
      shopId: req.tenant!.shopId,
      productId: product._id,
      productName: product.name,
      type: 'adjustment',
      qty,
      qtyBefore,
      qtyAfter,
      notes,
      createdBy: req.user!.id,
    });

    res.json({ product, qtyBefore, qtyAfter });
  }),
);

// CSV Import — receives { csv: "..." } as JSON
inventoryRouter.post(
  '/products/import',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const { csv } = CsvImportSchema.parse(req.body);

    const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (parsed.errors.length > 0) {
      throw Errors.validation(`CSV parse error: ${parsed.errors[0].message}`);
    }

    const rows = parsed.data;
    if (rows.length === 0) throw Errors.validation('CSV has no data rows');
    if (rows.length > 500) throw Errors.validation('CSV exceeds 500-row limit per import');

    const required = ['name', 'costprice', 'sellingprice'];
    for (const col of required) {
      if (!(col in rows[0])) throw Errors.validation(`CSV missing required column: ${col}`);
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      try {
        const costPrice = Math.round(parseFloat(row.costprice ?? row['cost price'] ?? '0'));
        const sellingPrice = Math.round(parseFloat(row.sellingprice ?? row['selling price'] ?? '0'));
        if (isNaN(costPrice) || isNaN(sellingPrice))
          throw new Error('costPrice / sellingPrice must be numbers');

        const name = row.name?.trim();
        if (!name) throw new Error('name is required');

        let sku = row.sku?.trim();
        if (!sku) {
          const seq = await nextSeq(req.tenant!.shopId, 'product');
          sku = `P-${String(seq).padStart(5, '0')}`;
        }

        const existing = await Product.findOne({ ...shopFilter(req), sku });
        const data = {
          name,
          sku,
          barcode: row.barcode?.trim() || undefined,
          unit: row.unit?.trim() || 'pcs',
          costPrice,
          sellingPrice,
          stockQty: Math.round(parseFloat(row.stockqty ?? row['stock qty'] ?? '0')) || 0,
          reorderLevel: Math.round(parseFloat(row.reorderlevel ?? row['reorder level'] ?? '5')) || 5,
          description: row.description?.trim() || undefined,
        };

        if (existing) {
          await Product.updateOne({ _id: existing._id }, data);
          updated++;
        } else {
          await Product.create({ ...shopFilter(req), ...data });
          created++;
        }
      } catch (err) {
        errors.push(`Row ${rowNum}: ${(err as Error).message}`);
      }
    }

    res.json({ created, updated, errors: errors.slice(0, 20) });
  }),
);

// ── SUPPLIERS ─────────────────────────────────────────────────────────────────

inventoryRouter.get(
  '/suppliers',
  asyncHandler(async (req, res) => {
    const suppliers = await Supplier.find({ ...shopFilter(req), isActive: true })
      .sort({ name: 1 })
      .lean();
    res.json({ suppliers });
  }),
);

inventoryRouter.post(
  '/suppliers',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = SupplierBodySchema.parse(req.body);
    const supplier = await Supplier.create({ ...shopFilter(req), ...body });
    res.status(201).json({ supplier });
  }),
);

inventoryRouter.patch(
  '/suppliers/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = SupplierPatchSchema.parse(req.body);
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      body,
      { new: true },
    );
    if (!supplier) throw Errors.notFound('Supplier');
    res.json({ supplier });
  }),
);

inventoryRouter.delete(
  '/suppliers/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, ...shopFilter(req) },
      { isActive: false },
      { new: true },
    );
    if (!supplier) throw Errors.notFound('Supplier');
    res.json({ ok: true });
  }),
);

// ── PURCHASES ─────────────────────────────────────────────────────────────────

inventoryRouter.get(
  '/purchases',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      PurchaseOrder.find(shopFilter(req))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PurchaseOrder.countDocuments(shopFilter(req)),
    ]);
    res.json({ orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  }),
);

inventoryRouter.get(
  '/purchases/:id',
  asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...shopFilter(req) }).lean();
    if (!order) throw Errors.notFound('Purchase order');
    res.json({ order });
  }),
);

inventoryRouter.post(
  '/purchases',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = PurchaseCreateSchema.parse(req.body);

    // Validate products and compute totals
    const productIds = body.lines.map((l) => new mongoose.Types.ObjectId(l.productId));
    const products = await Product.find({
      _id: { $in: productIds },
      ...shopFilter(req),
    }).lean();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const lines = body.lines.map((l) => {
      const prod = productMap.get(l.productId);
      if (!prod) throw Errors.notFound(`Product ${l.productId}`);
      return {
        productId: new mongoose.Types.ObjectId(l.productId),
        productName: prod.name,
        qty: l.qty,
        unitCost: l.unitCost,
        totalCost: l.qty * l.unitCost,
      };
    });

    const totalCost = lines.reduce((s, l) => s + l.totalCost, 0);
    const seq = await nextSeq(req.tenant!.shopId, 'purchase');
    const orderNumber = `PO-${String(seq).padStart(5, '0')}`;

    const order = await PurchaseOrder.create({
      ...shopFilter(req),
      orderNumber,
      supplierId: body.supplierId ? new mongoose.Types.ObjectId(body.supplierId) : undefined,
      supplierName: body.supplierName,
      lines,
      totalCost,
      notes: body.notes,
    });

    res.status(201).json({ order });
  }),
);

inventoryRouter.patch(
  '/purchases/:id',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const body = PurchasePatchSchema.parse(req.body);
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!order) throw Errors.notFound('Purchase order');
    if (!['draft', 'ordered'].includes(order.status)) {
      throw Errors.validation('Only draft or ordered purchases can be edited');
    }

    if (body.lines) {
      const productIds = body.lines.map((l) => new mongoose.Types.ObjectId(l.productId));
      const products = await Product.find({ _id: { $in: productIds }, ...shopFilter(req) }).lean();
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));
      const lines = body.lines.map((l) => {
        const prod = productMap.get(l.productId);
        if (!prod) throw Errors.notFound(`Product ${l.productId}`);
        return {
          productId: new mongoose.Types.ObjectId(l.productId),
          productName: prod.name,
          qty: l.qty,
          unitCost: l.unitCost,
          totalCost: l.qty * l.unitCost,
        };
      });
      order.lines = lines;
      order.totalCost = lines.reduce((s, l) => s + l.totalCost, 0);
    }

    if (body.supplierId !== undefined)
      order.supplierId = body.supplierId ? new mongoose.Types.ObjectId(body.supplierId) : undefined;
    if (body.supplierName !== undefined) order.supplierName = body.supplierName;
    if (body.notes !== undefined) order.notes = body.notes;
    if (body.status) order.status = body.status;

    await order.save();
    res.json({ order });
  }),
);

// Receive a purchase order — updates stock + creates movements
inventoryRouter.post(
  '/purchases/:id/receive',
  requireRole('manager'),
  asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({ _id: req.params.id, ...shopFilter(req) });
    if (!order) throw Errors.notFound('Purchase order');
    if (order.status === 'received') throw Errors.validation('Already received');
    if (order.status === 'cancelled') throw Errors.validation('Cannot receive a cancelled order');

    for (const line of order.lines) {
      const product = await Product.findById(line.productId);
      if (!product) continue;

      const qtyBefore = product.stockQty;
      const qtyAfter = qtyBefore + line.qty;
      product.stockQty = qtyAfter;
      await product.save();

      await StockMovement.create({
        shopId: req.tenant!.shopId,
        productId: product._id,
        productName: product.name,
        type: 'purchase',
        qty: line.qty,
        qtyBefore,
        qtyAfter,
        reference: order.orderNumber,
        createdBy: req.user!.id,
      });
    }

    order.status = 'received';
    order.receivedAt = new Date();
    order.receivedBy = req.user!.id as unknown as mongoose.Types.ObjectId;
    await order.save();

    res.json({ order });
  }),
);

// ── STOCK MOVEMENTS ───────────────────────────────────────────────────────────

inventoryRouter.get(
  '/movements',
  asyncHandler(async (req, res) => {
    const { productId, type, page = '1', limit = '30' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { ...shopFilter(req) };
    if (productId) filter.productId = new mongoose.Types.ObjectId(productId);
    if (type) filter.type = type;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 30);
    const skip = (pageNum - 1) * limitNum;

    const [movements, total] = await Promise.all([
      StockMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      StockMovement.countDocuments(filter),
    ]);
    res.json({ movements, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  }),
);
