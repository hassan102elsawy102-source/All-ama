(() => {
  const E = A.esc, one = (x) => (Array.isArray(x) ? x[0] : x) || null;
  const VERR = 'رابط الفيديو غير مدعوم. المدعوم (عبر https): YouTube وVimeo وGoogle Drive أو ملف mp4/webm مباشر.';
  const attText = (a) => (Array.isArray(a) ? a : []).map((f) => `${f.name} | ${f.url}`).join('\n');
  const parseAtt = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.lastIndexOf('|'); const name = i > -1 ? l.slice(0, i).trim() : 'ملف', url = (i > -1 ? l.slice(i + 1) : l).trim();
    if (!/^https:\/\//i.test(url) || !A.safeUrl(url)) throw A.fail(`رابط المرفق غير صحيح: ${l}`); return { name: name || 'ملف', url };
  });
  const courseSelect = (courses, cur) => `<div><label for="cs">الكورس</label><select id="cs">${courses.map((c) => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${E(c.title)}</option>`).join('')}</select></div>`;

  AD.pages.lessons = async (view, q) => {
    const cr = await A.sb.from('courses').select('id,title').order('sort_order'); if (cr.error) throw cr.error;
    const courses = cr.data;
    if (!courses.length) { view.innerHTML = '<h1>إدارة الدروس</h1><div class="empty">أضف كورسًا أولًا من «إدارة الكورسات».</div>'; return; }
    const cid = courses.some((c) => c.id === q.get('course')) ? q.get('course') : courses[0].id;
    const load = async () => {
      const { data, error } = await A.sb.from('lessons').select('*, lesson_content(video_url,attachments)').eq('course_id', cid).order('sort_order').order('created_at');
      if (error) { view.querySelector('#ll').innerHTML = A.errBox(error); return; }
      AD.cache.lessons = data;
      A.$('#ll', view).innerHTML = data.length ? `<div class="card tw"><table><thead><tr><th>#</th><th>الدرس</th><th>النوع</th><th>الفيديو</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${data.map((l, i) => { const lc = one(l.lesson_content); return `<tr><td>${i + 1}</td><td><b>${E(l.title)}</b></td>
        <td><span class="badge ${l.is_free ? 'info' : ''}">${l.is_free ? 'مجاني' : 'مدفوع'}</span></td><td>${lc && lc.video_url ? '✓' : '—'}</td><td><span class="badge ${l.is_published ? 'ok' : 'warn'}">${l.is_published ? 'منشور' : 'مخفي'}</span></td>
        <td><button class="btn sm ghost" data-a="up" data-id="${l.id}" ${i === 0 ? 'disabled' : ''} aria-label="رفع">↑</button><button class="btn sm ghost" data-a="dn" data-id="${l.id}" ${i === data.length - 1 ? 'disabled' : ''} aria-label="خفض">↓</button>
        <button class="btn sm ghost" data-a="edit" data-id="${l.id}">تعديل</button><button class="btn sm danger" data-a="del" data-id="${l.id}">حذف</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">لا توجد دروس في هذا الكورس بعد.</div>';
    };
    view.innerHTML = `<div class="bar2"><h1>إدارة الدروس</h1><div class="f">${courseSelect(courses, cid)}<button class="btn" data-a="new">+ إضافة درس</button></div></div><div id="ll"></div>`;
    A.$('#cs', view).onchange = (e) => { location.hash = '#/lessons?course=' + e.target.value; };
    const form = (l) => { const lc = l ? one(l.lesson_content) : null; return `<h3>${l ? 'تعديل درس' : 'إضافة درس'}</h3><form id="lf" novalidate>
      <label for="t">عنوان الدرس</label><input id="t" name="title" value="${E(l ? l.title : '')}" maxlength="200" required>
      <label for="d">وصف الدرس</label><textarea id="d" name="description" maxlength="5000">${E(l ? l.description : '')}</textarea>
      <label for="v">رابط الفيديو (https)</label><input id="v" name="video_url" dir="ltr" value="${E(lc ? lc.video_url || '' : '')}" placeholder="https://www.youtube.com/watch?v=...">
      <p class="hint">YouTube / Vimeo / Google Drive / ملف mp4 أو webm مباشر.</p>
      <label for="at">ملفات مرفقة (سطر لكل ملف بصيغة: الاسم | الرابط)</label><textarea id="at" name="att" dir="ltr" placeholder="ملزمة الدرس | https://...">${E(attText(lc && lc.attachments))}</textarea>
      <label class="chk"><input type="checkbox" name="is_free" ${l && l.is_free ? 'checked' : ''}> درس مجاني (متاح لأي مسجّل دخول)</label>
      <label class="chk"><input type="checkbox" name="is_published" ${l && l.is_published ? 'checked' : ''}> منشور</label>
      <div class="row"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" onclick="A.closeModal()">إلغاء</button></div></form>`; };
    view.onclick = async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, l = (AD.cache.lessons || []).find((x) => x.id === b.dataset.id);
      if (a === 'new' || a === 'edit') {
        const d = A.modal(form(a === 'edit' ? l : null), { wide: true });
        A.submit(A.$('#lf', d), async (fd) => {
          const title = fd.get('title').trim(), url = fd.get('video_url').trim();
          if (title.length < 2) throw A.fail('عنوان الدرس مطلوب (حرفان على الأقل).');
          if (url && !A.parseVideo(url)) throw A.fail(VERR);
          const att = parseAtt(fd.get('att'));
          const row = { title, description: fd.get('description').trim(), is_free: fd.get('is_free') === 'on', is_published: fd.get('is_published') === 'on' };
          let id = l && l.id;
          if (id) { const r = await A.sb.from('lessons').update(row).eq('id', id); if (r.error) throw r.error; }
          else {
            const m = await A.sb.from('lessons').select('sort_order').eq('course_id', cid).order('sort_order', { ascending: false }).limit(1);
            row.course_id = cid; row.sort_order = (m.data && m.data[0] ? m.data[0].sort_order : 0) + 1;
            const r = await A.sb.from('lessons').insert(row).select('id').single(); if (r.error) throw r.error; id = r.data.id;
          }
          const c = await A.sb.from('lesson_content').upsert({ lesson_id: id, video_url: url || null, attachments: att }, { onConflict: 'lesson_id' });
          if (c.error) throw A.fail('حُفظ الدرس لكن تعذّر حفظ الفيديو/المرفقات: ' + A.errMsg(c.error));
          A.closeModal(); A.toast(l ? 'تم تحديث الدرس' : 'تمت إضافة الدرس'); load();
        });
      } else if (a === 'up' || a === 'dn') AD.run(b, async () => {
        const ids = AD.cache.lessons.map((x) => x.id), i = ids.indexOf(l.id), j = a === 'up' ? i - 1 : i + 1; [ids[i], ids[j]] = [ids[j], ids[i]];
        const { error } = await A.sb.rpc('admin_reorder_lessons', { p_course: cid, p_ids: ids }); if (error) throw error; load();
      });
      else if (a === 'del' && (await A.confirm(`حذف الدرس «${l.title}» نهائيًا؟`, 'حذف'))) AD.run(b, async () => { const { error } = await A.sb.from('lessons').delete().eq('id', l.id); if (error) throw error; A.toast('تم حذف الدرس'); load(); });
    };
    await load();
  };

  // إدارة الفيديوهات: عرض كل روابط الفيديو، تعديلها وحذفها مع التحقق من الصحة
  AD.pages.videos = async (view, q) => {
    const cr = await A.sb.from('courses').select('id,title').order('sort_order'); if (cr.error) throw cr.error;
    const cid = q.get('course') || '';
    const load = async () => {
      let qq = A.sb.from('lessons').select('id,title,course_id,sort_order,courses(title),lesson_content(video_url)').order('course_id').order('sort_order'); if (cid) qq = qq.eq('course_id', cid);
      const { data, error } = await qq; if (error) { A.$('#vl', view).innerHTML = A.errBox(error); return; } AD.cache.videos = data;
      A.$('#vl', view).innerHTML = data.length ? `<div class="card tw"><table><thead><tr><th>الكورس</th><th>الدرس</th><th>المصدر</th><th>الرابط</th><th>إجراءات</th></tr></thead><tbody>${data.map((l) => { const u = (one(l.lesson_content) || {}).video_url, v = u ? A.parseVideo(u) : null;
        return `<tr><td>${E(l.courses ? l.courses.title : '')}</td><td>${E(l.title)}</td><td>${!u ? '<span class="badge warn">لا يوجد فيديو</span>' : v ? `<span class="badge ok">${v.label}</span>` : '<span class="badge bad">رابط غير مدعوم</span>'}</td>
        <td dir="ltr" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(u || '')}</td><td><button class="btn sm ghost" data-a="edit" data-id="${l.id}">${u ? 'تعديل' : 'إضافة'}</button>${u ? `<button class="btn sm danger" data-a="del" data-id="${l.id}">حذف الرابط</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">لا توجد دروس.</div>';
    };
    view.innerHTML = `<div class="bar2"><h1>إدارة الفيديوهات والروابط</h1><div class="f"><div><label for="cs">الكورس</label><select id="cs"><option value="">كل الكورسات</option>${cr.data.map((c) => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${E(c.title)}</option>`).join('')}</select></div></div></div>
      <div class="notice warn">تنبيه أمني: المنصة تُظهر رابط الفيديو لمن يملك الصلاحية فقط، لكن لا تستطيع منع مستخدم مصرّح له من مشاركة الرابط إن كان مصدره الخارجي يسمح بذلك. استخدم فيديوهات «غير مدرجة/Unlisted» أو قيّد النطاقات في مزوّد الفيديو.</div><div id="vl"></div>`;
    A.$('#cs', view).onchange = (e) => { location.hash = '#/videos' + (e.target.value ? '?course=' + e.target.value : ''); };
    view.onclick = async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const l = AD.cache.videos.find((x) => x.id === b.dataset.id), cur = (one(l.lesson_content) || {}).video_url || '';
      if (b.dataset.a === 'edit') {
        const d = A.modal(`<h3>رابط فيديو: ${E(l.title)}</h3><form id="vf" novalidate><label for="v">الرابط (https)</label><input id="v" name="u" dir="ltr" value="${E(cur)}" required><p class="hint">YouTube / Vimeo / Google Drive / mp4 مباشر.</p><div class="row"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" onclick="A.closeModal()">إلغاء</button></div></form>`);
        A.submit(A.$('#vf', d), async (fd) => { const u = fd.get('u').trim(); if (!A.parseVideo(u)) throw A.fail(VERR);
          const r = await A.sb.from('lesson_content').upsert({ lesson_id: l.id, video_url: u }, { onConflict: 'lesson_id' }); if (r.error) throw r.error; A.closeModal(); A.toast('تم حفظ رابط الفيديو'); load(); });
      } else if (await A.confirm('حذف رابط الفيديو من هذا الدرس؟', 'حذف الرابط')) AD.run(b, async () => { const r = await A.sb.from('lesson_content').update({ video_url: null }).eq('lesson_id', l.id); if (r.error) throw r.error; A.toast('تم حذف الرابط'); load(); });
    };
    await load();
  };
})();
