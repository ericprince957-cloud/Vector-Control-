import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions
          }
        }
      }
    }
  );
}

/**
 * Server-only administrative client. Uses the service-role key and bypasses RLS.
 * May ONLY be used inside server actions after the caller's identity and
 * permissions have been verified (see src/lib/auth.ts and src/actions/staff.ts).
 */
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing');
  }
  return createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
