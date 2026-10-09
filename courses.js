(async () => {
  const ctx = await A.init('courses'); if (!ctx) return;
  const { s } = ctx, app = A.$('#app');
  let all = [], acc = new Set();
  try {
    const [c, a] = await Promise.all([A.sb.from('courses').select('*, lessons(count)').eq('is_published', true).order('sort_order'), A.myAccess()]);
    if (c.error) throw c.error; all = c.data; acc = a;
  } catch (e) { app.innerHTML = `<div class="wrap">${A.errBox(e)}</div>`; return; }
  const cats = [...new Set(all.map((c) => c.category).filter(Boolean))];
  app.innerHTML = `<div class="wrap" style="padding:30px 0"><h1>الكورسات</h1>
    <div class="toolbar"><div><label for="q">بحث</label><input id="q" type="search" placeholder="اسم الكورس أو وصفه"></div>
    <div><label for="cat">التصنيف</label><select id="cat"><option value="">كل التصنيفات</option>${cats.map((c) => `<option>${A.esc(c)}</option>`).join('')}</select></div>
    <div><label for="srt">الترتيب</label><select id="srt"><option value="order">الترتيب الافتراضي</option><option value="new">الأحدث</option><option value="lo">السعر: الأقل</option><option value="hi">السعر: الأعلى</option></select></div></div>
    <div id="list"></div></div>`;
  const list = A.$('#list');
  const draw = () => {
    const q = A.$('#q').value.trim().toLowerCase(), cat = A.$('#cat').value, st = A.$('#srt').value;
    let r = all.filter((c) => (!cat || c.category === cat) && (!q || (c.title + ' ' + c.description).toLowerCase().includes(q)));
    const pr = (c) => (c.is_free ? 0 : Number(c.price));
    if (st === 'new') r.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (st === 'lo') r.sort((a, b) => pr(a) - pr(b)); else if (st === 'hi') r.sort((a, b) => pr(b) - pr(a));
    list.innerHTML = r.length ? `<div class="grid">${r.map((c) => A.courseCard(c, s, acc.has(c.id))).join('')}</div>`
      : `<div class="empty">${all.length ? 'لا توجد كورسات مطابقة للبحث.' : 'لا توجد كورسات منشورة حاليًا.'}</div>`;
  };
  ['input', 'change'].forEach((ev) => app.addEventListener(ev, (e) => { if (e.target.closest('.toolbar')) draw(); }));
  A.bindSubscribe(app, s); draw();
})();
