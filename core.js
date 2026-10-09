/* الوظائف المشتركة لجميع الصفحات: الاتصال، الجلسة، الإشعارات، النوافذ، الهيكل العام */
(function () {
  'use strict';
  const cfg = window.ALLAMA_CONFIG || {};
  const A = (window.A = {});
  A.isRecovery = /type=recovery/.test(location.hash); // يُحسب قبل أن تمسح المكتبة الهاش
  A.configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  A.sb = A.configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  if (A.sb) A.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') A._p = null; });

  A.$ = (s, r = document) => r.querySelector(s);
  A.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  A.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch { return ''; } };
  A.uuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
  A.date = (d) => (d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');
  A.loading = () => '<div class="loading" role="status"><span class="spin"></span> جارٍ التحميل…</div>';
  A.errBox = (e) => `<div class="notice err"><b>تعذّر تحميل البيانات</b><p>${A.esc(A.errMsg(e))}</p><button class="btn ghost" onclick="location.reload()">إعادة المحاولة</button></div>`;
  A.price = (c, s) => (c.is_free ? 'مجاني' : `${Number(c.price).toLocaleString('ar-EG')} ${A.esc((s && s.currency_label) || 'ج.م')}`);

  A.errMsg = (e) => {
    const m = ((e && e.message) || '').toLowerCase(), c = e && e.code;
    if (!navigator.onLine || m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.';
    if (m.includes('invalid login')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    if (m.includes('email not confirmed')) return 'لم يتم تأكيد البريد بعد. افتح رسالة التأكيد في بريدك.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'هذا البريد مسجَّل من قبل.';
    if (m.includes('password should be') || m.includes('weak password')) return 'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.';
    if (m.includes('rate limit') || (e && e.status === 429)) return 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.';
    if (c === '42501' || m.includes('row-level security') || m.includes('not authorized')) return 'ليست لديك صلاحية لتنفيذ هذه العملية.';
    if (c === '23505') return 'هذه القيمة موجودة من قبل.';
    if (c === '23514') return 'إحدى القيم غير مقبولة (راجع السعر أو الروابط أو الطول).';
    if (c === '42P01' || m.includes('schema cache')) return 'جداول قاعدة البيانات غير موجودة. شغّل ملف الـ SQL أولًا (راجع README).';
    return 'حدث خطأ غير متوقع' + (e && e.message ? ': ' + e.message : '.');
  };

  A.toast = (msg, type = 'ok') => {
    let box = A.$('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  };

  A.modal = (html, { wide = false } = {}) => {
    let d = A.$('#dlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'dlg'; document.body.appendChild(d); d.addEventListener('close', () => { d.innerHTML = ''; d.onclick = null; }); }
    if (d.open) d.close();
    d.onclick = null; d.className = wide ? 'wide' : ''; d.innerHTML = html; d.showModal(); return d;
  };
  A.closeModal = () => { const d = A.$('#dlg'); if (d && d.open) d.close(); };
  A.confirm = (msg, okLabel = 'تأكيد') => new Promise((res) => {
    const d = A.modal(`<h3>تأكيد العملية</h3><p>${A.esc(msg)}</p><div class="row"><button class="btn ghost" data-c="0">إلغاء</button><button class="btn danger" data-c="1">${A.esc(okLabel)}</button></div>`);
    let done = false;
    d.onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { done = true; res(b.dataset.c === '1'); d.close(); } };
    d.addEventListener('close', () => { if (!done) res(false); }, { once: true });
  });

  // ربط نموذج: يمنع الإرسال المتكرر ويعرض الأخطاء
  A.submit = (form, fn) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('[type=submit]');
    if (b.disabled) return;
    b.disabled = true; const old = b.textContent; b.textContent = 'جارٍ التنفيذ…';
    try { await fn(new FormData(form), form); } catch (err) { A.toast(err.userMsg || A.errMsg(err), 'err'); }
    finally { b.disabled = false; b.textContent = old; }
  });
  A.fail = (msg) => { const e = new Error(msg); e.userMsg = msg; return e; }; // خطأ تحقق مخصص

  A.session = async () => { if (!A.sb) return null; const { data } = await A.sb.auth.getSession(); return data.session; };
  A.profile = async (force) => {
    if (A._p && !force) return A._p;
    const s = await A.session(); if (!s) return null;
    const { data, error } = await A.sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    if (error) throw error; A._p = data; return data;
  };
  A.settings = async () => {
    if (A._s) return A._s;
    const { data, error } = await A.sb.from('site_settings').select('key,value'); if (error) throw error;
    A._s = Object.fromEntries(data.map((r) => [r.key, r.value])); return A._s;
  };
  // الكورسات التي يملك المستخدم صلاحية سارية عليها (للعرض فقط؛ الحماية الفعلية في RLS)
  A.myAccess = async () => {
    const s = await A.session(); if (!s) return new Set();
    const { data, error } = await A.sb.from('course_access').select('course_id,expires_at').eq('user_id', s.user.id);
    if (error) throw error;
    return new Set(data.filter((r) => !r.expires_at || new Date(r.expires_at) > new Date()).map((r) => r.course_id));
  };

  A.parseVideo = (u) => {
    u = (u || '').trim(); let x; try { x = new URL(u); } catch { return null; }
    if (x.protocol !== 'https:') return null;
    const h = x.hostname.replace(/^www\./, ''); let m;
    if (h === 'youtu.be') { m = x.pathname.slice(1).match(/^[\w-]{11}$/); if (m) return { type: 'iframe', label: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${m[0]}?rel=0` }; }
    if (h === 'youtube.com' || h === 'm.youtube.com') {
      const id = x.searchParams.get('v') || (x.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/) || [])[1];
      if (id && /^[\w-]{11}$/.test(id)) return { type: 'iframe', label: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    }
    if (h === 'vimeo.com' || h === 'player.vimeo.com') {
      const p = x.pathname.split('/').filter(Boolean), id = p.find((t) => /^\d{6,}$/.test(t));
      if (id) { const hh = p[p.indexOf(id) + 1] || x.searchParams.get('h') || ''; return { type: 'iframe', label: 'Vimeo', src: `https://player.vimeo.com/video/${id}` + (/^[0-9a-f]+$/i.test(hh) ? `?h=${hh}` : '') }; }
    }
    if (h === 'drive.google.com') { m = x.pathname.match(/\/file\/d\/([\w-]+)/); if (m) return { type: 'iframe', label: 'Google Drive', src: `https://drive.google.com/file/d/${m[1]}/preview` }; }
    if (/\.(mp4|webm|ogg)$/i.test(x.pathname)) return { type: 'video', label: 'ملف فيديو', src: x.href };
    return null;
  };

  A.subscribeDialog = (title, s) => {
    const links = A.contactLinks(s || {});
    A.modal(`<h3>الاشتراك في «${A.esc(title)}»</h3>
      <div class="notice warn">الدفع الإلكتروني غير مُفعَّل حاليًا في المنصة. يتم تفعيل الاشتراك يدويًا من الأستاذ بعد التواصل معه.</div>
      ${links ? `<div class="contact-list">${links}</div>` : '<p class="muted">لم تُضَف بيانات التواصل بعد. يرجى المحاولة لاحقًا.</p>'}
      <div class="row"><button class="btn" onclick="A.closeModal()">حسنًا</button></div>`);
  };
  A.contactLinks = (s) => {
    const o = [];
    if (s.contact_whatsapp) { const n = String(s.contact_whatsapp).replace(/\D/g, ''); if (n) o.push(`<a class="btn ghost" href="https://wa.me/${n}" target="_blank" rel="noopener">واتساب</a>`); }
    if (s.contact_phone) o.push(`<a class="btn ghost" href="tel:${A.esc(String(s.contact_phone).replace(/[^\d+]/g, ''))}">اتصال: <bdi dir="ltr">${A.esc(s.contact_phone)}</bdi></a>`);
    if (s.contact_email) o.push(`<a class="btn ghost" href="mailto:${A.esc(s.contact_email)}">${A.esc(s.contact_email)}</a>`);
    return o.join('');
  };

  A.courseCard = (c, s, hasAccess) => {
    const n = (c.lessons && c.lessons[0] && c.lessons[0].count) || 0, cover = A.safeUrl(c.cover_url);
    const badge = hasAccess ? '<span class="badge ok">مشترك</span>' : c.is_free ? '<span class="badge info">مجاني</span>' : '<span class="badge">مدفوع</span>';
    const open = hasAccess || c.is_free;
    return `<article class="card course"><a class="cover" href="course.html?id=${c.id}" aria-label="${A.esc(c.title)}">${cover ? `<img src="${A.esc(cover)}" alt="" loading="lazy">` : `<span class="ph">${A.esc((c.title || 'ع')[0])}</span>`}</a>
      <div class="body"><div class="meta">${badge}${c.category ? `<span class="badge soft">${A.esc(c.category)}</span>` : ''}</div>
      <h3><a href="course.html?id=${c.id}">${A.esc(c.title)}</a></h3><p class="desc">${A.esc(c.description)}</p>
      <ul class="facts"><li>المدرّس: ${A.esc(c.teacher_name)}</li><li>${n} درس</li><li class="price">${A.price(c, s)}</li></ul>
      <div class="actions"><a class="btn ghost" href="course.html?id=${c.id}">عرض التفاصيل</a>
      ${open ? `<a class="btn" href="course.html?id=${c.id}">الدخول إلى الكورس</a>` : `<button class="btn" data-sub="${c.id}" data-title="${A.esc(c.title)}">الاشتراك</button>`}</div></div></article>`;
  };
  A.bindSubscribe = (root, s) => root.addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (b) A.subscribeDialog(b.dataset.title, s); });

  A.shell = async (active) => {
    const s = await A.settings();
    let p = null; try { p = await A.profile(); } catch { /* الصفحة تعمل للزائر */ }
    const name = A.esc(s.platform_name || 'العلّامة'), teacher = A.esc(s.teacher_name || '');
    const link = (href, label, key) => `<a href="${href}"${active === key ? ' class="on" aria-current="page"' : ''}>${label}</a>`;
    A.$('#hdr').innerHTML = `<div class="wrap bar"><a class="logo" href="index.html"><span class="mark" aria-hidden="true">ع</span><span class="lt"><b>${name}</b><small>${teacher}</small></span></a>
      <button class="burger" aria-label="القائمة" aria-expanded="false" id="burger"><span></span><span></span><span></span></button>
      <nav id="nav">${link('index.html', 'الرئيسية', 'home')}${link('courses.html', 'الكورسات', 'courses')}<a href="index.html#faq">الأسئلة الشائعة</a><a href="index.html#contact">تواصل معنا</a>
      <span class="sp"></span>${p ? `${link('account.html', 'حسابي', 'account')}${p.role === 'admin' ? '<a href="admin/index.html">لوحة التحكم</a>' : ''}<button class="btn ghost sm" id="logout">تسجيل الخروج</button>`
        : `<a class="btn ghost sm" href="auth.html?mode=login">تسجيل الدخول</a><a class="btn sm" href="auth.html?mode=register">إنشاء حساب</a>`}</nav></div>`;
    const bg = A.$('#burger'); bg.onclick = () => { const o = A.$('#nav').classList.toggle('open'); bg.setAttribute('aria-expanded', o); };
    const lo = A.$('#logout'); if (lo) lo.onclick = async () => { await A.sb.auth.signOut(); location.href = 'index.html'; };
    const soc = [['facebook', 'فيسبوك'], ['youtube', 'يوتيوب'], ['instagram', 'إنستجرام'], ['telegram', 'تيليجرام'], ['tiktok', 'تيك توك']]
      .filter(([k]) => A.safeUrl(s['social_' + k])).map(([k, l]) => `<a href="${A.esc(A.safeUrl(s['social_' + k]))}" target="_blank" rel="noopener">${l}</a>`).join('');
    A.$('#ftr').innerHTML = `<div class="wrap"><div class="fgrid"><div><div class="logo light"><span class="mark" aria-hidden="true">ع</span><span class="lt"><b>${name}</b><small>${teacher}</small></span></div></div>
      <div><h4>الصفحات</h4><a href="index.html">الرئيسية</a><a href="courses.html">الكورسات</a><a href="auth.html?mode=login">تسجيل الدخول</a><a href="auth.html?mode=register">إنشاء حساب</a></div>
      <div><h4>المنصة</h4><a href="index.html#faq">الأسئلة الشائعة</a><a href="index.html#contact">التواصل والدعم</a>${soc}</div></div>
      <p class="copy">© ${new Date().getFullYear()} ${name} — ${teacher}. جميع الحقوق محفوظة.</p></div>`;
    return { s, p };
  };

  A.init = async (active) => {
    if (!A.configured) {
      A.$('#app').innerHTML = '<div class="wrap"><div class="notice err"><h2>الموقع غير مُهيَّأ بعد</h2><p>لم يتم ضبط الاتصال بقاعدة البيانات. افتح الملف <code>js/config.js</code> وأضف <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> (راجع README).</p></div></div>';
      return null;
    }
    try { return await A.shell(active); }
    catch (e) { A.$('#app').innerHTML = `<div class="wrap">${A.errBox(e)}</div>`; return null; }
  };
  A.nextUrl = (n) => (n && /^(?!\/\/)[\w\-./]+(\?[\w\-=&%.]*)?$/.test(n) && !n.includes('..') ? n : null);
})();
