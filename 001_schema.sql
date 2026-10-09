-- =====================================================================
-- منصة العلّامة | الأستاذ حسن حمدي — مخطط قاعدة البيانات + سياسات الأمان
-- شغّله مرة واحدة من: Supabase Dashboard → SQL Editor
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- الجداول ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text not null default '' check (char_length(full_name) <= 100),
  phone       text check (phone is null or phone ~ '^[0-9+]{7,15}$'),
  role        text not null default 'student' check (role in ('student','admin')),
  is_banned   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index profiles_created_idx on public.profiles (created_at desc);
create index profiles_role_idx on public.profiles (role);

create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 2 and 150),
  description  text not null default '' check (char_length(description) <= 5000),
  cover_url    text check (cover_url is null or cover_url ~* '^https?://'),
  teacher_name text not null default 'الأستاذ حسن حمدي',
  category     text check (category is null or char_length(category) <= 60),
  is_free      boolean not null default false,
  price        numeric(10,2) not null default 0 check (price >= 0),
  is_published boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint paid_course_has_price check (is_free or price > 0)
);
create index courses_pub_order_idx on public.courses (is_published, sort_order);

create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 200),
  description  text not null default '' check (char_length(description) <= 5000),
  sort_order   int not null default 0,
  is_free      boolean not null default false,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index lessons_course_order_idx on public.lessons (course_id, sort_order);
create index lessons_created_idx on public.lessons (created_at desc);

-- رابط الفيديو والمرفقات في جدول منفصل حتى لا يظهر إلا لمن يملك الصلاحية
create table public.lesson_content (
  lesson_id   uuid primary key references public.lessons(id) on delete cascade,
  video_url   text check (video_url is null or video_url ~* '^https://'),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  updated_at  timestamptz not null default now()
);

create table public.course_access (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, course_id)
);
create index course_access_course_idx on public.course_access (course_id);

create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  status         text not null default 'active' check (status in ('active','expired','cancelled','pending')),
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz,
  price_paid     numeric(10,2) check (price_paid is null or price_paid >= 0),
  payment_method text not null default 'manual',
  payment_status text not null default 'manual' check (payment_status in ('manual','paid','failed','none')),
  created_at     timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_course_idx on public.subscriptions (course_id);

create table public.lesson_progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_]{2,50}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id         bigserial primary key,
  actor      uuid references public.profiles(id) on delete set null,
  action     text not null,
  table_name text not null,
  record_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_log (created_at desc);

-- ---------- دوال مساعدة (تُنفَّذ على الخادم) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and not is_banned);
$$;

create or replace function public.has_course_access(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.course_access ca
    join public.profiles p on p.id = ca.user_id
    where ca.user_id = auth.uid() and ca.course_id = p_course
      and not p.is_banned
      and (ca.expires_at is null or ca.expires_at > now()));
$$;

-- هل يحق للمستخدم الحالي رؤية محتوى (فيديو/مرفقات) هذا الدرس؟
create or replace function public.can_view_lesson(p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_admin() or exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      join public.profiles p on p.id = auth.uid()
      where l.id = p_lesson and l.is_published and c.is_published and not p.is_banned
        and (l.is_free or c.is_free or public.has_course_access(c.id))));
$$;

-- ---------- المشغّلات ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger t_courses_upd  before update on public.courses  for each row execute function public.set_updated_at();
create trigger t_lessons_upd  before update on public.lessons  for each row execute function public.set_updated_at();
create trigger t_content_upd  before update on public.lesson_content for each row execute function public.set_updated_at();
create trigger t_settings_upd before update on public.site_settings for each row execute function public.set_updated_at();

-- إنشاء الملف الشخصي عند التسجيل: الدور دائمًا student ولا يُقرأ من المتصفح أبدًا
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ph text := nullif(new.raw_user_meta_data->>'phone','');
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email,
          left(coalesce(new.raw_user_meta_data->>'full_name',''), 100),
          case when ph ~ '^[0-9+]{7,15}$' then ph else null end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- منع الطالب من تغيير الدور أو الحظر (حتى لو أرسل ذلك مباشرة إلى API)
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_banned is distinct from old.is_banned
       or new.id is distinct from old.id
       or new.email is distinct from old.email then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger t_profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- سجل التدقيق: يُكتب من الخادم فقط عندما يكون المنفّذ مديرًا
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb; rid text; det jsonb;
begin
  if auth.uid() is null or not public.is_admin() then return null; end if;
  if tg_op = 'DELETE' then j := to_jsonb(old); det := jsonb_build_object('old', j);
  elsif tg_op = 'UPDATE' then j := to_jsonb(new); det := jsonb_build_object('old', to_jsonb(old), 'new', j);
  else j := to_jsonb(new); det := jsonb_build_object('new', j); end if;
  rid := coalesce(j->>'id', j->>'key', j->>'lesson_id');
  insert into public.audit_log (actor, action, table_name, record_id, details)
  values (auth.uid(), tg_op, tg_table_name, rid, det);
  return null;
end $$;
revoke execute on function public.log_change() from public, anon, authenticated;
create trigger a_courses  after insert or update or delete on public.courses        for each row execute function public.log_change();
create trigger a_lessons  after insert or update or delete on public.lessons        for each row execute function public.log_change();
create trigger a_content  after insert or update or delete on public.lesson_content for each row execute function public.log_change();
create trigger a_access   after insert or update or delete on public.course_access  for each row execute function public.log_change();
create trigger a_subs     after insert or update or delete on public.subscriptions  for each row execute function public.log_change();
create trigger a_profiles after update                      on public.profiles       for each row execute function public.log_change();
create trigger a_settings after insert or update or delete on public.site_settings for each row execute function public.log_change();

-- ---------- دوال إدارية (للمدير فقط، يتحقق منها الخادم) ----------
create or replace function public.admin_set_access(
  p_user uuid, p_course uuid, p_grant boolean,
  p_expires timestamptz default null, p_price numeric default null, p_method text default 'manual')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_grant then
    insert into public.course_access (user_id, course_id, granted_by, expires_at)
    values (p_user, p_course, auth.uid(), p_expires)
    on conflict (user_id, course_id)
    do update set expires_at = excluded.expires_at, granted_by = auth.uid(), granted_at = now();
    update public.subscriptions
       set ends_at = p_expires, payment_method = coalesce(nullif(p_method,''), payment_method),
           price_paid = coalesce(p_price, price_paid)
     where user_id = p_user and course_id = p_course and status = 'active';
    if not found then
      insert into public.subscriptions (user_id, course_id, status, ends_at, price_paid, payment_method, payment_status)
      values (p_user, p_course, 'active', p_expires,
              coalesce(p_price, (select price from public.courses where id = p_course)),
              coalesce(nullif(p_method,''), 'manual'), 'manual');
    end if;
  else
    delete from public.course_access where user_id = p_user and course_id = p_course;
    update public.subscriptions set status = 'cancelled'
     where user_id = p_user and course_id = p_course and status = 'active';
  end if;
end $$;

create or replace function public.admin_reorder_courses(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.courses c set sort_order = t.ord
    from unnest(p_ids) with ordinality as t(id, ord) where c.id = t.id;
end $$;

create or replace function public.admin_reorder_lessons(p_course uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.lessons l set sort_order = t.ord
    from unnest(p_ids) with ordinality as t(id, ord)
   where l.id = t.id and l.course_id = p_course;
end $$;

revoke all on function public.admin_set_access(uuid,uuid,boolean,timestamptz,numeric,text) from public, anon;
revoke all on function public.admin_reorder_courses(uuid[]) from public, anon;
revoke all on function public.admin_reorder_lessons(uuid,uuid[]) from public, anon;
grant execute on function public.admin_set_access(uuid,uuid,boolean,timestamptz,numeric,text) to authenticated;
grant execute on function public.admin_reorder_courses(uuid[]) to authenticated;
grant execute on function public.admin_reorder_lessons(uuid,uuid[]) to authenticated;

-- ---------- سياسات أمان الصفوف (RLS) ----------
alter table public.profiles        enable row level security;
alter table public.courses         enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_content  enable row level security;
alter table public.course_access   enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.site_settings   enable row level security;
alter table public.audit_log       enable row level security;

-- profiles: لا يوجد INSERT/DELETE من العميل؛ الإنشاء عبر المشغّل فقط
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- courses
create policy courses_select on public.courses for select to anon, authenticated
  using (is_published or public.is_admin());
create policy courses_admin on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lessons (العناوين فقط؛ المحتوى المحمي في lesson_content)
create policy lessons_select on public.lessons for select to anon, authenticated
  using (public.is_admin() or (is_published and exists (
    select 1 from public.courses c where c.id = course_id and c.is_published)));
create policy lessons_admin on public.lessons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lesson_content: لا يُقرأ إلا بعد تحقق الخادم من الصلاحية
create policy content_select on public.lesson_content for select to authenticated
  using (public.can_view_lesson(lesson_id));
create policy content_admin on public.lesson_content for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- course_access / subscriptions: الطالب يقرأ سجلاته فقط، والمدير يدير الكل
create policy access_select on public.course_access for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy access_admin on public.course_access for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy subs_select on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy subs_admin on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- lesson_progress
create policy progress_select on public.lesson_progress for select to authenticated
  using (user_id = auth.uid());
create policy progress_insert on public.lesson_progress for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_lesson(lesson_id));
create policy progress_delete on public.lesson_progress for delete to authenticated
  using (user_id = auth.uid());

-- site_settings: قراءة عامة، كتابة للمدير فقط
create policy settings_select on public.site_settings for select to anon, authenticated using (true);
create policy settings_admin on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- audit_log: قراءة للمدير فقط، ولا كتابة مباشرة من العميل
create policy audit_select on public.audit_log for select to authenticated using (public.is_admin());

-- ---------- التخزين (صور الأغلفة) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers','covers', true, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;
create policy covers_read   on storage.objects for select using (bucket_id = 'covers');
create policy covers_insert on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_admin());
create policy covers_update on storage.objects for update to authenticated using (bucket_id = 'covers' and public.is_admin());
create policy covers_delete on storage.objects for delete to authenticated using (bucket_id = 'covers' and public.is_admin());

-- ---------- إعدادات افتراضية محايدة (قابلة للتعديل من لوحة المدير) ----------
insert into public.site_settings (key, value) values
 ('platform_name',  '"العلّامة"'),
 ('teacher_name',   '"الأستاذ حسن حمدي"'),
 ('hero_title',     '"منصة العلّامة التعليمية"'),
 ('hero_text',      '"منصة عربية للتعلّم عبر دروس مسجّلة منظمة، مع متابعة تقدّمك في كل كورس."'),
 ('currency_label', '"ج.م"'),
 ('features',       '[{"title":"دروس مسجّلة منظمة","text":"كل كورس مقسّم إلى دروس مرتبة يمكنك العودة إليها في أي وقت."},{"title":"متابعة التقدّم","text":"سجّل الدروس التي أنهيتها وتابع نسبة إنجازك في كل كورس."},{"title":"حساب شخصي وصلاحيات واضحة","text":"ترى الكورسات والدروس المتاحة لك وحالة اشتراكك في كل كورس."}]'),
 ('faq',            '[]'),
 ('teacher_bio',    '""'),
 ('teacher_photo',  '""'),
 ('hero_image',     '""'),
 ('contact_email',  '""'),
 ('contact_phone',  '""'),
 ('contact_whatsapp','""'),
 ('social_facebook','""'),('social_youtube','""'),('social_instagram','""'),
 ('social_telegram','""'),('social_tiktok','""')
on conflict (key) do nothing;
