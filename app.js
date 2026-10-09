/* هيكل لوحة المدير: أدوات مشتركة. التحقق الحقيقي من الصلاحية يتم في قاعدة البيانات (RLS) */
window.AD = {
  cache: {},
  NAV: [['dashboard', 'الرئيسية والإحصائيات'], ['courses', 'إدارة الكورسات'], ['lessons', 'إدارة الدروس'], ['videos', 'إدارة الفيديوهات والروابط'], ['students', 'إدارة الطلاب'],
        ['subscriptions', 'إدارة الاشتراكات'], ['prices', 'إدارة الأسعار'], ['content', 'إدارة محتوى الموقع'], ['settings', 'إدارة الإعدادات']],
  TABLES: { courses: 'الكورسات', lessons: 'الدروس', lesson_content: 'محتوى الدروس', course_access: 'صلاحيات الوصول', subscriptions: 'الاشتراكات', profiles: 'الطلاب', site_settings: 'إعدادات الموقع' },
  ACTIONS: { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' },
  async uploadImage(file, folder) {
    if (!file || !file.size) return null;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw A.fail('نوع الصورة غير مدعوم (PNG أو JPG أو WebP).');
    if (file.size > 2 * 1024 * 1024) throw A.fail('حجم الصورة أكبر من 2 ميجابايت.');
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg'), path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await A.sb.storage.from('covers').upload(path, file, { contentType: file.type, cacheControl: '3600' });
    if (error) throw error;
    return A.sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
  },
  async count(table, f) { let q = A.sb.from(table).select('*', { count: 'exact', head: true }); if (f) q = f(q); const r = await q; if (r.error) throw r.error; return r.count; },
  async run(btn, fn) { if (btn.disabled) return; btn.disabled = true; try { await fn(); } catch (e) { A.toast(e.userMsg || A.errMsg(e), 'err'); } finally { btn.disabled = false; } },
  fieldLabel(t) { return t; }
};
