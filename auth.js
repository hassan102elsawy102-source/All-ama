(async () => {
  const ctx = await A.init(''); if (!ctx) return;
  const app = A.$('#app'), qs = new URLSearchParams(location.search);
  const mode = A.isRecovery ? 'reset' : ['login', 'register', 'forgot'].includes(qs.get('mode')) ? qs.get('mode') : 'login';
  const next = A.nextUrl(qs.get('next'));
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const pwOk = (v) => v.length >= 8;
  const tabs = ['login', 'register'].includes(mode) ? `<div class="tabs"><a href="?mode=login${next ? '&next=' + encodeURIComponent(next) : ''}" class="${mode === 'login' ? 'on' : ''}">تسجيل الدخول</a><a href="?mode=register${next ? '&next=' + encodeURIComponent(next) : ''}" class="${mode === 'register' ? 'on' : ''}">إنشاء حساب</a></div>` : '';
  const forms = {
    login: `<h2>تسجيل الدخول</h2><form id="f" novalidate><label for="em">البريد الإلكتروني</label><input id="em" name="email" type="email" autocomplete="email" dir="ltr" required>
      <label for="pw">كلمة المرور</label><input id="pw" name="password" type="password" autocomplete="current-password" required>
      <div class="row"><button class="btn" type="submit">دخول</button></div><p><a href="?mode=forgot">نسيت كلمة المرور؟</a></p></form>`,
    register: `<h2>إنشاء حساب جديد</h2><form id="f" novalidate><label for="nm">الاسم الكامل</label><input id="nm" name="name" autocomplete="name" maxlength="100" required>
      <label for="em">البريد الإلكتروني</label><input id="em" name="email" type="email" autocomplete="email" dir="ltr" required>
      <label for="ph">رقم الهاتف (اختياري)</label><input id="ph" name="phone" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx">
      <label for="pw">كلمة المرور (8 أحرف على الأقل)</label><input id="pw" name="password" type="password" autocomplete="new-password" required>
      <label for="pw2">تأكيد كلمة المرور</label><input id="pw2" name="password2" type="password" autocomplete="new-password" required>
      <div class="row"><button class="btn" type="submit">إنشاء الحساب</button></div></form>`,
    forgot: `<h2>استعادة كلمة المرور</h2><p class="muted">اكتب بريدك وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.</p><form id="f" novalidate><label for="em">البريد الإلكتروني</label><input id="em" name="email" type="email" dir="ltr" required>
      <div class="row"><button class="btn" type="submit">إرسال الرابط</button><a class="btn ghost" href="?mode=login">رجوع</a></div></form>`,
    reset: `<h2>تعيين كلمة مرور جديدة</h2><form id="f" novalidate><label for="pw">كلمة المرور الجديدة (8 أحرف على الأقل)</label><input id="pw" name="password" type="password" autocomplete="new-password" required>
      <label for="pw2">تأكيد كلمة المرور</label><input id="pw2" name="password2" type="password" autocomplete="new-password" required><div class="row"><button class="btn" type="submit">حفظ</button></div></form>`
  };
  app.innerHTML = `<div class="wrap"><div class="card authbox">${tabs}${forms[mode]}</div></div>`;
  const form = A.$('#f');

  const go = async () => {
    const p = await A.profile(true);
    location.href = next || (p && p.role === 'admin' ? 'admin/index.html' : 'account.html');
  };
  if (mode === 'login' || mode === 'register') { const s = await A.session(); if (s) return go(); }

  A.submit(form, async (fd) => {
    const g = (k) => (fd.get(k) || '').toString().trim();
    if (mode === 'login') {
      if (!emailOk(g('email'))) throw A.fail('اكتب بريدًا إلكترونيًا صحيحًا.');
      if (!g('password') && !fd.get('password')) throw A.fail('اكتب كلمة المرور.');
      const { error } = await A.sb.auth.signInWithPassword({ email: g('email'), password: fd.get('password') });
      if (error) throw error; await go();
    } else if (mode === 'register') {
      const ph = g('phone').replace(/[\s-]/g, '');
      if (g('name').length < 3) throw A.fail('اكتب اسمك الكامل (3 أحرف على الأقل).');
      if (!emailOk(g('email'))) throw A.fail('اكتب بريدًا إلكترونيًا صحيحًا.');
      if (ph && !/^[0-9+]{7,15}$/.test(ph)) throw A.fail('رقم الهاتف غير صحيح.');
      if (!pwOk(fd.get('password'))) throw A.fail('كلمة المرور يجب ألا تقل عن 8 أحرف.');
      if (fd.get('password') !== fd.get('password2')) throw A.fail('تأكيد كلمة المرور غير مطابق.');
      const { data, error } = await A.sb.auth.signUp({ email: g('email'), password: fd.get('password'),
        options: { data: { full_name: g('name'), phone: ph }, emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + 'auth.html?mode=login' } });
      if (error) throw error;
      if (data.session) { A.toast('تم إنشاء حسابك بنجاح'); await go(); }
      else app.innerHTML = '<div class="wrap"><div class="card authbox"><h2>تم إنشاء الحساب</h2><div class="notice">أرسلنا رسالة تأكيد إلى بريدك. افتحها لتفعيل الحساب ثم سجّل الدخول.</div><a class="btn" href="?mode=login">تسجيل الدخول</a></div></div>';
    } else if (mode === 'forgot') {
      if (!emailOk(g('email'))) throw A.fail('اكتب بريدًا إلكترونيًا صحيحًا.');
      const { error } = await A.sb.auth.resetPasswordForEmail(g('email'), { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      app.innerHTML = '<div class="wrap"><div class="card authbox"><h2>تم الإرسال</h2><div class="notice">إن كان البريد مسجّلًا لدينا فستصلك رسالة بها رابط تعيين كلمة المرور.</div><a class="btn ghost" href="?mode=login">رجوع</a></div></div>';
    } else {
      if (!pwOk(fd.get('password'))) throw A.fail('كلمة المرور يجب ألا تقل عن 8 أحرف.');
      if (fd.get('password') !== fd.get('password2')) throw A.fail('تأكيد كلمة المرور غير مطابق.');
      const s = await A.session(); if (!s) throw A.fail('انتهت صلاحية رابط الاستعادة. اطلب رابطًا جديدًا.');
      const { error } = await A.sb.auth.updateUser({ password: fd.get('password') }); if (error) throw error;
      A.toast('تم تغيير كلمة المرور'); history.replaceState(null, '', location.pathname); await go();
    }
  });
})();
