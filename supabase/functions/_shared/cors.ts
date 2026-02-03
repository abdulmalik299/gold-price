export const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, x-requested-with',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
