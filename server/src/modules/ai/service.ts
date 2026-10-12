import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Types } from 'mongoose';
import { config } from '../../config';
import { AiUsage } from '../../models/AiUsage';
import { Sale } from '../../models/Sale';
import { Product } from '../../models/Product';
import { Expense } from '../../models/Expense';
import { CreditAccount } from '../../models/CreditAccount';
import { Shop } from '../../models/Shop';
import { Errors } from '../../utils/errors';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// ── Rate limit ─────────────────────────────────────────────────────────────────

export async function checkAndIncrementUsage(
  userId: Types.ObjectId | string,
  shopId: Types.ObjectId,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const doc = await AiUsage.findOneAndUpdate(
    { userId, shopId, date: today },
    { $inc: { requestCount: 1 } },
    { upsert: true, new: true },
  );

  if (doc.requestCount > config.AI_REQUESTS_PER_USER_PER_DAY) {
    throw Errors.rateLimited(
      `Daily AI limit of ${config.AI_REQUESTS_PER_USER_PER_DAY} messages reached. Try again tomorrow.`,
    );
  }
}

// ── Shop context snapshot ──────────────────────────────────────────────────────

async function buildShopContext(shopId: Types.ObjectId): Promise<string> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const shop = await Shop.findById(shopId).lean();

  // Today's sales summary
  const [todaySales, monthSales, lowStock, overdueCredits, topExpenses] =
    await Promise.all([
      Sale.aggregate([
        { $match: { shopId, status: 'completed', createdAt: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            profit: { $sum: '$profit' },
            count: { $sum: 1 },
          },
        },
      ]),

      Sale.aggregate([
        { $match: { shopId, status: 'completed', createdAt: { $gte: monthStart } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            profit: { $sum: '$profit' },
            count: { $sum: 1 },
          },
        },
      ]),

      Product.find({ shopId, isActive: true })
        .where('stockQty')
        .lte(5)
        .select('name stockQty reorderLevel')
        .sort({ stockQty: 1 })
        .limit(10)
        .lean(),

      CreditAccount.find({ shopId, status: { $in: ['active', 'overdue'] } })
        .select('balance status dueDate')
        .lean(),

      Expense.aggregate([
        { $match: { shopId, date: { $gte: monthStart } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 as const } },
        { $limit: 5 },
      ]),
    ]);

  const td = todaySales[0] ?? { revenue: 0, profit: 0, count: 0 };
  const mo = monthSales[0] ?? { revenue: 0, profit: 0, count: 0 };
  const totalCreditBalance = overdueCredits.reduce((s, a) => s + (a.balance ?? 0), 0);
  const overdueCount = overdueCredits.filter((a) => a.status === 'overdue').length;

  const lines: string[] = [
    `Shop: ${shop?.name ?? 'Unknown'} | Currency: RWF | Date: ${now.toDateString()}`,
    '',
    `TODAY: ${td.count} sales | Revenue RWF ${td.revenue.toLocaleString()} | Profit RWF ${td.profit.toLocaleString()}`,
    `THIS MONTH: ${mo.count} sales | Revenue RWF ${mo.revenue.toLocaleString()} | Profit RWF ${mo.profit.toLocaleString()}`,
    '',
  ];

  if (lowStock.length > 0) {
    lines.push('LOW / OUT OF STOCK:');
    lowStock.forEach((p) => {
      lines.push(`  - ${p.name}: ${p.stockQty} units (min ${p.reorderLevel ?? 0})`);
    });
    lines.push('');
  }

  if (overdueCredits.length > 0) {
    lines.push(
      `CREDIT ACCOUNTS: ${overdueCredits.length} open | RWF ${totalCreditBalance.toLocaleString()} outstanding | ${overdueCount} overdue`,
    );
    lines.push('');
  }

  if (topExpenses.length > 0) {
    lines.push('TOP EXPENSES THIS MONTH:');
    topExpenses.forEach((e) => {
      lines.push(`  - ${e._id}: RWF ${e.total.toLocaleString()}`);
    });
  }

  return lines.join('\n');
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(shopContext: string): string {
  return `You are BERT, an AI business assistant for a spare parts shop management system called JUAKALI.
You help shop owners and managers in Rwanda understand their business data, make smart decisions, and grow their shop.

CURRENT SHOP DATA:
${shopContext}

YOUR ROLE:
- Answer questions about sales, inventory, profits, expenses, and customers using the data above
- Give practical business advice tailored to spare parts shops in Rwanda
- Suggest actions when you spot problems (low stock, overdue credits, high expenses)
- Keep answers concise and actionable — owners are busy
- Use RWF for all amounts
- If asked something outside your knowledge, say so honestly

TONE: Friendly, professional, direct. Like a trusted business advisor who knows your shop.`;
}

// ── Main chat function ─────────────────────────────────────────────────────────

export async function chat(
  shopId: Types.ObjectId,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  if (!config.GEMINI_API_KEY) {
    throw Errors.validation('AI assistant is not configured. Add GEMINI_API_KEY to your environment.');
  }

  const shopContext = await buildShopContext(shopId);
  const systemPrompt = buildSystemPrompt(shopContext);

  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: config.AI_MODEL,
    systemInstruction: systemPrompt,
  });

  // Convert our history format to Gemini's format
  const geminiHistory = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const chatSession = model.startChat({ history: geminiHistory });
  const result = await chatSession.sendMessage(userMessage);
  return result.response.text();
}

