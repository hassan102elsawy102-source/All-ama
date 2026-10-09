-- إنشاء حساب المدير الأول (يُنفَّذ يدويًا مرة واحدة من SQL Editor، ولا يمكن تنفيذه من الموقع):
-- 1) سجّل حسابًا عاديًا من صفحة «إنشاء حساب» بالبريد الذي ستستخدمه كمدير.
-- 2) استبدل البريد أدناه ثم شغّل الأمر:
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'ضع-بريد-المدير-هنا@example.com');
-- تحقق: يجب أن يعيد صفًا واحدًا
select id, email, role from public.profiles where role = 'admin';
