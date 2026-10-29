
-- ROLES
create type public.app_role as enum ('customer', 'restaurant_owner', 'admin');
create type public.order_status as enum ('pending','paid','preparing','ready','picked_up','cancelled');
create type public.stamp_source as enum ('visit','order','drop');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _role public.app_role;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url');
  _role := case when new.raw_user_meta_data->>'role' = 'restaurant_owner' then 'restaurant_owner'::public.app_role else 'customer'::public.app_role end;
  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RESTAURANTS
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  slug text not null unique,
  category text not null default 'Coffee',
  description text,
  address text,
  neighbourhood text,
  lat double precision,
  lng double precision,
  phone text,
  hours jsonb not null default '{}'::jsonb,
  logo_url text,
  cover_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.restaurants(owner_id);
grant select on public.restaurants to anon;
grant select, insert, update, delete on public.restaurants to authenticated;
grant all on public.restaurants to service_role;
alter table public.restaurants enable row level security;
create policy "Active restaurants are public" on public.restaurants for select using (is_active or owner_id = auth.uid());
create policy "Owners create restaurant" on public.restaurants for insert to authenticated
  with check (owner_id = auth.uid() and public.has_role(auth.uid(), 'restaurant_owner'));
create policy "Owners update restaurant" on public.restaurants for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete restaurant" on public.restaurants for delete to authenticated using (owner_id = auth.uid());

create or replace function public.owns_restaurant(_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants where id = _restaurant_id and owner_id = auth.uid())
$$;

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);
create index on public.menu_categories(restaurant_id);
grant select on public.menu_categories to anon;
grant select, insert, update, delete on public.menu_categories to authenticated;
grant all on public.menu_categories to service_role;
alter table public.menu_categories enable row level security;
create policy "Menu categories public" on public.menu_categories for select using (true);
create policy "Owners manage categories" on public.menu_categories for all to authenticated
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price_cents int not null default 0 check (price_cents >= 0),
  photo_url text,
  is_available boolean not null default true,
  is_secret boolean not null default false,
  required_level int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.menu_items(restaurant_id);
grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "Public menu items" on public.menu_items for select using (not is_secret or public.owns_restaurant(restaurant_id));
create policy "Owners manage items" on public.menu_items for all to authenticated
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

create table public.follows (
  user_id uuid not null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "Users read own follows" on public.follows for select to authenticated using (user_id = auth.uid() or public.owns_restaurant(restaurant_id));
create policy "Users follow" on public.follows for insert to authenticated with check (user_id = auth.uid());
create policy "Users unfollow" on public.follows for delete to authenticated using (user_id = auth.uid());

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  status public.order_status not null default 'pending',
  pickup_time timestamptz,
  total_cents int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Read own or restaurant orders" on public.orders for select to authenticated using (user_id = auth.uid() or public.owns_restaurant(restaurant_id));
create policy "Create own orders" on public.orders for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "Owners update orders" on public.orders for update to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  quantity int not null default 1 check (quantity > 0),
  price_cents int not null default 0
);
grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "Read order items" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.owns_restaurant(o.restaurant_id))));
create policy "Insert own order items" on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and o.status = 'pending'));

create table public.drops (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  description text,
  photo_url text,
  price_cents int not null default 0,
  quantity_total int not null default 1,
  quantity_left int not null default 1,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.drops to anon;
grant select, insert, update, delete on public.drops to authenticated;
grant all on public.drops to service_role;
alter table public.drops enable row level security;
create policy "Drops public" on public.drops for select using (true);
create policy "Owners manage drops" on public.drops for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  description text,
  photo_url text,
  promo_code text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.promotions to anon;
grant select, insert, update, delete on public.promotions to authenticated;
grant all on public.promotions to service_role;
alter table public.promotions enable row level security;
create policy "Promotions public" on public.promotions for select using (true);
create policy "Owners manage promotions" on public.promotions for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source public.stamp_source not null default 'visit',
  created_at timestamptz not null default now()
);
create index on public.stamps(user_id);
grant select, insert on public.stamps to authenticated;
grant all on public.stamps to service_role;
alter table public.stamps enable row level security;
create policy "Read own stamps" on public.stamps for select to authenticated using (user_id = auth.uid() or public.owns_restaurant(restaurant_id));
create policy "Owners grant stamps" on public.stamps for insert to authenticated with check (public.owns_restaurant(restaurant_id));

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text
);
grant select on public.badges to anon, authenticated;
grant all on public.badges to service_role;
alter table public.badges enable row level security;
create policy "Badges public" on public.badges for select using (true);

create table public.user_badges (
  user_id uuid not null,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
grant select on public.user_badges to authenticated;
grant all on public.user_badges to service_role;
alter table public.user_badges enable row level security;
create policy "Read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid());

-- STORAGE POLICIES (buckets created separately): files live under <user_id>/...
create policy "Bite images public read" on storage.objects for select using (bucket_id in ('restaurant-logos','restaurant-covers','menu-photos'));
create policy "Owners upload own images" on storage.objects for insert to authenticated with check (
  bucket_id in ('restaurant-logos','restaurant-covers','menu-photos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners update own images" on storage.objects for update to authenticated using (
  bucket_id in ('restaurant-logos','restaurant-covers','menu-photos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners delete own images" on storage.objects for delete to authenticated using (
  bucket_id in ('restaurant-logos','restaurant-covers','menu-photos') and (storage.foldername(name))[1] = auth.uid()::text);

-- SEED
insert into public.badges (code, name, description, icon) values
 ('first_stamp','First Bite','Collect your first stamp','🍽️'),
 ('coffee_crawler','Coffee Crawler','Stamps from 5 coffee shops','☕'),
 ('neighbourhood_hopper','Neighbourhood Hopper','Visit 4 different neighbourhoods','🗺️'),
 ('early_bird','Early Bird','Claim a drop in its first 5 minutes','🐦');

insert into public.restaurants (id, name, slug, category, description, address, neighbourhood, lat, lng, phone, hours, logo_url, cover_url) values
('11111111-0000-0000-0000-000000000001','Ember Roasters','ember-roasters','Coffee','Small-batch coffee roasted in a century-old warehouse. Cozy brick walls, big windows, bigger lattes.','123 Bannatyne Ave','Exchange District',49.8995,-97.1384,'(204) 555-0101',
 '{"mon":{"open":"07:00","close":"18:00"},"tue":{"open":"07:00","close":"18:00"},"wed":{"open":"07:00","close":"18:00"},"thu":{"open":"07:00","close":"18:00"},"fri":{"open":"07:00","close":"20:00"},"sat":{"open":"08:00","close":"20:00"},"sun":{"open":"08:00","close":"17:00"}}',
 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop','https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&h=700&fit=crop'),
('11111111-0000-0000-0000-000000000002','Maison Rosie Boulangerie','maison-rosie','Bakery','French-Manitoban bakery baking croissants, tourtière and sugar pie since sunrise.','212 Provencher Blvd','St. Boniface',49.8925,-97.1210,'(204) 555-0102',
 '{"mon":{"closed":true},"tue":{"open":"07:00","close":"16:00"},"wed":{"open":"07:00","close":"16:00"},"thu":{"open":"07:00","close":"16:00"},"fri":{"open":"07:00","close":"17:00"},"sat":{"open":"07:00","close":"17:00"},"sun":{"open":"08:00","close":"14:00"}}',
 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=200&h=200&fit=crop','https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&h=700&fit=crop'),
('11111111-0000-0000-0000-000000000003','Taco Norte','taco-norte','Tacos','Hand-pressed tortillas, slow-braised birria and the best salsa bar on Sargent.','845 Sargent Ave','West End',49.9010,-97.1650,'(204) 555-0103',
 '{"mon":{"open":"11:00","close":"21:00"},"tue":{"open":"11:00","close":"21:00"},"wed":{"open":"11:00","close":"21:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"11:00","close":"23:00"},"sun":{"open":"12:00","close":"20:00"}}',
 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&h=200&fit=crop','https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=1200&h=700&fit=crop'),
('11111111-0000-0000-0000-000000000004','Forks Fire Pizza','forks-fire-pizza','Pizza','Wood-fired Neapolitan pies blistered at 900° right by the river.','1 Forks Market Rd','The Forks',49.8873,-97.1310,'(204) 555-0104',
 '{"mon":{"open":"11:30","close":"21:00"},"tue":{"open":"11:30","close":"21:00"},"wed":{"open":"11:30","close":"21:00"},"thu":{"open":"11:30","close":"21:00"},"fri":{"open":"11:30","close":"22:30"},"sat":{"open":"11:30","close":"22:30"},"sun":{"open":"11:30","close":"21:00"}}',
 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop','https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&h=700&fit=crop'),
('11111111-0000-0000-0000-000000000005','Corydon Noodle Bar','corydon-noodle-bar','Asian','Rich tonkotsu ramen, pan-fried dumplings and bubble tea on the Corydon strip.','678 Corydon Ave','Corydon',49.8640,-97.1530,'(204) 555-0105',
 '{"mon":{"closed":true},"tue":{"open":"11:30","close":"21:30"},"wed":{"open":"11:30","close":"21:30"},"thu":{"open":"11:30","close":"21:30"},"fri":{"open":"11:30","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}',
 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=200&h=200&fit=crop','https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&h=700&fit=crop'),
('11111111-0000-0000-0000-000000000006','Sunny Side Osborne','sunny-side-osborne','Brunch','All-day brunch, fluffy pancakes and the Village''s most dangerous dessert case.','105 Osborne St','Osborne Village',49.8780,-97.1450,'(204) 555-0106',
 '{"mon":{"open":"08:00","close":"15:00"},"tue":{"open":"08:00","close":"15:00"},"wed":{"open":"08:00","close":"15:00"},"thu":{"open":"08:00","close":"15:00"},"fri":{"open":"08:00","close":"16:00"},"sat":{"open":"08:00","close":"16:00"},"sun":{"open":"08:00","close":"16:00"}}',
 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop','https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1200&h=700&fit=crop');

insert into public.menu_categories (id, restaurant_id, name, sort_order) values
('22222222-0000-0000-0001-000000000001','11111111-0000-0000-0000-000000000001','Espresso Bar',0),
('22222222-0000-0000-0001-000000000002','11111111-0000-0000-0000-000000000001','Pastries',1),
('22222222-0000-0000-0002-000000000001','11111111-0000-0000-0000-000000000002','Viennoiserie',0),
('22222222-0000-0000-0002-000000000002','11111111-0000-0000-0000-000000000002','Savoury',1),
('22222222-0000-0000-0003-000000000001','11111111-0000-0000-0000-000000000003','Tacos',0),
('22222222-0000-0000-0003-000000000002','11111111-0000-0000-0000-000000000003','Sides & Drinks',1),
('22222222-0000-0000-0004-000000000001','11111111-0000-0000-0000-000000000004','Pizzas',0),
('22222222-0000-0000-0004-000000000002','11111111-0000-0000-0000-000000000004','Starters & Sweets',1),
('22222222-0000-0000-0005-000000000001','11111111-0000-0000-0000-000000000005','Noodles',0),
('22222222-0000-0000-0005-000000000002','11111111-0000-0000-0000-000000000005','Small Plates & Tea',1),
('22222222-0000-0000-0006-000000000001','11111111-0000-0000-0000-000000000006','Brunch',0),
('22222222-0000-0000-0006-000000000002','11111111-0000-0000-0000-000000000006','Dessert Case',1);

insert into public.menu_items (restaurant_id, category_id, name, description, price_cents, photo_url) values
('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0001-000000000001','Honey Oat Latte','Double shot, oat milk, local Manitoba honey.',625,'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0001-000000000001','Cappuccino','Classic 6oz with velvety microfoam.',495,'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0001-000000000001','Pour Over','Rotating single origin, brewed to order.',550,'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0001-000000000001','Iced Maple Cold Brew','18-hour cold brew, maple cream.',595,'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0001-000000000002','Butter Croissant','Laminated in-house, 72-hour dough.',425,'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0001-000000000002','Glazed Donut','Brioche dough, vanilla bean glaze.',375,'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0001-000000000002','Avocado Toast','Sourdough, chili crunch, lime.',1150,'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400&h=400&fit=crop'),

('11111111-0000-0000-0000-000000000002','22222222-0000-0000-0002-000000000001','Croissant au Beurre','Golden, flaky, unapologetically buttery.',400,'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000002','22222222-0000-0000-0002-000000000001','Pain au Chocolat','Two batons of dark chocolate.',475,'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000002','22222222-0000-0000-0002-000000000001','Country Sourdough Loaf','Naturally leavened, Manitoba wheat.',900,'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000002','22222222-0000-0000-0002-000000000001','Tarte au Sucre','Old-school maple sugar pie slice.',550,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000002','22222222-0000-0000-0002-000000000002','Tourtière Hand Pie','Spiced pork and beef, flaky crust.',850,'https://images.unsplash.com/photo-1601000938259-9e92002320b2?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000002','22222222-0000-0000-0002-000000000002','Croque Monsieur','Ham, gruyère, béchamel, toasted.',1250,'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=400&fit=crop'),

('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0003-000000000001','Birria Taco','Braised beef, consommé for dipping.',550,'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0003-000000000001','Al Pastor','Marinated pork, pineapple, cilantro.',475,'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0003-000000000001','Baja Fish Taco','Beer-battered pickerel, chipotle slaw.',525,'https://images.unsplash.com/photo-1512838243191-e81e8f66f1fd?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0003-000000000001','Mushroom Asada','Charred oyster mushrooms, salsa verde.',450,'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0003-000000000002','Chips & Guac','Smashed to order, warm chips.',800,'https://images.unsplash.com/photo-1600335895229-6e75511892c8?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0003-000000000002','Elote','Street corn, cotija, tajín.',650,'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000003','22222222-0000-0000-0003-000000000002','Horchata','Cinnamon rice milk, over ice.',450,'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop'),

('11111111-0000-0000-0000-000000000004','22222222-0000-0000-0004-000000000001','Margherita','San Marzano, fior di latte, basil.',1600,'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000004','22222222-0000-0000-0004-000000000001','Spicy Soppressata','Chili honey, salami, mozzarella.',1900,'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000004','22222222-0000-0000-0004-000000000001','Funghi Bianca','Wild mushrooms, garlic cream, thyme.',1850,'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000004','22222222-0000-0000-0004-000000000001','Perogy Pie','Potato, cheddar, bacon, sour cream. Very Winnipeg.',1800,'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000004','22222222-0000-0000-0004-000000000002','Garlic Knots','Brushed with herb butter.',750,'https://images.unsplash.com/photo-1619531040576-f9416740661b?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000004','22222222-0000-0000-0004-000000000002','Caesar Salad','Romaine, parm, anchovy dressing.',1200,'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000004','22222222-0000-0000-0004-000000000002','Tiramisu','Espresso-soaked, mascarpone.',900,'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=400&fit=crop'),

('11111111-0000-0000-0000-000000000005','22222222-0000-0000-0005-000000000001','Tonkotsu Ramen','18-hour pork broth, chashu, ajitama.',1795,'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000005','22222222-0000-0000-0005-000000000001','Spicy Miso Ramen','Chili miso, ground pork, corn.',1795,'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000005','22222222-0000-0000-0005-000000000001','Dan Dan Noodles','Sesame, Sichuan pepper, peanuts.',1595,'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000005','22222222-0000-0000-0005-000000000002','Pork Gyoza (6)','Crispy bottoms, black vinegar.',995,'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000005','22222222-0000-0000-0005-000000000002','Salmon Nigiri (4)','Torched, with yuzu kosho.',1295,'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000005','22222222-0000-0000-0005-000000000002','Brown Sugar Boba','Fresh milk, tiger stripes.',695,'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400&h=400&fit=crop'),

('11111111-0000-0000-0000-000000000006','22222222-0000-0000-0006-000000000001','Buttermilk Pancakes','Stack of three, whipped butter, maple.',1450,'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000006','22222222-0000-0000-0006-000000000001','Eggs Benny','Peameal bacon, hollandaise, hash.',1695,'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000006','22222222-0000-0000-0006-000000000001','Shakshuka','Baked eggs, spiced tomato, feta.',1595,'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000006','22222222-0000-0000-0006-000000000001','Smash Burger','Double patty, special sauce, fries.',1795,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000006','22222222-0000-0000-0006-000000000002','Flapper Pie','The Prairie classic: custard and meringue.',750,'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000006','22222222-0000-0000-0006-000000000002','Triple Choc Cake','Dark chocolate ganache layers.',850,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop'),
('11111111-0000-0000-0000-000000000006','22222222-0000-0000-0006-000000000002','Soft Serve Sundae','Vanilla swirl, saskatoon berry sauce.',695,'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&h=400&fit=crop');
