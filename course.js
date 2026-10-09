(async () => {
  const ctx = await A.init('courses'); if (!ctx) return;
  const { s, p } = ctx, app = A.$('#app'), qs = new URLSearchParams(location.search), cid = qs.get('id');
  const notFound = (t = 'الكورس غير موجود', m = 'قد يكون الرابط خاطئًا أو أن الكورس غير منشور.') => (app.innerHTML = `<div class="wrap"><div class="empty"><h2>${t}</h2><p>${m}</p><a class="btn" href="courses.html">العودة إلى الكورسات</a></div></div>`);
  if (!A.uuid(cid)) return notFound();
  let course, lessons, acc, done = new Set();
  try {
    const sess = await A.session();
    const [c, l, a, pr] = await Promise.all([
      A.sb.from('courses').select('*').eq('id', cid).maybeSingle(),
      A.sb.from('lessons').select('id,title,description,sort_order,is_free').eq('course_id', cid).order('sort_order').order('created_at'),
      A.myAccess(),
      sess ? A.sb.from('lesson_progress').select('lesson_id').eq('user_id', sess.user.id) : Promise.resolve({ data: [] })
    ]);
    if (c.error) throw c.error; if (l.error) throw l.error; if (pr.error) throw pr.error;
    course = c.data; lessons = l.data; acc = a; done = new Set(pr.data.map((r) => r.lesson_id));
  } catch (e) { app.innerHTML = `<div class="wrap">${A.errBox(e)}</div>`; return; }
  if (!course) return notFound();
  document.title = course.title + ' | العلّامة';
  const logged = !!p, banned = !!(p && p.is_banned), isAdmin = !!(p && p.role === 'admin');
  const hasAccess = !banned && (isAdmin || course.is_free || acc.has(cid));
  const canSee = (l) => !banned && logged && (hasAccess || l.is_free);
  let cur = null;

  app.innerHTML = `<div class="wrap"><div class="chead"><div class="meta">${course.is_free ? '<span class="badge info">مجاني</span>' : `<span class="badge">${A.price(course, s)}</span>`}${hasAccess && !course.is_free ? '<span class="badge ok">مشترك</span>' : ''}${course.category ? `<span class="badge soft">${A.esc(course.category)}</span>` : ''}</div>
    <h1>${A.esc(course.title)}</h1><p class="muted">المدرّس: ${A.esc(course.teacher_name)} • ${lessons.length} درس</p></div>
    ${banned ? '<div class="notice err">حسابك محظور حاليًا، لذلك لا يمكنك فتح محتوى الدروس. تواصل مع الدعم.</div>' : ''}
    <div class="layout"><aside class="card"><div class="pad" id="prog"></div><ul class="lessons" id="ll"></ul></aside><div><div class="card pad" id="main"></div></div></div></div>`;
  const main = A.$('#main'), ll = A.$('#ll');

  const intro = () => `<h2>عن الكورس</h2><p style="white-space:pre-line">${A.esc(course.description) || '<span class="muted">لا يوجد وصف.</span>'}</p>
    ${!hasAccess && !course.is_free ? `<div class="notice warn">هذا كورس مدفوع. الدروس المجانية فقط متاحة لك الآن.</div><button class="btn" id="subbtn">الاشتراك في الكورس</button>` : ''}
    ${!logged ? `<div class="notice">سجّل الدخول لمشاهدة الدروس. <a href="auth.html?next=${encodeURIComponent('course.html?id=' + cid)}">تسجيل الدخول</a></div>` : ''}
    ${lessons.length ? '<p class="muted">اختر درسًا من القائمة للبدء.</p>' : '<div class="empty">لا توجد دروس منشورة في هذا الكورس بعد.</div>'}`;
  const drawList = () => {
    const n = lessons.filter((l) => done.has(l.id)).length, pct = lessons.length ? Math.round((n / lessons.length) * 100) : 0;
    A.$('#prog').innerHTML = logged ? `<b>تقدّمك: ${n} من ${lessons.length}</b><div class="bar-prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>` : '<b>دروس الكورس</b>';
    ll.innerHTML = lessons.map((l, i) => `<li class="${cur === l.id ? 'cur' : ''} ${done.has(l.id) ? 'done' : ''}"><button data-l="${l.id}"><span class="n">${done.has(l.id) ? '✓' : i + 1}</span><span>${A.esc(l.title)}</span><span class="lk">${canSee(l) ? (l.is_free && !hasAccess ? 'مجاني' : '') : '🔒 مقفول'}</span></button></li>`).join('') || '<li class="muted pad">لا توجد دروس.</li>';
  };
  const bindSub = () => { const b = A.$('#subbtn'); if (b) b.onclick = () => A.subscribeDialog(course.title, s); };

  async function open(id, push = true) {
    const l = lessons.find((x) => x.id === id); if (!l) return;
    cur = id; drawList(); if (push) history.pushState(null, '', `?id=${cid}&lesson=${id}`);
    if (!logged) { main.innerHTML = `<h2>${A.esc(l.title)}</h2><div class="notice warn">يلزم تسجيل الدخول لمشاهدة الدروس.</div><a class="btn" href="auth.html?next=${encodeURIComponent(`course.html?id=${cid}&lesson=${id}`)}">تسجيل الدخول</a>`; return; }
    if (banned) { main.innerHTML = `<h2>${A.esc(l.title)}</h2><div class="notice err">حسابك محظور ولا يمكنك فتح هذا المحتوى.</div>`; return; }
    main.innerHTML = A.loading();
    // الخادم هو من يقرر: إن لم تكن لديك صلاحية فلن يُرجع الصف أصلًا
    const { data, error } = await A.sb.from('lesson_content').select('video_url,attachments').eq('lesson_id', id).maybeSingle();
    if (cur !== id) return;
    if (error) { main.innerHTML = A.errBox(error); return; }
    if (!data) {
      main.innerHTML = `<h2>${A.esc(l.title)}</h2>` + (canSee(l)
        ? '<div class="notice">لم يُضَف محتوى لهذا الدرس بعد.</div>'
        : `<div class="notice err"><b>ليس لديك صلاحية لفتح هذا الدرس.</b><p>هذا الدرس ضمن كورس مدفوع. يلزمك الاشتراك في الكورس للوصول إليه.</p></div><button class="btn" id="subbtn">الاشتراك في الكورس</button>`);
      bindSub(); return;
    }
    const v = data.video_url ? A.parseVideo(data.video_url) : null;
    const files = (Array.isArray(data.attachments) ? data.attachments : []).filter((f) => A.safeUrl(f.url));
    const player = !data.video_url ? '' : !v ? '<div class="notice err">رابط الفيديو غير صالح. أبلغ الدعم الفني.</div>'
      : v.type === 'video' ? `<div class="player"><video controls controlsList="nodownload" preload="metadata" src="${A.esc(v.src)}"></video></div>`
      : `<div class="player"><iframe src="${A.esc(v.src)}" title="${A.esc(l.title)}" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    main.innerHTML = `<h2>${A.esc(l.title)}</h2>${player}<p style="white-space:pre-line">${A.esc(l.description)}</p>
      ${files.length ? `<h3>ملفات مرفقة</h3><ul class="files">${files.map((f) => `<li><a href="${A.esc(A.safeUrl(f.url))}" target="_blank" rel="noopener">${A.esc(f.name || 'ملف')}</a></li>`).join('')}</ul>` : ''}
      <div class="row"><button class="btn ${done.has(id) ? 'ghost' : ''}" id="dn">${done.has(id) ? 'إلغاء علامة الإكمال' : 'تم إكمال الدرس ✓'}</button></div>`;
    A.$('#dn').onclick = async (e) => {
      const b = e.currentTarget; if (b.disabled) return; b.disabled = true;
      const sess = await A.session();
      if (!sess) { A.toast('انتهت الجلسة. سجّل الدخول من جديد.', 'err'); b.disabled = false; return; }
      const r = done.has(id) ? await A.sb.from('lesson_progress').delete().eq('user_id', sess.user.id).eq('lesson_id', id)
        : await A.sb.from('lesson_progress').insert({ user_id: sess.user.id, lesson_id: id });
      if (r.error) { A.toast(A.errMsg(r.error), 'err'); b.disabled = false; return; }
      done.has(id) ? done.delete(id) : done.add(id); open(id, false);
    };
  }
  ll.addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (b) open(b.dataset.l); });
  window.addEventListener('popstate', () => { const l = new URLSearchParams(location.search).get('lesson'); l ? open(l, false) : ((cur = null), drawList(), (main.innerHTML = intro()), bindSub()); });
  drawList(); main.innerHTML = intro(); bindSub();
  const first = qs.get('lesson'); if (A.uuid(first)) open(first, false);
})();
