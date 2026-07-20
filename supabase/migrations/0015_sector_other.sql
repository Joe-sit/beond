-- beond — fallback sector. The add-bond form no longer asks the user to pick an
-- industry (SEC doesn't classify bonds), so newly-added bonds default to this
-- "unclassified" bucket. The by-sector allocation view shows it as its own group.

insert into public.sectors (id, label_th, color)
values ('other', 'อื่น ๆ / ไม่ระบุกลุ่ม', '#9AA0A6')
on conflict (id) do nothing;
