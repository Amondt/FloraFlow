import { createClient } from 'npm:@supabase/supabase-js@2';
import webPush from 'npm:web-push';
import type { Database } from '../_shared/database.types.ts';
import { verifyCronSecret } from '../_shared/cron-auth.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Minimal shape of a serialised browser PushSubscription stored in profiles.push_subscription
interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  try {
    if (!verifyCronSecret(req)) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    webPush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );

    // All profiles that have a stored push endpoint
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, push_subscription')
      .not('push_subscription', 'is', null);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) return json({ sent: 0, skipped: 0, errors: 0 });

    const now = new Date().toISOString();

    // Single query for all due/overdue plants across every subscribed user,
    // replacing the previous one-query-per-user loop (N+1 pattern).
    const { data: duePlants, error: plantsError } = await supabase
      .from('plants')
      .select('user_id')
      .in(
        'user_id',
        profiles.map((p) => p.id),
      )
      .lte('next_check_due_at', now);

    if (plantsError) {
      console.error('Due-plant batch query failed:', plantsError);
      return json({ error: 'Failed to query plants' }, 500);
    }

    // Group counts by user in memory
    const duePlantCountByUser = new Map<string, number>();
    for (const plant of duePlants ?? []) {
      duePlantCountByUser.set(plant.user_id, (duePlantCountByUser.get(plant.user_id) ?? 0) + 1);
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const profile of profiles) {
      const count = duePlantCountByUser.get(profile.id) ?? 0;
      if (count === 0) {
        skipped++;
        continue;
      }

      // Angular ngsw push envelope — the built-in service worker handler renders it automatically
      const payload = JSON.stringify({
        notification: {
          title: 'FloraFlow',
          body: `${count} plant${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention today`,
          data: {
            onActionClick: {
              default: { operation: 'navigateLastFocusedOrOpen', url: '/scheduler' },
            },
          },
        },
      });

      try {
        const subscription = profile.push_subscription as unknown as StoredPushSubscription;
        await webPush.sendNotification(subscription, payload);
        sent++;
      } catch (pushErr) {
        console.error(`Push failed for user ${profile.id}:`, pushErr);
        errors++;
      }
    }

    return json({ sent, skipped, errors });
  } catch (err) {
    console.error('push-plant-alerts fatal error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
