import { getAuthContext } from '../_lib/supabase.js';

function json(res, status, payload) {
  res.status(status).json(payload);
}

function formatAdminUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || '',
    avatarUrl: row.avatar_url || '',
    role: row.role || 'user',
    creditBalance: Number(row.credit_balance || 0),
    freeGenerationsUsed: Number(row.free_generations_used || 0),
    freeUsed: Number(row.free_generations_used || 0) >= 1,
    membership: row.membership || null,
    createdAt: row.created_at || ''
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const auth = await getAuthContext(req);
  if (auth.error) {
    return json(res, auth.status || 401, { ok: false, error: auth.error });
  }

  if (auth.profile?.role !== 'super_admin') {
    return json(res, 403, { ok: false, error: 'FORBIDDEN' });
  }

  const { data, error } = await auth.client
    .from('profiles')
    .select('id,email,full_name,avatar_url,role,credit_balance,free_generations_used,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('Failed to list admin users', {
      message: String(error?.message || 'unknown').slice(0, 240)
    });
    return json(res, 500, { ok: false, error: 'SERVER_NOT_CONFIGURED' });
  }

  const userIds = (data || []).map((user) => user.id);
  const membershipsByUserId = new Map();
  if (userIds.length) {
    const { data: memberships, error: membershipError } = await auth.client
      .from('user_memberships')
      .select('user_id,plan_id,status,current_period_end,cancel_at_period_end')
      .in('user_id', userIds);

    if (!membershipError) {
      for (const membership of memberships || []) {
        membershipsByUserId.set(membership.user_id, {
          planId: membership.plan_id || '',
          status: membership.status || 'inactive',
          currentPeriodEnd: membership.current_period_end || '',
          cancelAtPeriodEnd: Boolean(membership.cancel_at_period_end)
        });
      }
    }
  }

  return json(res, 200, {
    ok: true,
    users: (data || []).map((user) => formatAdminUser({
      ...user,
      membership: membershipsByUserId.get(user.id) || null
    }))
  });
}
