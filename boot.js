/* تشغيل اللوحة: التحقق من الجلسة والدور ثم التوجيه */
(async () => {
  const root = document.getElementById('root');
  const deny = (t, m, link) => (root.innerHTML = `<div class="wrap" style="padding:60px 0"><div class="empty"><h2>${t}</h2><p>${m}</p>${link || '<a class="btn" href="../index.html">العودة إلى الموقع</a>'}</div></div>`);
  if (!A.configured) return deny('الموقع غير مُهيَّأ', 'أضف إعدادات Supabase في js/config.js (راجع README).');
  let p;
  try {
    if (!(await A.session())) return deny('يلزم تسجيل الدخول', 'سجّل الدخول بحساب المدير للمتابعة.', '<a class="btn" href="../auth.html?mode=login&next=admin/index.html">تسجيل الدخول</a>');
    p = await A.profile(true);
  } catch (e) { return (root.innerHTML = `<div class="wrap">${A.errBox(e)}</div>`); }
  if (!p || p.role !== 'admin' || p.is_banned) return deny('غير مصرّح لك بدخول لوحة التحكم', 'هذه الصفحة مخصصة للمدير فقط.');
  AD.me = p;

  root.innerHTML = `<div class="top"><button id="mb" aria-label="القائمة">☰ القائمة</button><b>لوحة التحكم</b></div>
  <div class="shell"><aside class="side" id="side"><a class="logo light" style="padding:6px 8px 16px" href="../index.html"><span class="mark">ع</span><span class="lt"><b>العلّامة</b><small>لوحة المدير</small></span></a>
    ${AD.NAV.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${l}</a>`).join('')}<button class="lo" id="lo">تسجيل الخروج</button></aside>
  <main class="main" id="view"></main></div>`;
  const side = document.getElementById('side'), view = document.getElementById('view');
  document.getElementById('mb').onclick = () => side.classList.toggle('open');
  document.getElementById('lo').onclick = async () => { await A.sb.auth.signOut(); location.href = '../index.html'; };
  A.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.href = '../auth.html?mode=login&next=admin/index.html'; });

  const route = async () => {
    side.classList.remove('open');
    const [name, qstr] = (location.hash.slice(2) || 'dashboard').split('?'), q = new URLSearchParams(qstr || '');
    const fn = AD.pages[name] || AD.pages.dashboard, key = AD.pages[name] ? name : 'dashboard';
    side.querySelectorAll('a[data-k]').forEach((a) => a.classList.toggle('on', a.dataset.k === key));
    view.onclick = null; view.innerHTML = A.loading();
    try {
      if (!(await A.session())) { location.href = '../auth.html?mode=login&next=admin/index.html'; return; } // انتهت الجلسة
      await fn(view, q);
    } catch (e) { view.innerHTML = A.errBox(e); }
  };
  window.addEventListener('hashchange', route); route();
})();
