(async () => {
  const ctx = await A.init('home'); if (!ctx) return;
  const { s } = ctx, app = A.$('#app');
  let courses = [], lessons = [], acc = new Set();
  try {
    const [c, l, a] = await Promise.all([
      A.sb.from('courses').select('*, lessons(count)').eq('is_published', true).order('sort_order').limit(6),
      A.sb.from('lessons').select('id,title,created_at,is_free,course_id,courses(title)').order('created_at', { ascending: false }).limit(6),
      A.myAccess()
    ]);
    if (c.error) throw c.error; if (l.error) throw l.error;
    courses = c.data; lessons = l.data; acc = a;
  } catch (e) { app.innerHTML = `<div class="wrap">${A.errBox(e)}</div>`; return; }

  const feats = Array.isArray(s.features) ? s.features : [], faq = Array.isArray(s.faq) ? s.faq : [];
  const heroImg = A.safeUrl(s.hero_image), photo = A.safeUrl(s.teacher_photo), links = A.contactLinks(s);
  app.innerHTML = `
  <section class="hero"><div class="wrap"><div><h1>${A.esc(s.hero_title || s.platform_name)}</h1><p>${A.esc(s.hero_text || '')}</p>
    <div class="row"><a class="btn" style="background:#fff;color:var(--g900)" href="courses.html">تصفّح الكورسات</a><a class="btn ghost" href="auth.html?mode=register">إنشاء حساب</a></div></div>
    ${heroImg ? `<img src="${A.esc(heroImg)}" alt="">` : ''}</div></section>
  <section class="sec" id="courses"><div class="wrap"><h2>الكورسات المتاحة</h2><p class="sub">أحدث الكورسات المنشورة على المنصة</p>
    ${courses.length ? `<div class="grid">${courses.map((c) => A.courseCard(c, s, acc.has(c.id))).join('')}</div><div class="row" style="justify-content:center"><a class="btn ghost" href="courses.html">عرض كل الكورسات</a></div>` : '<div class="empty">لا توجد كورسات منشورة حاليًا. تابعنا قريبًا.</div>'}</div></section>
  <section class="sec alt" id="latest"><div class="wrap"><h2>أحدث الدروس المضافة</h2><p class="sub">دروس نُشرت مؤخرًا</p>
    ${lessons.length ? `<div class="grid">${lessons.map((l) => `<a class="card pad" style="color:inherit" href="course.html?id=${l.course_id}&lesson=${l.id}"><b>${A.esc(l.title)}</b><div class="muted">${A.esc(l.courses ? l.courses.title : '')}</div><div class="meta" style="margin-top:6px">${l.is_free ? '<span class="badge info">درس مجاني</span>' : ''}<span class="muted" style="font-size:13px">${A.date(l.created_at)}</span></div></a>`).join('')}</div>` : '<div class="empty">لم تُضَف دروس بعد.</div>'}</div></section>
  ${feats.length ? `<section class="sec" id="features"><div class="wrap"><h2>مميزات المنصة</h2><p class="sub"></p><div class="features">${feats.map((f) => `<div class="card"><h3>${A.esc(f.title)}</h3><p>${A.esc(f.text)}</p></div>`).join('')}</div></div></section>` : ''}
  ${s.teacher_bio ? `<section class="sec alt" id="teacher"><div class="wrap"><h2>${A.esc(s.teacher_name || 'عن الأستاذ')}</h2><p class="sub"></p><div class="about card pad">${photo ? `<img src="${A.esc(photo)}" alt="${A.esc(s.teacher_name)}">` : '<span></span>'}<p>${A.esc(s.teacher_bio)}</p></div></div></section>` : ''}
  ${faq.length ? `<section class="sec" id="faq"><div class="wrap" style="max-width:780px"><h2>الأسئلة الشائعة</h2><p class="sub"></p>${faq.map((f) => `<details><summary>${A.esc(f.q)}</summary><p>${A.esc(f.a)}</p></details>`).join('')}</div></section>` : '<span id="faq"></span>'}
  <section class="sec alt" id="contact"><div class="wrap"><h2>التواصل والدعم الفني</h2><p class="sub">${links ? 'يسعدنا تواصلك معنا' : 'لم تُضَف بيانات التواصل بعد.'}</p>${links ? `<div class="contact-list">${links}</div>` : ''}</div></section>`;
  A.bindSubscribe(app, s);
  if (location.hash) { const t = A.$(location.hash); if (t) t.scrollIntoView(); }
})();
