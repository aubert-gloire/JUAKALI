import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { aiLimiter } from '../../middleware/rateLimiter';
import { Errors } from '../../utils/errors';
import { chat, checkAndIncrementUsage } from './service';

export const aiRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string().max(4000),
      }),
    )
    .max(20)
    .default([]),
});

// POST /api/ai/chat
aiRouter.post(
  '/chat',
  aiLimiter,
  requireAuth,
  requireTenant,
  asyncHandler(async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(parsed.error.issues[0].message);

    const { message, history } = parsed.data;

    await checkAndIncrementUsage(req.user!.id, req.tenant!.shopId);

    const reply = await chat(req.tenant!.shopId, history, message);

    res.json({ reply });
  }),
);
