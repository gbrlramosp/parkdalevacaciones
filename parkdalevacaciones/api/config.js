module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    authEmailDomain: process.env.SUPABASE_AUTH_EMAIL_DOMAIN || 'parkdale.local',
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    missing: [
      !supabaseUrl ? 'SUPABASE_URL' : null,
      !supabaseAnonKey ? 'SUPABASE_ANON_KEY' : null
    ].filter(Boolean)
  });
};
