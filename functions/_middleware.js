// Security headers, CORS and page-view counting for public reading pages.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isAdminApi = path.startsWith('/api/admin') || path.startsWith('/api/auth');
  const corsOrigin = isAdminApi ? null : '*';
  if (context.request.method === 'OPTIONS') {
    if (isAdminApi) return new Response(null, {status:204});
    return new Response(null, {status:204, headers:{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type, Authorization',
      'Access-Control-Max-Age':'86400'
    }});
  }
  const contentLength = parseInt(context.request.headers.get('Content-Length') || '0',10);
  if (contentLength > 10 * 1024 * 1024) return Response.json({error:'Request too large'}, {status:413});
  if (isAdminApi && ['POST','PUT','DELETE'].includes(context.request.method)) {
    const ct = context.request.headers.get('Content-Type') || '';
    if (!ct.startsWith('application/json') && !ct.startsWith('multipart/form-data'))
      return Response.json({error:'Invalid Content-Type'},{status:415});
  }
  try {
    const response = await context.next();
    if (corsOrigin) {
      response.headers.set('Access-Control-Allow-Origin',corsOrigin);
      response.headers.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
    }
    response.headers.set('X-Frame-Options','DENY');
    response.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com; font-src 'self'; frame-ancestors 'none'");
    response.headers.set('X-Content-Type-Options','nosniff');
    response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    response.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');

    // Count HTML page loads, not the 5-15 API calls triggered by one page load.
    // Exclude author/admin and asset pages. A refresh is still one new PV.
    const publicPage = new Set(['/','/index.html','/book.html','/read.html']);
    if (context.request.method === 'GET' && response.ok && publicPage.has(path)) {
      context.waitUntil(trackVisit(context.env, context.request));
    }
    return response;
  } catch (err) {
    console.error('Internal error:',err);
    return Response.json({error:'Internal Server Error'}, {status:500});
  }
}

async function trackVisit(env, request) {
  try {
    const today = new Date().toISOString().slice(0,10);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + (env.IP_SALT || 'novel-site-default-salt')));
    const ipHash = [...new Uint8Array(hashBuf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    await env.DB.prepare('INSERT INTO site_visits (date,pv,uv) VALUES (?,1,0) ON CONFLICT(date) DO UPDATE SET pv=pv+1').bind(today).run();
    // Atomic duplicate check avoids counting the same IP twice under concurrency.
    const inserted = await env.DB.prepare('INSERT OR IGNORE INTO daily_visitors(date,ip_hash) VALUES (?,?)').bind(today,ipHash).run();
    if (inserted?.meta?.changes) {
      await env.DB.prepare('UPDATE site_visits SET uv=uv+1 WHERE date=?').bind(today).run();
    }
    if(Math.random()<0.1){
      const weekAgo=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
      await env.DB.prepare('DELETE FROM daily_visitors WHERE date<?').bind(weekAgo).run();
    }
    if(Math.random()<0.01){
      const ninetyDaysAgo=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
      await env.DB.prepare('DELETE FROM book_stats WHERE date<?').bind(ninetyDaysAgo).run();
    }
  } catch(e){console.error('Track visit error:',e);}
}
