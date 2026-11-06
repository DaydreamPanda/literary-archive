// Public: get per-book chapter grouping. Stored alongside site settings in D1.
export async function onRequestGet({ request, env }) {
  const bookId = new URL(request.url).searchParams.get('bookId');
  if (!/^[1-9]\d*$/.test(bookId || '')) return Response.json({error:'无效作品编号'}, {status:400});
  const book = await env.DB.prepare("SELECT id FROM books WHERE id=? AND (status IS NULL OR status='normal')").bind(bookId).first();
  if (!book) return Response.json({error:'作品不存在'}, {status:404});
  const row = await env.DB.prepare('SELECT value FROM site_settings WHERE key=?').bind('archive_structure_'+bookId).first();
  let items=[];
  if(row?.value){try{const parsed=JSON.parse(row.value);if(Array.isArray(parsed))items=parsed;}catch{}}
  return Response.json({items}, {headers:{'Cache-Control':'public, max-age=30'}});
}
