/* Save manual chapter grouping, live titles and D1 reading order together. */
import { checkAdmin, requireSuperAdmin, parseJsonBody } from '../_utils.js';

const validId = id => /^[1-9]\d*$/.test(String(id ?? ''));

export async function onRequestPut({ request, env }) {
  const auth = await checkAdmin(request,env);
  if (!auth.ok) return Response.json({error:'请先登录作者后台'}, {status:401});
  if (!requireSuperAdmin(auth)) return Response.json({error:'仅网站所有者可以编辑目录'}, {status:403});

  const bookId = new URL(request.url).searchParams.get('bookId');
  if (!validId(bookId)) return Response.json({error:'作品编号无效'}, {status:400});
  const book = await env.DB.prepare("SELECT id FROM books WHERE id=? AND (status IS NULL OR status='normal')").bind(bookId).first();
  if (!book) return Response.json({error:'作品不存在或已经下架'}, {status:404});

  const body = await parseJsonBody(request);
  if (!body || !Array.isArray(body.items) || body.items.length > 500)
    return Response.json({error:'目录应为数组，最多500个篇目'}, {status:400});

  const existing = await env.DB.prepare('SELECT id FROM chapters WHERE book_id=?').bind(bookId).all();
  const allowed = new Set((existing.results||[]).map(ch=>Number(ch.id)));
  if (allowed.size !== body.items.length)
    return Response.json({error:'作品的章节数量发生变化，请刷新工作台再保存'}, {status:409});

  const seen = new Set(), items = [], groupsClosed = new Set();
  let lastGroup = null;
  for (const row of body.items) {
    const id = Number(row?.chapterId);
    const groupTitle = typeof row?.groupTitle === 'string' ? row.groupTitle.trim() : '';
    const sectionTitle = typeof row?.sectionTitle === 'string' ? row.sectionTitle.trim() : '';
    const kind = row?.kind;
    if (!Number.isSafeInteger(id) || !allowed.has(id) || seen.has(id))
      return Response.json({error:'目录含无效、重复或不属于本书的章节'}, {status:400});
    if (!groupTitle || groupTitle.length>200 || !sectionTitle || sectionTitle.length>200)
      return Response.json({error:'大章标题及小节标题均须填写且不能超过200字符'}, {status:400});
    if (kind !== 'main' && kind !== 'extra')
      return Response.json({error:'分类必须为正文或番外'}, {status:400});

    const groupKey = kind + '\u0000' + groupTitle;
    if (groupKey !== lastGroup) {
      if (groupsClosed.has(groupKey))
        return Response.json({error:'相同大章的小节必须连续排列，请先完成分组'}, {status:400});
      if (lastGroup !== null) groupsClosed.add(lastGroup);
      lastGroup = groupKey;
    }
    seen.add(id);
    items.push({ chapterId:id, groupTitle, sectionTitle, kind });
  }

  // D1 batch executes transactionally. Titles are real chapter names, rather than
  // display-only aliases, so reader heading / prev-next / legacy admin all agree.
  const operations = items.map((row, i) => env.DB.prepare(`
    UPDATE chapters SET sort_order=?, title=?,
      updated_at=CASE WHEN title<>? THEN datetime('now') ELSE updated_at END,
      version=CASE WHEN title<>? THEN COALESCE(version,0)+1 ELSE COALESCE(version,0) END
    WHERE id=? AND book_id=?
  `).bind(i+1, row.sectionTitle, row.sectionTitle, row.sectionTitle, row.chapterId, bookId));
  operations.push(env.DB.prepare(`
    INSERT INTO site_settings (key,value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).bind('archive_structure_'+bookId,JSON.stringify(items)));
  operations.push(env.DB.prepare("UPDATE books SET updated_at=datetime('now') WHERE id=?").bind(bookId));
  await env.DB.batch(operations);
  return Response.json({success:true,count:items.length}, {headers:{'Cache-Control':'no-store'}});
}
