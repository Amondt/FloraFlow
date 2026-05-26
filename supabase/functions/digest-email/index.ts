import { createClient } from 'npm:@supabase/supabase-js@2';
import type { QueryData } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../_shared/database.types.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type DigestPlant = {
  id: string;
  common_name: string;
  scientific_name: string | null;
  next_check_due_at: string;
  zone_name: string;
  status: 'Overdue' | 'Due today';
};

function buildHtml(
  displayName: string,
  zoneMap: Map<string, DigestPlant[]>,
  total: number,
): string {
  const zoneBlocks = [...zoneMap.entries()]
    .map(([zoneName, plants]) => {
      const plantRows = plants
        .map((p) => {
          // Overdue → danger palette  |  Due today → amber palette
          const badge =
            p.status === 'Overdue'
              ? `<span style="background:#fef2f2;color:#991b1b;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;">Overdue</span>`
              : `<span style="background:#fffbeb;color:#92400e;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;">Due today</span>`;
          const sciName = p.scientific_name
            ? `<span style="color:#94a3b8;font-size:13px;font-style:italic;"> — ${escapeHtml(p.scientific_name)}</span>`
            : '';
          return `<tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                <span style="font-weight:500;color:#1e293b;font-size:14px;">${escapeHtml(p.common_name)}</span>${sciName}
              </td>
              <td style="padding:10px 0 10px 16px;border-bottom:1px solid #f1f5f9;text-align:right;">${badge}</td>
            </tr>`;
        })
        .join('');

      return `<section style="margin-bottom:12px;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <div style="padding:10px 16px;background:#f0fdf4;border-bottom:1px solid #d1fae5;">
            <h3 style="margin:0;font-size:11px;font-weight:700;color:#047857;letter-spacing:0.08em;text-transform:uppercase;">&#127807; ${escapeHtml(zoneName)}</h3>
          </div>
          <div style="padding:0 16px;background:#ffffff;">
            <table style="width:100%;border-collapse:collapse;"><tbody>${plantRows}</tbody></table>
          </div>
        </section>`;
    })
    .join('');

  const plantWord = total === 1 ? 'plant' : 'plants';
  const needsWord = total === 1 ? 'needs' : 'need';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
    <header style="background:#064e3b;padding:28px 32px 24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6ee7b7;letter-spacing:0.1em;text-transform:uppercase;">Your plant digest</p>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">&#127807; FloraFlow</h1>
      <p style="margin:6px 0 0;color:#a7f3d0;font-size:14px;">Monday morning roundup</p>
    </header>
    <main style="padding:28px 32px 32px;">
      <p style="margin:0 0 6px;font-size:21px;font-weight:600;color:#0f172a;">Hi ${escapeHtml(displayName)},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
        You have <strong style="color:#047857;">${total} ${plantWord}</strong> that ${needsWord} your attention this week.
      </p>
      ${zoneBlocks}
      <a href="http://localhost:4200/scheduler"
         style="display:inline-block;background:#059669;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:20px;letter-spacing:0.01em;">
        Open Scheduler &#8594;
      </a>
    </main>
    <footer style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
        You&#39;re receiving this because you have plants registered in FloraFlow.
      </p>
    </footer>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  try {
    // Server-to-server auth: caller must present the Supabase service role key
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!token || token !== serviceRoleKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient<Database>(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);

    // Time boundaries for today in UTC
    const now = new Date();
    const startOfTodayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    // One query: plants + zone name + user display_name for all due/overdue rows
    const plantsSelectQuery = supabase
      .from('plants')
      .select(
        'id, common_name, scientific_name, next_check_due_at, user_id, zones ( name ), profiles ( display_name )',
      );
    type PlantRow = QueryData<typeof plantsSelectQuery>[number];

    const { data: plants, error: plantsError } = await plantsSelectQuery.lte(
      'next_check_due_at',
      endOfTodayUtc.toISOString(),
    );

    if (plantsError) throw plantsError;
    if (!plants || plants.length === 0) return json({ sent: 0, skipped: 0, errors: 0 });

    // Build userId → email map; perPage 1000 is sufficient for a small app
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    if (usersError) throw usersError;

    const emailByUserId = new Map<string, string>(
      usersData.users.map((u) => [u.id, u.email ?? '']),
    );

    // Group by user, then by zone
    type UserEntry = { display_name: string; zones: Map<string, DigestPlant[]> };
    const byUser = new Map<string, UserEntry>();

    for (const plant of plants as PlantRow[]) {
      const zoneName =
        plant.zones && !Array.isArray(plant.zones) && 'name' in plant.zones
          ? plant.zones.name
          : 'Unknown Zone';
      const displayName =
        plant.profiles && !Array.isArray(plant.profiles) && 'display_name' in plant.profiles
          ? plant.profiles.display_name
          : 'Gardener';

      const plantDate = new Date(plant.next_check_due_at);
      const status: 'Overdue' | 'Due today' = plantDate < startOfTodayUtc ? 'Overdue' : 'Due today';

      if (!byUser.has(plant.user_id)) {
        byUser.set(plant.user_id, { display_name: displayName, zones: new Map() });
      }
      const userEntry = byUser.get(plant.user_id)!;
      if (!userEntry.zones.has(zoneName)) userEntry.zones.set(zoneName, []);
      userEntry.zones.get(zoneName)!.push({
        id: plant.id,
        common_name: plant.common_name,
        scientific_name: plant.scientific_name,
        next_check_due_at: plant.next_check_due_at,
        zone_name: zoneName,
        status,
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const [userId, { display_name, zones }] of byUser) {
      const email = emailByUserId.get(userId);
      if (!email) {
        skipped++;
        continue;
      }

      const total = [...zones.values()].reduce((sum, arr) => sum + arr.length, 0);
      const plantWord = total === 1 ? 'plant' : 'plants';
      const needsWord = total === 1 ? 'needs' : 'need';
      const subject = `Your FloraFlow plant digest — ${total} ${plantWord} ${needsWord} attention`;
      const html = buildHtml(display_name, zones, total);

      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FloraFlow <onboarding@resend.dev>',
            to: [email],
            subject,
            html,
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.error(`Resend error for ${email} (${resp.status}):`, body);
          errors++;
        } else {
          sent++;
        }
      } catch (sendErr) {
        console.error(`Failed to send email to ${email}:`, sendErr);
        errors++;
      }
    }

    return json({ sent, skipped, errors });
  } catch (err) {
    console.error('digest-email fatal error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
