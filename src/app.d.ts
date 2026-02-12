import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

import type { ActiveMembership } from '$lib/server/auth/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
			membership: ActiveMembership | null;
		}
		interface PageData {
			userEmail?: string | null;
			membership?: ActiveMembership | null;
		}
	}
}

export {};
