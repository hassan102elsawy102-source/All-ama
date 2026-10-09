(() => {
  const E = A.esc;
  const saveSettings = async (obj) => { const rows = Object.entries(obj).map(([key, value]) => ({ key, value })); const { error } = await A.sb.from('site_settings').upsert(rows, { onConflict: 'key' }); if (error) throw error; A._s = null; };

  AD.pages.dashboard = async (view) => {
    const now = new Date().toISOString();
    const [st, co, le, su, ns, au] = await Promise.all([
      AD.count('profiles', (q) => q.eq('role', 'student')), AD.count('courses'), AD.count('lessons'),
      AD.count('subscriptions', (q) => q.eq('status', 'active').or(`ends_at.is.null,ends_at.gt.${now}`)),
      A.sb.from('profiles').select('full_name,email,created_at').eq('role', 'student').order('created_at', { ascending: false }).limit(5),
      A.sb.from('audit_log').select('action,table_name,created_at,profiles(full_name)').order('created_at', { ascending: false }).limit(8)]);
    if (ns.error) throw ns.error; if (au.error) throw au.error;
    const n = (v) => Number(v).toLocaleString('ar-EG');
    view.innerHTML = `<h1>الرئيسية والإحصائيات</h1><div class="cards"><div class="card stat"><b>${n(st)}</b><span>إجمالي الطلاب</span></div><div class="card stat"><b>${n(co)}</b><span>الكورسات</span></div><div class="card stat"><b>${n(le)}</b><span>الدروس</span></div><div class="card stat"><b>${n(su)}</b><span>اشتراكات نشطة</span></div></div>
      <div class="two"><div class="card pad"><h3>أحدث الطلاب</h3>${ns.data.length ? `<ul>${ns.data.map((s) => `<li>${E(s.full_name || s.email)} <span class="hint">${A.date(s.created_at)}</span></li>`).join('')}</ul>` : '<p class="muted">لا يوجد طلاب بعد.</p>'}</div>
      <div class="card pad"><h3>آخر التعديلات على المنصة</h3>${au.data.length ? `<ul>${au.data.map((a) => `<li>${AD.ACTIONS[a.action] || a.action} — ${AD.TABLES[a.table_name] || a.table_name} <span class="hint">${E(a.profiles ? a.profiles.full_name : '')} • ${A.date(a.created_at)}</span></li>`).join('')}</ul>` : '<p class="muted">لا توجد عمليات مسجّلة بعد.</p>'}</div></div>`;
  };

  AD.pages.prices = async (view) => {
    const { data, error } = await A.sb.from('courses').select('id,title,is_free,price').order('sort_order'); if (error) throw error; const s = await A.settings();
    view.innerHTML = `<h1>إدارة الأسعار</h1><p class="muted">العملة المعروضة: ${E(s.currency_label || 'ج.م')} (تُعدَّل من الإعدادات).</p>${data.length ? `<div class="card tw"><table><thead><tr><th>الكورس</th><th>مجاني</th><th>السعر</th><th></th></tr></thead><tbody>${data.map((c) => `<tr data-id="${c.id}"><td>${E(c.title)}</td><td><input type="checkbox" class="fr" ${c.is_free ? 'checked' : ''} aria-label="مجاني"></td><td><input type="number" class="pr" min="0" step="0.01" value="${c.price}" style="max-width:140px" ${c.is_free ? 'disabled' : ''}></td><td><button class="btn sm" data-a="save">حفظ</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">لا توجد كورسات.</div>'}`;
    view.onchange = (e) => { if (e.target.classList.contains('fr')) A.$('.pr', e.target.closest('tr')).disabled = e.target.checked; };
    view.onclick = (e) => { const b = e.target.closest('[data-a="save"]'); if (!b) return; const tr = b.closest('tr'), free = A.$('.fr', tr).checked, price = free ? 0 : Number(A.$('.pr', tr).value);
      if (!free && !(price > 0)) return A.toast('حدّد سعرًا أكبر من صفر أو اجعل الكورس مجانيًا.', 'err');
      AD.run(b, async () => { const r = await A.sb.from('courses').update({ is_free: free, price }).eq('id', tr.dataset.id); if (r.error) throw r.error; A.toast('تم تحديث السعر'); }); };
  };

  AD.pages.content = async (view) => {
    const s = await A.settings(); const rep = (name, items, a, b, pa, pb) => `<div id="${name}">${items.map((it, i) => repRow(it[a], it[b], pa, pb)).join('')}</div><button type="button" class="btn ghost sm" data-add="${name}" data-pa="${pa}" data-pb="${pb}">+ إضافة</button>`;
    const repRow = (x, y, pa, pb) => `<div class="rep"><input data-k="a" value="${E(x || '')}" placeholder="${pa}"><textarea data-k="b" placeholder="${pb}" style="min-height:44px">${E(y || '')}</textarea><button type="button" class="btn sm danger" data-rm>حذف</button></div>`;
    const img = (k) => (A.safeUrl(s[k]) ? `<p class="hint">الصورة الحالية: <a href="${E(s[k])}" target="_blank" rel="noopener">عرض</a> — ارفع صورة لاستبدالها، أو <label class="chk" style="display:inline-flex"><input type="checkbox" name="rm_${k}"> أزلها</label></p>` : '');
    const inp = (k, l, extra = '') => `<label for="f_${k}">${l}</label><input id="f_${k}" name="${k}" value="${E(s[k] || '')}" ${extra}>`;
    view.innerHTML = `<h1>إدارة محتوى الموقع</h1><form id="cf" class="card pad" novalidate>
      <h3>الهوية والصفحة الرئيسية</h3><div class="grid2">${inp('platform_name', 'اسم المنصة', 'maxlength="60" required')}${inp('teacher_name', 'اسم الأستاذ', 'maxlength="60" required')}</div>${inp('hero_title', 'عنوان الصفحة الرئيسية', 'maxlength="120"')}
      <label for="f_hero_text">النص الترحيبي</label><textarea id="f_hero_text" name="hero_text" maxlength="500">${E(s.hero_text || '')}</textarea>
      <label for="f_hero_image">صورة القسم الترحيبي</label><input id="f_hero_image" name="hero_image_file" type="file" accept="image/png,image/jpeg,image/webp">${img('hero_image')}
      <h3 style="margin-top:20px">معلومات الأستاذ</h3><label for="f_teacher_bio">نبذة تعريفية (تظهر في الصفحة الرئيسية إن لم تكن فارغة)</label><textarea id="f_teacher_bio" name="teacher_bio" maxlength="3000">${E(s.teacher_bio || '')}</textarea>
      <label for="f_teacher_photo">صورة الأستاذ</label><input id="f_teacher_photo" name="teacher_photo_file" type="file" accept="image/png,image/jpeg,image/webp">${img('teacher_photo')}
      <h3 style="margin-top:20px">مميزات المنصة</h3>${rep('feat', Array.isArray(s.features) ? s.features : [], 'title', 'text', 'العنوان', 'الوصف')}
      <h3 style="margin-top:20px">الأسئلة الشائعة</h3>${rep('faq', Array.isArray(s.faq) ? s.faq : [], 'q', 'a', 'السؤال', 'الإجابة')}
      <h3 style="margin-top:20px">بيانات التواصل</h3><div class="grid2">${inp('contact_email', 'البريد الإلكتروني', 'type="email" dir="ltr"')}${inp('contact_phone', 'رقم الهاتف', 'dir="ltr"')}${inp('contact_whatsapp', 'رقم واتساب (بالصيغة الدولية بدون +)', 'dir="ltr"')}</div>
      <h3 style="margin-top:20px">روابط التواصل الاجتماعي (https)</h3><div class="grid2">${inp('social_facebook', 'فيسبوك', 'dir="ltr"')}${inp('social_youtube', 'يوتيوب', 'dir="ltr"')}${inp('social_instagram', 'إنستجرام', 'dir="ltr"')}${inp('social_telegram', 'تيليجرام', 'dir="ltr"')}${inp('social_tiktok', 'تيك توك', 'dir="ltr"')}</div>
      <div class="row"><button class="btn" type="submit">حفظ المحتوى</button></div></form>`;
    view.onclick = (e) => {
      const add = e.target.closest('[data-add]'); if (add) { A.$('#' + add.dataset.add, view).insertAdjacentHTML('beforeend', repRow('', '', add.dataset.pa, add.dataset.pb)); }
      const rm = e.target.closest('[data-rm]'); if (rm) rm.closest('.rep').remove();
    };
    const collect = (id, ka, kb) => A.$$('.rep', A.$('#' + id, view)).map((r) => ({ [ka]: A.$('[data-k=a]', r).value.trim(), [kb]: A.$('[data-k=b]', r).value.trim() })).filter((x) => x[ka] && x[kb]);
    A.submit(A.$('#cf', view), async (fd) => {
      const g = (k) => (fd.get(k) || '').toString().trim();
      if (!g('platform_name') || !g('teacher_name')) throw A.fail('اسم المنصة واسم الأستاذ مطلوبان.');
      if (g('contact_email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g('contact_email'))) throw A.fail('البريد الإلكتروني للتواصل غير صحيح.');
      for (const k of ['facebook', 'youtube', 'instagram', 'telegram', 'tiktok']) if (g('social_' + k) && !/^https:\/\//i.test(g('social_' + k))) throw A.fail('روابط التواصل الاجتماعي يجب أن تبدأ بـ https://');
      const out = { platform_name: g('platform_name'), teacher_name: g('teacher_name'), hero_title: g('hero_title'), hero_text: g('hero_text'), teacher_bio: g('teacher_bio'),
        contact_email: g('contact_email'), contact_phone: g('contact_phone'), contact_whatsapp: g('contact_whatsapp').replace(/\D/g, ''),
        features: collect('feat', 'title', 'text'), faq: collect('faq', 'q', 'a') };
      for (const k of ['facebook', 'youtube', 'instagram', 'telegram', 'tiktok']) out['social_' + k] = g('social_' + k);
      for (const k of ['hero_image', 'teacher_photo']) { const u = await AD.uploadImage(fd.get(k + '_file'), 'site'); if (u) out[k] = u; else if (fd.get('rm_' + k)) out[k] = ''; }
      await saveSettings(out); A.toast('تم حفظ محتوى الموقع');
    });
  };

  AD.pages.settings = async (view) => {
    const s = await A.settings(); const au = await A.sb.from('audit_log').select('*,profiles(full_name)').order('created_at', { ascending: false }).limit(100); if (au.error) throw au.error;
    view.innerHTML = `<h1>إدارة الإعدادات</h1><form id="sf" class="card pad" novalidate><h3>العملة</h3><label for="cu">رمز العملة المعروض بجانب الأسعار</label><input id="cu" name="cur" value="${E(s.currency_label || 'ج.م')}" maxlength="12" style="max-width:200px">
      <p class="hint">يغيّر النص المعروض فقط ولا يحوّل الأسعار.</p><div class="row"><button class="btn" type="submit">حفظ</button></div></form>
      <div class="card pad" style="margin-top:16px"><h3>إنشاء مدير جديد</h3><p class="muted">لا يمكن إنشاء مدير من الموقع عمدًا. نفّذ الأمر الموجود في <code>supabase/seed/promote_admin.sql</code> من SQL Editor بعد أن يسجّل المستخدم حسابًا عاديًا.</p></div>
      <h2 style="margin-top:24px">سجل العمليات الإدارية (آخر 100)</h2>${au.data.length ? `<div class="card tw"><table><thead><tr><th>الوقت</th><th>المنفّذ</th><th>العملية</th><th>القسم</th><th>تفاصيل</th></tr></thead><tbody>${au.data.map((a) => `<tr><td>${new Date(a.created_at).toLocaleString('ar-EG')}</td><td>${E(a.profiles ? a.profiles.full_name : '—')}</td><td>${AD.ACTIONS[a.action] || E(a.action)}</td><td>${AD.TABLES[a.table_name] || E(a.table_name)}</td><td><details><summary>عرض</summary><div class="pre">${E(JSON.stringify(a.details, null, 1))}</div></details></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">لا توجد عمليات مسجّلة بعد.</div>'}`;
    A.submit(A.$('#sf', view), async (fd) => { const v = fd.get('cur').trim(); if (!v) throw A.fail('اكتب رمز العملة.'); await saveSettings({ currency_label: v }); A.toast('تم حفظ الإعدادات'); });
  };
})();
