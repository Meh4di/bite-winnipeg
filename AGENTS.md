<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Pickup checkout uses the authenticated `checkout_test_order` database function for atomic price calculation, availability, scheduling, and initial paid status; browser totals are never authoritative.
- Fulfillment status is updated under owner RLS with column-level grants and a transition trigger; pickup stamps are created by an idempotent database trigger.
- Cart state is shared at the app root and persists client-side for sign-in returns; payment providers are isolated behind the payment adapter.
- Order screens subscribe to unique, scoped Realtime channels and remove them on unmount, with periodic refresh as a connection fallback.
- Migrations are tracked by drizzle (`drizzle/migrations`, hashed in `drizzle.__drizzle_migrations`). 0002 adds drops/last-call deals, passport, secret menu and decide groups; do not re-apply it.
- Drops and last-call deals share the `drops` table (`kind` = 'drop' | 'leftover'). Claims go only through the `claim_drop` RPC, which creates a paid test-mode pickup order with `orders.drop_id`; a trigger stops anyone else changing `quantity_left`.
- Passport: levels come from stamp count (`level_for` / `my_level`: Bronze 0, Silver 5, Gold 15, Maple 30). Stamps come from pickups (trigger) and counter visits via `claim_visit_stamp` with a code that rotates every 2 minutes (`get_stamp_code`, owner only). Badges are awarded by a trigger on `stamps`. Rewards (every 5 stamps per spot) go through `redeem_reward`.
- Secret menu items are hidden by RLS unless the viewer's level is at least `required_level`; `secret_menu_teaser` returns the locked count. Checkout accepts secret items only at the required level.
- Decide groups (`decide_sessions/members/votes`) are readable only by members; create and join through `create_decide_session` / `join_decide_session`.
- Avoid `animation-fill-mode: both|forwards` with transforms on page wrappers: it breaks `position: fixed` bars inside them.
- Migrations 0003–0005 add reviews (verified by stamps), house specials, live busyness, free-until dates, Polar Vortex promos, dish ratings + leaderboard view, crawls, pay-it-forward, food donations and taste-twin picks. New tables get broad default privileges here: when limiting columns, REVOKE first, then GRANT column lists (see 0005).
- `restaurants.free_until` and `busy_updated_at` are maintained by the `restaurants_guard` trigger; clients can't change the free period.
- Polar Vortex mode is client-side: Open-Meteo "feels like" temp <= -25°C (or the Profile preview switch) adds `html.vortex`, which recolours the theme.

## Social (migration 0007)
- Tab bar: Home, Drops, Social, Passport, Profile. Decide moved to Profile > Explore and the Social header.
- `/social?tab=feed|tables|match`, `/people/$id`. Hooks in `src/lib/social.ts`, shared UI in `components/bite/Social.tsx`.
- Friends = mutual follows. Feed (`activity`) is filled by triggers and RLS only shows friends' items older than 1 hour.
- Tables (`meetups`): 18+ (`profile_private.birth_date`, owner-only), 3–8 seats, Bite restaurants only, always via RPCs.
- Blocking hides everything both ways; reports go to `user_reports` (insert-only for users).
- DEMO DATA to delete before launch: auth users `00000000-0000-0000-0000-00000000de01..06` (sample.*@bite.example), their follows/activity, meetups `11111111-aaaa-*`, crawl `date-night` and promo `DATE2` (keep those two if you like them).
