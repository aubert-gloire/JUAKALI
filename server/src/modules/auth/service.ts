import bcrypt from 'bcryptjs';
import { User } from '../../models/User';
import { Membership } from '../../models/Membership';
import { Shop } from '../../models/Shop';
import { Errors } from '../../utils/errors';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../middleware/auth';
import type { LoginInput, ChangePasswordInput, InviteUserInput } from './validation';
import type { IUser } from '../../models/User';
import type { Types } from 'mongoose';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BCRYPT_ROUNDS = 12;

export async function loginUser(input: LoginInput) {
  // Always find by email; never reveal whether the email exists
  const user = await User.findOne({ email: input.email });

  const WRONG_CREDS_MSG = 'Invalid email or password';

  if (!user) {
    // Fake bcrypt work to resist timing attacks
    await bcrypt.compare(input.password, '$2b$12$invalidhashfortimingnulluser');
    throw Errors.unauthorized(WRONG_CREDS_MSG);
  }

  if (!user.isActive) {
    await bcrypt.compare(input.password, user.passwordHash);
    throw Errors.unauthorized(WRONG_CREDS_MSG);
  }

  // Check account lock
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw Errors.accountLocked(
      'Account temporarily locked due to too many failed attempts',
    );
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);

  if (!valid) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const update: Partial<IUser> = { failedLoginAttempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await User.updateOne({ _id: user._id }, { $set: update });
    throw Errors.unauthorized(WRONG_CREDS_MSG);
  }

  // Reset lock state on successful login
  await User.updateOne(
    { _id: user._id },
    { $set: { failedLoginAttempts: 0, lockedUntil: undefined, lastLoginAt: new Date() } },
  );

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id.toString());

  return { user, accessToken, refreshToken };
}

export async function refreshTokens(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw Errors.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw Errors.unauthorized('User not found');
  }

  const newAccess = signAccessToken(user);
  const newRefresh = signRefreshToken(user._id.toString());

  return { accessToken: newAccess, refreshToken: newRefresh, user };
}

export async function getCurrentUser(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw Errors.notFound('User');

  const memberships = await Membership.find({ userId })
    .populate('shopId', 'name location currency timezone')
    .lean();

  return { user, memberships };
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
) {
  const user = await User.findById(userId);
  if (!user) throw Errors.notFound('User');

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw Errors.unauthorized('Current password is incorrect');

  const hash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await User.updateOne({ _id: userId }, { $set: { passwordHash: hash, mustChangePassword: false } });
}

export async function inviteUser(
  input: InviteUserInput,
  shopId: Types.ObjectId,
  organizationId: Types.ObjectId,
) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    // Check if already a member of this shop
    const membership = await Membership.findOne({ userId: existing._id, shopId });
    if (membership) throw Errors.conflict('User is already a member of this shop');

    // Add existing user to this shop
    await Membership.create({ userId: existing._id, organizationId, shopId, role: input.role });
    return existing;
  }

  const hash = await bcrypt.hash(input.tempPassword, BCRYPT_ROUNDS);
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: hash,
    mustChangePassword: true,
  });

  await Membership.create({ userId: user._id, organizationId, shopId, role: input.role });
  return user;
}

export async function resetStaffPassword(
  targetUserId: string,
  newPassword: string,
  requestingUserId: string,
  shopId: Types.ObjectId,
) {
  // Verify target user is a member of the same shop
  const membership = await Membership.findOne({ userId: targetUserId, shopId });
  if (!membership) throw Errors.notFound('User');

  // Owner cannot reset their own password via this route (use changePassword)
  if (targetUserId === requestingUserId) {
    throw Errors.forbidden('Use the change password flow for your own password');
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await User.updateOne(
    { _id: targetUserId },
    { $set: { passwordHash: hash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: undefined } },
  );
}

export async function getShopUsers(shopId: Types.ObjectId) {
  const memberships = await Membership.find({ shopId })
    .populate<{ userId: IUser }>('userId', 'name email phone isActive lastLoginAt preferredLanguage')
    .lean();

  return memberships.map((m) => ({
    userId: m.userId._id,
    name: m.userId.name,
    email: m.userId.email,
    phone: m.userId.phone,
    isActive: m.userId.isActive,
    lastLoginAt: m.userId.lastLoginAt,
    role: m.role,
    membershipId: m._id,
  }));
}

export async function getShopDetails(shopId: Types.ObjectId) {
  return Shop.findById(shopId).lean();
}

export async function updateShop(shopId: Types.ObjectId, data: Partial<import('./validation').UpdateShopInput>) {
  const shop = await Shop.findByIdAndUpdate(shopId, { $set: data }, { new: true });
  if (!shop) throw Errors.notFound('Shop');
  return shop;
}

export async function updateStaffRole(
  membershipId: string,
  role: 'manager' | 'cashier',
  shopId: Types.ObjectId,
  requestingUserId: string,
) {
  const membership = await Membership.findOne({ _id: membershipId, shopId });
  if (!membership) throw Errors.notFound('Membership');

  // Cannot demote yourself
  if (membership.userId.toString() === requestingUserId) {
    throw Errors.forbidden('You cannot change your own role');
  }
  // Cannot change another owner
  if (membership.role === 'owner') {
    throw Errors.forbidden('Cannot change role of another owner');
  }

  membership.role = role;
  await membership.save();
  return membership;
}

export async function deactivateStaff(
  membershipId: string,
  shopId: Types.ObjectId,
  requestingUserId: string,
  activate = false,
) {
  const membership = await Membership.findOne({ _id: membershipId, shopId }).populate<{ userId: IUser }>('userId');
  if (!membership) throw Errors.notFound('Membership');

  const user = membership.userId as IUser;
  if (user._id.toString() === requestingUserId) {
    throw Errors.forbidden('You cannot deactivate your own account');
  }
  if (membership.role === 'owner') {
    throw Errors.forbidden('Cannot deactivate another owner');
  }

  await User.updateOne({ _id: user._id }, { $set: { isActive: activate } });
  return { ok: true };
}
