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
