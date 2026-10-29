# Bite Winnipeg

Build the foundation of a mobile-first food app called "Bite" for Winnipeg restaurants and cafes. It must look and feel like a native phone app (design for a 390px-wide phone screen first, bottom tab navigation, large tap targets, smooth transitions). Make it installable as a PWA (web app manifest + icons + theme color).

THE FULL VISION (build only the foundation now, but structure the app so these slot in later):
- Pre-orders: customers order ahead, pay, and pick up
- Drops: restaurants post limited-quantity items at a set time; users claim them
- Promotions: restaurants post deals to a feed
- Passport: digital stamps across all restaurants, badges, streaks, levels, rewards
- Decide: swipe with friends to pick a restaurant, plus a roulette spin
- Secret menu items unlocked by passport level
- Leftover end-of-day deals

BUILD NOW (Week 1-2 foundation):

1. Authentication with email + password. Two roles: "customer" and "restaurant_owner". On sign up, ask which one they are.

2. Customer app with a bottom tab bar: Home, Drops, Passport, Decide, Profile.
   - Home: search bar, category chips (Coffee, Bakery, Tacos, Pizza, Asian, Brunch, Dessert), and a list of restaurant cards (cover photo, name, category, neighbourhood, open/closed badge).
   - Restaurant detail page: cover photo, logo, description, address, hours, open/closed status, and the menu grouped by category (item photo, name, description, price). Include a "Follow" button.
   - Drops, Passport and Decide tabs: attractive "Coming soon" screens with an icon and one line describing the feature.
   - Profile: name, avatar, followed restaurants, log out.

3. Restaurant owner area (separate dashboard layout, also mobile friendly):
   - Onboarding: restaurant name, category, description, address, neighbourhood, phone, hours for each day, logo upload, cover photo upload.
   - Menu manager: add/edit/delete menu categories and items (name, description, price, photo, available toggle).
   - A "Preview my page" button that shows their public restaurant page.

4. Database (create all of these now so later features fit in; add row-level security so owners only edit their own restaurant and users only edit their own data; public read access for restaurants and menus):
   - profiles (id, role, full_name, avatar_url, created_at)
   - restaurants (id, owner_id, name, slug, category, description, address, neighbourhood, lat, lng, phone, hours jsonb, logo_url, cover_url, is_active, created_at)
   - menu_categories (id, restaurant_id, name, sort_order)
   - menu_items (id, restaurant_id, category_id, name, description, price_cents, photo_url, is_available, is_secret, required_level, created_at)
   - follows (user_id, restaurant_id, created_at)
   - orders (id, user_id, restaurant_id, status [pending, paid, preparing, ready, picked_up, cancelled], pickup_time, total_cents, created_at)
   - order_items (id, order_id, menu_item_id, quantity, price_cents)
   - drops (id, restaurant_id, title, description, photo_url, price_cents, quantity_total, quantity_left, starts_at, ends_at, created_at)
   - promotions (id, restaurant_id, title, description, photo_url, promo_code, starts_at, ends_at, created_at)
   - stamps (id, user_id, restaurant_id, source [visit, order, drop], created_at)
   - badges (id, code, name, description, icon) and user_badges (user_id, badge_id, earned_at)
   - Storage buckets for restaurant logos, covers and menu photos.

5. Seed data: 6 sample Winnipeg cafes and restaurants (use neighbourhoods like Exchange District, Osborne Village, Corydon, St. Boniface, The Forks, West End) with 6-10 menu items each and nice placeholder photos, so the app looks alive.

DESIGN: warm, modern and fun. Off-white background, a bold warm accent colour (tangerine/coral), rounded cards, playful but clean typography, subtle shadows, emoji or icons for categories. Support dark mode.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8a271809-c231-4a07-93a8-39107029a984).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
