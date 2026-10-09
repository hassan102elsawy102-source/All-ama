(() => {
  const E = A.esc;
  const effStatus = (x) => (x.status === 'active' && x.ends_at && new Date(x.ends_at) < new Date() ? 'expired' : x.status);
  const SL = { active: ['نشط', 'ok'], expired: ['منتهٍ', 'warn'], cancelled: ['ملغى', 'bad'], pending: ['قيد الانتظار', 'info'] };
  const PM = { manual: 'يدوي (من المدير)', cash: 'نقدًا', transfer: 'تحويل' }, PS = { manual: 'يدوي', paid: 'مدفوع', failed: 'فشل', none: 'غير مفعّل' };
  const endIso = (d) => (d ? new Date(d + 'T23:59:59').toISOString() : null);
  const toDay = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

  AD.pages.students = async (view) => {
    let term = '';
    const load = async () => {
      let q = A.sb.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }).limit(100);
      const t = term.replace(/[,()%*\\]/g, '').trim(); if (t) q = q.or(`full_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`);
      const { data, error } = await q; const box = A.$('#sl', view); if (error) { box.innerHTML = A.errBox(error); return; }
      AD.cache.students = data;
      box.innerHTML = data.length ? `<div class="card tw"><table><thead><tr><th>الطالب</th><th>الهاتف</th><th>تاريخ التسجيل</th><th>الحالة</th><th></th></tr></thead><tbody>${data.map((s) => `<tr><td><b>${E(s.full_name || '—')}</b><div class="hint" dir="ltr" style="text-align:start">${E(s.email || '')}</div></td><td dir="ltr" style="text-align:start">${E(s.phone || '—')}</td><td>${A.date(s.created_at)}</td>
        <td><span class="badge ${s.is_banned ? 'bad' : 'ok'}">${s.is_banned ? 'محظور' : 'نشط'}</span></td><td><button class="btn sm" data-a="open" data-id="${s.id}">إدارة</button></td></tr>`).join('')}</tbody></table></div>${data.length === 100 ? '<p class="hint">يظهر أول 100 نتيجة؛ استخدم البحث لتضييق النتائج.</p>' : ''}` : `<div class="empty">${t ? 'لا توجد نتائج مطابقة.' : 'لا يوجد طلاب مسجّلون بعد.'}</div>`;
    };
    view.innerHTML = `<div class="bar2"><h1>إدارة الطلاب</h1><div class="f"><div><label for="sq">بحث (اسم / بريد / هاتف)</label><input id="sq" type="search"></div></div></div><div id="sl"></div>`;
    let tm; A.$('#sq', view).oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { term = e.target.value; load(); }, 350); };

    async function openStudent(id) {
      const s = AD.cache.students.find((x) => x.id === id) || AD.cache.openStudent; if (!s) return; AD.cache.openStudent = s;
      const d = A.modal(A.loading(), { wide: true });
      const [ac, sb, cs] = await Promise.all([
        A.sb.from('course_access').select('course_id,expires_at,granted_at,courses(title)').eq('user_id', id),
        A.sb.from('subscriptions').select('*,courses(title)').eq('user_id', id).order('created_at', { ascending: false }),
        A.sb.from('courses').select('id,title').order('sort_order')]);
      const er = ac.error || sb.error || cs.error; if (er) { d.innerHTML = A.errBox(er); return; }
      d.innerHTML = `<h3>${E(s.full_name || 'طالب')}</h3><div class="two"><div><p><b>البريد:</b> <bdi>${E(s.email || '—')}</bdi><br><b>الهاتف:</b> <bdi>${E(s.phone || '—')}</bdi><br><b>تاريخ إنشاء الحساب:</b> ${A.date(s.created_at)}<br><b>الحالة:</b> <span class="badge ${s.is_banned ? 'bad' : 'ok'}">${s.is_banned ? 'محظور' : 'نشط'}</span></p>
        <button class="btn ${s.is_banned ? '' : 'danger'} sm" id="ban">${s.is_banned ? 'إلغاء الحظر' : 'حظر الحساب'}</button></div>
        <div><b>الكورسات المسموح بها</b>${ac.data.length ? `<ul>${ac.data.map((a) => `<li>${E(a.courses ? a.courses.title : '—')} <span class="hint">${a.expires_at ? 'حتى ' + A.date(a.expires_at) : 'بدون انتهاء'}</span> <button class="btn sm danger" data-rv="${a.course_id}">إلغاء</button></li>`).join('')}</ul>` : '<p class="muted">لا توجد صلاحيات بعد.</p>'}</div></div>
        <hr><h4>منح صلاحية الوصول إلى كورس</h4><form id="gf" novalidate><div class="grid2"><div><label for="gc">الكورس</label><select id="gc">${cs.data.map((c) => `<option value="${c.id}">${E(c.title)}</option>`).join('')}</select></div>
        <div><label for="ge">ينتهي في (اختياري)</label><input id="ge" type="date"></div><div><label for="gp">السعر المسجَّل (اختياري)</label><input id="gp" type="number" min="0" step="0.01"></div>
        <div><label for="gm">طريقة الدفع</label><select id="gm"><option value="manual">يدوي (من المدير)</option><option value="cash">نقدًا</option><option value="transfer">تحويل</option></select></div></div>
        <div class="row"><button class="btn" type="submit" ${cs.data.length ? '' : 'disabled'}>منح الصلاحية</button></div></form>
        <h4>سجل الاشتراكات</h4>${sb.data.length ? `<div class="tw"><table><thead><tr><th>الكورس</th><th>الحالة</th><th>النهاية</th></tr></thead><tbody>${sb.data.map((x) => { const l = SL[effStatus(x)] || [x.status, '']; return `<tr><td>${E(x.courses ? x.courses.title : '—')}</td><td><span class="badge ${l[1]}">${l[0]}</span></td><td>${x.ends_at ? A.date(x.ends_at) : 'مفتوح'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">لا توجد اشتراكات.</p>'}
        <div class="row"><button class="btn ghost" onclick="A.closeModal()">إغلاق</button></div>`;
      const fresh = async () => { const r = await A.sb.from('profiles').select('*').eq('id', id).single(); if (!r.error) { AD.cache.openStudent = r.data; const i = AD.cache.students.findIndex((x) => x.id === id); if (i > -1) AD.cache.students[i] = r.data; } };
      A.$('#ban', d).onclick = async (e) => {
        if (s.id === AD.me.id) return A.toast('لا يمكنك حظر حسابك.', 'err');
        if (!s.is_banned && !(await A.confirm(`حظر حساب «${s.full_name}»؟ سيفقد الوصول إلى كل المحتوى فورًا.`, 'حظر'))) return openStudent(id);
        AD.run(e.currentTarget, async () => { const r = await A.sb.from('profiles').update({ is_banned: !s.is_banned }).eq('id', id); if (r.error) throw r.error; A.toast(s.is_banned ? 'تم إلغاء الحظر' : 'تم حظر الحساب'); await fresh(); load(); openStudent(id); });
      };
      A.$('#gf', d).addEventListener('submit', (e) => { e.preventDefault(); const b = e.submitter || A.$('[type=submit]', d);
        AD.run(b, async () => { const price = A.$('#gp', d).value;
          const r = await A.sb.rpc('admin_set_access', { p_user: id, p_course: A.$('#gc', d).value, p_grant: true, p_expires: endIso(A.$('#ge', d).value), p_price: price === '' ? null : Number(price), p_method: A.$('#gm', d).value });
          if (r.error) throw r.error; A.toast('تم منح صلاحية الوصول'); openStudent(id); }); });
      d.onclick = async (e) => { const b = e.target.closest('[data-rv]'); if (!b) return;
        if (!(await A.confirm('إلغاء صلاحية الوصول إلى هذا الكورس؟', 'إلغاء الصلاحية'))) return openStudent(id);
        AD.run(b, async () => { const r = await A.sb.rpc('admin_set_access', { p_user: id, p_course: b.dataset.rv, p_grant: false }); if (r.error) throw r.error; A.toast('تم إلغاء الصلاحية'); openStudent(id); }); };
    }
    view.onclick = (e) => { const b = e.target.closest('[data-a="open"]'); if (b) openStudent(b.dataset.id); };
    await load();
  };

  AD.pages.subscriptions = async (view) => {
    const cr = await A.sb.from('courses').select('id,title').order('sort_order'); if (cr.error) throw cr.error;
    let st = '', cid = '';
    const load = async () => {
      let q = A.sb.from('subscriptions').select('*,profiles(full_name,email),courses(title)').order('created_at', { ascending: false }).limit(200);
      if (cid) q = q.eq('course_id', cid); if (st && st !== 'expired') q = q.eq('status', st);
      const { data, error } = await q; const box = A.$('#sb', view); if (error) { box.innerHTML = A.errBox(error); return; }
      const rows = st === 'expired' ? data.filter((x) => effStatus(x) === 'expired') : data; AD.cache.subs = rows;
      box.innerHTML = rows.length ? `<div class="card tw"><table><thead><tr><th>الطالب</th><th>الكورس</th><th>الحالة</th><th>البداية</th><th>النهاية</th><th>السعر المسجَّل</th><th>الدفع</th><th></th></tr></thead><tbody>${rows.map((x) => { const l = SL[effStatus(x)] || [x.status, '']; return `<tr><td>${E(x.profiles ? x.profiles.full_name || x.profiles.email : '—')}</td><td>${E(x.courses ? x.courses.title : '—')}</td>
        <td><span class="badge ${l[1]}">${l[0]}</span></td><td>${A.date(x.starts_at)}</td><td>${x.ends_at ? A.date(x.ends_at) : 'مفتوح'}</td><td>${x.price_paid == null ? '—' : Number(x.price_paid).toLocaleString('ar-EG')}</td>
        <td>${E(PM[x.payment_method] || x.payment_method)}<div class="hint">${E(PS[x.payment_status] || '')}</div></td><td><button class="btn sm ghost" data-a="edit" data-id="${x.id}">تعديل/تمديد</button>${effStatus(x) === 'active' ? `<button class="btn sm danger" data-a="cancel" data-id="${x.id}">إلغاء</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">لا توجد اشتراكات مطابقة.</div>';
    };
    view.innerHTML = `<h1>إدارة الاشتراكات</h1><div class="notice warn">بوابة الدفع غير متصلة: كل الاشتراكات هنا تُدار يدويًا من المدير، ولا تُنفَّذ أي عمليات دفع إلكتروني.</div>
      <div class="bar2"><div class="f"><div><label for="fs">الحالة</label><select id="fs"><option value="">الكل</option><option value="active">نشط</option><option value="expired">منتهٍ</option><option value="cancelled">ملغى</option><option value="pending">قيد الانتظار</option></select></div>
      <div><label for="fc">الكورس</label><select id="fc"><option value="">كل الكورسات</option>${cr.data.map((c) => `<option value="${c.id}">${E(c.title)}</option>`).join('')}</select></div></div></div><div id="sb"></div>`;
    A.$('#fs', view).onchange = (e) => { st = e.target.value; load(); }; A.$('#fc', view).onchange = (e) => { cid = e.target.value; load(); };
    view.onclick = async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const x = AD.cache.subs.find((r) => r.id === b.dataset.id);
      if (b.dataset.a === 'cancel') { if (await A.confirm('إلغاء هذا الاشتراك وسحب صلاحية الوصول؟', 'إلغاء الاشتراك')) AD.run(b, async () => { const r = await A.sb.rpc('admin_set_access', { p_user: x.user_id, p_course: x.course_id, p_grant: false }); if (r.error) throw r.error; A.toast('تم إلغاء الاشتراك'); load(); }); return; }
      const d = A.modal(`<h3>تعديل الاشتراك</h3><p class="muted">${E(x.profiles ? x.profiles.full_name : '')} — ${E(x.courses ? x.courses.title : '')}</p><form id="ef" novalidate>
        <label for="ee">تاريخ النهاية (اتركه فارغًا لاشتراك مفتوح)</label><input id="ee" type="date" value="${toDay(x.ends_at)}"><label for="ep">السعر المسجَّل</label><input id="ep" type="number" min="0" step="0.01" value="${x.price_paid ?? ''}">
        <label for="em">طريقة الدفع</label><select id="em">${Object.entries(PM).map(([k, v]) => `<option value="${k}" ${x.payment_method === k ? 'selected' : ''}>${v}</option>`).join('')}</select><p class="hint">الحفظ يمنح/يجدّد صلاحية الوصول للطالب ويجعل الاشتراك نشطًا.</p>
        <div class="row"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" onclick="A.closeModal()">إلغاء</button></div></form>`);
      A.submit(A.$('#ef', d), async () => { const p = A.$('#ep', d).value;
        const r = await A.sb.rpc('admin_set_access', { p_user: x.user_id, p_course: x.course_id, p_grant: true, p_expires: endIso(A.$('#ee', d).value), p_price: p === '' ? null : Number(p), p_method: A.$('#em', d).value });
        if (r.error) throw r.error; A.closeModal(); A.toast('تم تحديث الاشتراك'); load(); });
    };
    await load();
  };
})();
