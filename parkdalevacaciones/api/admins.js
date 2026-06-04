module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Metodo no permitido' });
    return;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    'https://pzdheusvpoiyvoinxxzp.supabase.co';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    '';
  const authEmailDomain = process.env.SUPABASE_AUTH_EMAIL_DOMAIN || 'parkdale.local';

  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl ? 'SUPABASE_URL' : null,
      !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null
    ].filter(Boolean);
    res.status(500).json({ error: 'Faltan variables de entorno en Vercel: ' + missing.join(', ') + '.' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) {
    res.status(401).json({ error: 'Sesion no valida.' });
    return;
  }

  const requestJson = async (url, options) => {
    const response = await fetch(url, options);
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { error: text }; }
    if (!response.ok) {
      throw new Error((body && (body.msg || body.message || body.error_description || body.error)) || 'Error de Supabase');
    }
    return body;
  };

  try {
    const requester = await requestJson(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${accessToken}`
      }
    });

    const requesterUsername = String((requester.email || '').split('@')[0] || '').toLowerCase();
    const requesterProfiles = await requestJson(
      `${supabaseUrl}/rest/v1/administradores?select=usuario&user_id=eq.${requester.id}`,
      {
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );
    const profileUsername = String((requesterProfiles[0] && requesterProfiles[0].usuario) || requesterUsername).toLowerCase();
    if (profileUsername !== 'isaifonseca') {
      res.status(403).json({ error: 'Solo isaifonseca puede agregar administradores.' });
      return;
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const nombreCompleto = String(payload.nombre_completo || '').trim();
    const numeroNomina = String(payload.numero_nomina || '').trim();
    const cargo = String(payload.cargo || '').trim();
    const area = String(payload.area || '').trim();
    const usuario = String(payload.usuario || '').trim().toLowerCase();
    const password = String(payload.password || '');

    if (!nombreCompleto || !numeroNomina || !cargo || !area || !usuario || !password) {
      res.status(400).json({ error: 'Completa todos los campos.' });
      return;
    }

    const email = usuario.includes('@') ? usuario : `${usuario}@${authEmailDomain}`;
    const createdUser = await requestJson(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre_completo: nombreCompleto,
          numero_nomina: numeroNomina,
          cargo,
          area,
          usuario
        }
      })
    });

    const profile = await requestJson(`${supabaseUrl}/rest/v1/administradores`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        prefer: 'return=representation'
      },
      body: JSON.stringify({
        user_id: createdUser.id,
        nombre_completo: nombreCompleto,
        numero_nomina: numeroNomina,
        cargo,
        area,
        usuario,
        created_by: requester.id
      })
    });

    res.status(200).json({ ok: true, administrador: profile[0] || null });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
