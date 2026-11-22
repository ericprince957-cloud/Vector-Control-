import type { CookieOptions } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes sessions.
          }
        }
      }
    }
  );
}

/**
 * Server-only administrative client. Uses the service-role key and bypasses RLS.
 * Use only in server actions after verifying the caller's identity and permissions.
 */
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Server not configured: SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
