(async () => {
  const ctx = await A.init('account'); if (!ctx) return;
  const app = A.$('#app'), sess = await A.session();
  if (!sess) { location.href = 'auth.html?next=account.html'; return; }
  const p = ctx.p; if (!p) { app.innerHTML = '<div class="wrap"><div class="notice err">تعذّر العثور على ملفك الشخصي.</div></div>'; return; }
  let access = [], subs = [], lessons = [], done = new Set();
  try {
    const [a, s, d] = await Promise.all([
      A.sb.from('course_access').select('course_id,expires_at,courses(id,title,is_published)').eq('user_id', p.id),
      A.sb.from('subscriptions').select('*,courses(title)').eq('user_id', p.id).order('created_at', { ascending: false }),
      A.sb.from('lesson_progress').select('lesson_id').eq('user_id', p.id)
    ]);
    for (const r of [a, s, d]) if (r.error) throw r.error;
    access = a.data; subs = s.data; done = new Set(d.data.map((r) => r.lesson_id));
    const ids = access.map((x) => x.course_id);
    if (ids.length) { const l = await A.sb.from('lessons').select('id,course_id').in('course_id', ids); if (l.error) throw l.error; lessons = l.data; }
  } catch (e) { app.innerHTML = `<div class="wrap">${A.errBox(e)}</div>`; return; }

  const eff = (x) => (x.status === 'active' && x.ends_at && new Date(x.ends_at) < new Date() ? 'expired' : x.status);
  const lbl = { active: ['نشط', 'ok'], expired: ['منتهٍ', 'warn'], cancelled: ['ملغى', 'bad'], pending: ['قيد الانتظار', 'info'] };
  const myCourses = access.filter((x) => x.courses && (!x.expires_at || new Date(x.expires_at) > new Date()));
  app.innerHTML = `<div class="wrap" style="padding:30px 0"><h1>حسابي</h1>
    ${p.is_banned ? '<div class="notice err"><b>حسابك محظور.</b> لا يمكنك الوصول إلى محتوى الدروس. تواصل مع الدعم الفني.</div>' : ''}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card pad"><h3>بياناتي</h3><form id="pf" novalidate><label for="nm">الاسم الكامل</label><input id="nm" name="name" value="${A.esc(p.full_name)}" maxlength="100" required>
      <label for="em">البريد الإلكتروني</label><input id="em" value="${A.esc(p.email || sess.user.email)}" dir="ltr" disabled>
      <label for="ph">رقم الهاتف</label><input id="ph" name="phone" value="${A.esc(p.phone || '')}" dir="ltr" inputmode="tel">
      <p class="hint">تاريخ إنشاء الحساب: ${A.date(p.created_at)}</p><div class="row"><button class="btn" type="submit">حفظ التعديلات</button></div></form></div>
    <div class="card pad"><h3>تغيير كلمة المرور</h3><form id="pw" novalidate><label for="n1">كلمة المرور الجديدة (8 أحرف على الأقل)</label><input id="n1" name="p1" type="password" autocomplete="new-password">
      <label for="n2">تأكيد كلمة المرور</label><input id="n2" name="p2" type="password" autocomplete="new-password"><div class="row"><button class="btn" type="submit">تغيير</button></div></form></div></div>
    <h2 style="margin-top:30px">كورساتي</h2>
    ${myCourses.length ? `<div class="grid">${myCourses.map((x) => { const ls = lessons.filter((l) => l.course_id === x.course_id), n = ls.filter((l) => done.has(l.id)).length, pct = ls.length ? Math.round((n / ls.length) * 100) : 0;
      return `<div class="card pad"><h3>${A.esc(x.courses.title)}</h3><p class="muted">${ls.length} درس متاح • أنجزت ${n}</p><div class="bar-prog"><i style="width:${pct}%"></i></div>${x.expires_at ? `<p class="hint">ينتهي الوصول: ${A.date(x.expires_at)}</p>` : ''}<a class="btn" href="course.html?id=${x.course_id}">متابعة الدروس</a></div>`; }).join('')}</div>`
      : '<div class="empty">ليس لديك كورسات مشترك بها حاليًا. <a href="courses.html">تصفّح الكورسات</a> — الكورسات المجانية متاحة لك مباشرة.</div>'}
    <h2 style="margin-top:30px">حالة الاشتراكات</h2>
    ${subs.length ? `<div class="card tw"><table><thead><tr><th>الكورس</th><th>الحالة</th><th>البداية</th><th>النهاية</th></tr></thead><tbody>${subs.map((x) => { const st = eff(x), l = lbl[st] || [st, '']; return `<tr><td>${A.esc(x.courses ? x.courses.title : '—')}</td><td><span class="badge ${l[1]}">${l[0]}</span></td><td>${A.date(x.starts_at)}</td><td>${x.ends_at ? A.date(x.ends_at) : 'مفتوح'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">لا توجد اشتراكات مسجّلة.</div>'}</div>`;

  A.submit(A.$('#pf'), async (fd) => {
    const name = fd.get('name').trim(), ph = fd.get('phone').replace(/[\s-]/g, '');
    if (name.length < 3) throw A.fail('اكتب اسمك الكامل (3 أحرف على الأقل).');
    if (ph && !/^[0-9+]{7,15}$/.test(ph)) throw A.fail('رقم الهاتف غير صحيح.');
    const { error } = await A.sb.from('profiles').update({ full_name: name, phone: ph || null }).eq('id', p.id);
    if (error) throw error; A._p = null; A.toast('تم حفظ بياناتك');
  });
  A.submit(A.$('#pw'), async (fd, f) => {
    if (fd.get('p1').length < 8) throw A.fail('كلمة المرور يجب ألا تقل عن 8 أحرف.');
    if (fd.get('p1') !== fd.get('p2')) throw A.fail('تأكيد كلمة المرور غير مطابق.');
    const { error } = await A.sb.auth.updateUser({ password: fd.get('p1') }); if (error) throw error;
    f.reset(); A.toast('تم تغيير كلمة المرور');
  });
})();
