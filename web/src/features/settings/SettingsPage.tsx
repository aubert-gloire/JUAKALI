import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2, Users, User, Shield, Eye, EyeOff,
  MoreVertical, UserCheck, UserX, Key,
} from 'lucide-react';
import { settingsApi, type ShopStaff, type ShopDetails } from '@/lib/settingsApi';
import { useAuth } from '@/hooks/useAuth';
import { clsx } from 'clsx';

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS = {
  owner:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cashier: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', ROLE_COLORS[role as keyof typeof ROLE_COLORS] ?? ROLE_COLORS.cashier)}>
      {role}
    </span>
  );
}

// ── Shop Tab ──────────────────────────────────────────────────────────────────

const shopSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().min(1, 'Location is required'),
  phone: z.string().optional(),
  currency: z.string().length(3, 'Must be 3-letter code'),
  timezone: z.string().min(1),
  receiptFooter: z.string().max(300).optional(),
  allowNegativeStock: z.boolean(),
  lowStockDefault: z.coerce.number().int().min(0),
});

type ShopFormData = z.infer<typeof shopSchema>;

function ShopTab({ role }: { role: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: settingsApi.getShop,
    staleTime: 30_000,
  });

  const shop = data?.shop;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ShopFormData>({
    resolver: zodResolver(shopSchema),
    values: shop
      ? {
          name: shop.name,
          location: shop.location,
          phone: shop.phone ?? '',
          currency: shop.currency,
          timezone: shop.timezone,
          receiptFooter: shop.receiptFooter ?? '',
          allowNegativeStock: shop.allowNegativeStock,
          lowStockDefault: shop.lowStockDefault,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: ShopFormData) =>
      settingsApi.updateShop({
        ...data,
        phone: data.phone || undefined,
        receiptFooter: data.receiptFooter || undefined,
      } as Partial<Omit<ShopDetails, '_id'>>),
    onSuccess: () => {
      toast.success('Shop details saved');
      qc.invalidateQueries({ queryKey: ['settings', 'shop'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const isOwner = role === 'owner';

  if (isLoading) return <LoadingSpinner />;

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="max-w-xl space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Shop Name</label>
          <input {...register('name')} className="input" disabled={!isOwner} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Location / Address</label>
          <input {...register('location')} className="input" disabled={!isOwner} />
          {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location.message}</p>}
        </div>
        <div>
          <label className="label">Phone</label>
          <input {...register('phone')} className="input" disabled={!isOwner} placeholder="+250 7XX XXX XXX" />
        </div>
        <div>
          <label className="label">Currency</label>
          <input {...register('currency')} className="input" disabled={!isOwner} />
        </div>
        <div>
          <label className="label">Timezone</label>
          <input {...register('timezone')} className="input" disabled={!isOwner} />
        </div>
        <div>
          <label className="label">Default Low Stock Level</label>
          <input {...register('lowStockDefault')} type="number" min={0} className="input" disabled={!isOwner} />
        </div>
      </div>

      <div>
        <label className="label">Receipt Footer Message</label>
        <textarea
          {...register('receiptFooter')}
          className="input resize-none"
          rows={2}
          disabled={!isOwner}
          placeholder="e.g. Thank you for shopping with us!"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="neg-stock"
          {...register('allowNegativeStock')}
          className="accent-primary-600 h-4 w-4"
          disabled={!isOwner}
        />
        <label htmlFor="neg-stock" className="text-sm text-slate-700 dark:text-slate-300">
          Allow negative stock (sell below zero)
        </label>
      </div>

      {isOwner && (
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          {isDirty && (
            <button type="button" className="btn-ghost" onClick={() => reset()}>
              Discard
            </button>
          )}
        </div>
      )}
    </form>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['manager', 'cashier']),
  tempPassword: z.string().min(10, 'Password must be at least 10 characters'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

const resetPwSchema = z.object({
  newPassword: z.string().min(10, 'At least 10 characters'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type ResetPwData = z.infer<typeof resetPwSchema>;

function StaffActionMenu({
  member,
  currentUserId,
  onChangeRole,
  onResetPw,
  onDeactivate,
  onActivate,
}: {
  member: ShopStaff;
  currentUserId: string;
  onChangeRole: (m: ShopStaff) => void;
  onResetPw: (m: ShopStaff) => void;
  onDeactivate: (m: ShopStaff) => void;
  onActivate: (m: ShopStaff) => void;
}) {
  const [open, setOpen] = useState(false);
  const isSelf = member.userId === currentUserId;
  const isOwner = member.role === 'owner';

  if (isSelf || isOwner) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden py-1">
            {member.role !== 'owner' && (
              <button
                onClick={() => { onChangeRole(member); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Shield size={12} /> Change Role
              </button>
            )}
            <button
              onClick={() => { onResetPw(member); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Key size={12} /> Reset Password
            </button>
            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
            {member.isActive ? (
              <button
                onClick={() => { onDeactivate(member); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <UserX size={12} /> Deactivate
              </button>
            ) : (
              <button
                onClick={() => { onActivate(member); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                <UserCheck size={12} /> Activate
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteFormData>({ resolver: zodResolver(inviteSchema) });

  const mutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      settingsApi.inviteStaff({ ...data, phone: data.phone || undefined }),
    onSuccess: (data) => {
      toast.success(`${data.user.name} added successfully`);
      qc.invalidateQueries({ queryKey: ['settings', 'staff'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-5">Add Staff Member</h2>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input {...register('name')} className="input" placeholder="Claudine Uwimana" autoFocus />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" placeholder="claudine@example.com" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input {...register('phone')} className="input" placeholder="+250 7XX XXX XXX" />
          </div>
          <div>
            <label className="label">Role</label>
            <select {...register('role')} className="input">
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="label">Temporary Password</label>
            <div className="relative">
              <input
                {...register('tempPassword')}
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Min. 10 characters"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">They must change this on first login.</p>
            {errors.tempPassword && <p className="text-xs text-red-500 mt-1">{errors.tempPassword.message}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ member, onClose }: { member: ShopStaff; onClose: () => void }) {
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPwData>({ resolver: zodResolver(resetPwSchema) });

  const mutation = useMutation({
    mutationFn: (data: ResetPwData) =>
      settingsApi.resetPassword(member.userId, data.newPassword),
    onSuccess: () => {
      toast.success(`Password reset for ${member.name}`);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">Reset Password</h2>
        <p className="text-sm text-slate-400 mb-5">Setting a new password for <strong className="text-slate-700 dark:text-slate-300">{member.name}</strong></p>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input
                {...register('newPassword')}
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                autoFocus
              />
              <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>}
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input {...register('confirm')} type="password" className="input" />
            {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm.message}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeRoleModal({ member, onClose }: { member: ShopStaff; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<'manager' | 'cashier'>(member.role === 'owner' ? 'manager' : member.role);

  const mutation = useMutation({
    mutationFn: () => settingsApi.updateRole(member.membershipId, role),
    onSuccess: () => {
      toast.success(`${member.name} is now ${role}`);
      qc.invalidateQueries({ queryKey: ['settings', 'staff'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-4">Change Role</h2>
        <p className="text-sm text-slate-500 mb-4">{member.name} · Current: <RoleBadge role={member.role} /></p>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'manager' | 'cashier')}
          className="input mb-5"
        >
          <option value="cashier">Cashier — can sell, view own sales</option>
          <option value="manager">Manager — can manage inventory and see reports</option>
        </select>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={role === member.role || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Update Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffTab({ userRole, currentUserId }: { userRole: string; currentUserId: string }) {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [resetTarget, setResetTarget] = useState<ShopStaff | null>(null);
  const [roleTarget, setRoleTarget] = useState<ShopStaff | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'staff'],
    queryFn: settingsApi.listStaff,
    staleTime: 30_000,
  });

  const deactivate = useMutation({
    mutationFn: (m: ShopStaff) => settingsApi.deactivate(m.membershipId),
    onSuccess: (_, m) => {
      toast.success(`${m.name} deactivated`);
      qc.invalidateQueries({ queryKey: ['settings', 'staff'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const activate = useMutation({
    mutationFn: (m: ShopStaff) => settingsApi.activate(m.membershipId),
    onSuccess: (_, m) => {
      toast.success(`${m.name} reactivated`);
      qc.invalidateQueries({ queryKey: ['settings', 'staff'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const isOwner = userRole === 'owner';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{data?.users.length ?? 0} team members</p>
        {isOwner && (
          <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setShowInvite(true)}>
            + Add Staff
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide hidden sm:table-cell">Last Login</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                {isOwner && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {data?.users.map((member) => (
                <tr key={member.membershipId} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary-600/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary-600">{member.name[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{member.name}</p>
                        {member.phone && <p className="text-[10px] text-slate-400">{member.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{member.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={member.role} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell">
                    {member.lastLoginAt
                      ? new Date(member.lastLoginAt).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })
                      : <span className="text-slate-300">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      member.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
                    )}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3">
                      <StaffActionMenu
                        member={member}
                        currentUserId={currentUserId}
                        onChangeRole={setRoleTarget}
                        onResetPw={setResetTarget}
                        onDeactivate={(m) => deactivate.mutate(m)}
                        onActivate={(m) => activate.mutate(m)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {resetTarget && <ResetPasswordModal member={resetTarget} onClose={() => setResetTarget(null)} />}
      {roleTarget && <ChangeRoleModal member={roleTarget} onClose={() => setRoleTarget(null)} />}
    </div>
  );
}

// ── Account Tab ───────────────────────────────────────────────────────────────

const changePwSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(10, 'At least 10 characters'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type ChangePwData = z.infer<typeof changePwSchema>;

function AccountTab({ user }: { user: { name: string; email: string } }) {
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePwData>({ resolver: zodResolver(changePwSchema) });

  const mutation = useMutation({
    mutationFn: (data: ChangePwData) =>
      fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: 'Failed' } }));
          throw new Error(err.error?.message ?? 'Failed');
        }
      }),
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-md space-y-6">
      {/* Profile card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-bold text-white">{user.name[0]?.toUpperCase()}</span>
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Change Password</h3>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <input {...register('currentPassword')} type={showPw ? 'text' : 'password'} className="input pr-10" />
              <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.currentPassword && <p className="text-xs text-red-500 mt-1">{errors.currentPassword.message}</p>}
          </div>
          <div>
            <label className="label">New Password</label>
            <input {...register('newPassword')} type="password" className="input" placeholder="Min. 10 characters" />
            {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>}
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input {...register('confirm')} type="password" className="input" />
            {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'shop',    label: 'Shop Profile', icon: Building2 },
  { id: 'staff',   label: 'Staff & Access', icon: Users },
  { id: 'account', label: 'My Account', icon: User },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SettingsPage() {
  const { data: auth } = useAuth();
  const [tab, setTab] = useState<TabId>('shop');

  const membership = auth?.memberships?.[0];
  const role = membership?.role ?? 'cashier';
  const userId = auth?.user?.id ?? '';
  const userName = auth?.user?.name ?? '';
  const userEmail = auth?.user?.email ?? '';

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">Manage your shop, team, and account</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'shop'    && <ShopTab role={role} />}
      {tab === 'staff'   && <StaffTab userRole={role} currentUserId={userId} />}
      {tab === 'account' && <AccountTab user={{ name: userName, email: userEmail }} />}
    </div>
  );
}
