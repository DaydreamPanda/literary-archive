// Public author profile. Stored in Novel Site's existing site_settings table.
// This endpoint only returns a fixed set of safe, public profile fields.
export async function onRequestGet({env}) {
  const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'archive_profile'").first();
  let profile = {};
  if (row?.value) {
    try {
      const raw = JSON.parse(row.value);
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const field of ['authorName','biography','announcement','avatarUrl']) {
          if (typeof raw[field] === 'string') profile[field] = raw[field];
        }
        if (Array.isArray(raw.links)) profile.links = raw.links.filter(x =>
          x && typeof x.label === 'string' && typeof x.url === 'string' && /^https:\/\//.test(x.url)
        ).slice(0, 8).map(x=>({label:x.label,url:x.url}));
      }
    } catch {}
  }
  return Response.json({profile}, {headers:{'Cache-Control':'public, max-age=60'}});
}
