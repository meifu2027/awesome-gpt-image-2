import { getAuthContext, isSupabaseServerConfigured } from './_lib/supabase.js';

function json(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  if (!isSupabaseServerConfigured()) {
    return json(res, 500, { ok: false, error: 'SERVER_NOT_CONFIGURED' });
  }

  const auth = await getAuthContext(req, { allowAnonymous: true });
  if (auth.error) {
    return json(res, auth.status || 401, { ok: false, error: auth.error });
  }

  return json(res, 200, {
    ok: true,
    user: auth.profile
  });
}
