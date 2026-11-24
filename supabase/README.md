# Baca Meter filtering and routing

The configured API returned HTTP 404 with code `PGRST202`: the requested
`public.get_customers_by_reading_day(p_day, p_meter_reader)` signature was not
available in the API schema cache. This prevents filtering before any route
calculation can occur. The migration below creates that exact RPC and reloads
the cache. The frontend must not replace this with exact-date matching or a full
customer-table download.

Apply `migrations/20261024000000_baca_meter_reading_day.sql` to the application's
Supabase project before deploying this frontend change. Run the file in the
Supabase SQL Editor, or apply it through your existing migration process.
This repository does not contain database administration credentials or a linked
Supabase CLI configuration; the migration has not been applied automatically.

The RPC `public.get_customers_by_reading_day(p_day, p_meter_reader)` matches
`EXTRACT(DAY FROM tanggal_baca)::integer = p_day`. Month and year are ignored.
A null reader argument means all readers; otherwise the reader is matched exactly.
Null reading dates do not match. The expression index accelerates the day/reader
lookup. The function uses `SECURITY INVOKER`, so existing permissions and RLS
continue to apply. No customer values or table columns are changed.

The frontend extracts the day from the date input without converting timezones,
requests ordered pages of 1,000 matching customers, and advances by the actual
response size to support lower server row limits. The date picker, local-date
default, draft/applied filter separation, and map rendering stay in place.

## Required deployment step

1. Open the Supabase dashboard for the project configured by `VITE_SUPABASE_URL`.
2. Open **SQL Editor**, create a new query, paste the entire contents of
   `supabase/migrations/20261024000000_baca_meter_reading_day.sql`, and run it as
   the database administrator. It is transactional and can be rerun for this
   function signature. It adds a read-only RPC and expression index; it does not
   update customer values, add table columns, or change RLS policies.
3. Confirm the function is present with:

   ```sql
   select to_regprocedure('public.get_customers_by_reading_day(integer,text)');
   ```

   The result must be `get_customers_by_reading_day(integer,text)`, not null.
4. Deploy the frontend, sign in, and use **Terapkan Filter**. The function is
   executable by `authenticated` and `service_role`, not anonymous visitors.
   `SECURITY INVOKER` preserves the caller's existing table permissions and RLS.
5. If `PGRST202` remains after the function is present, run
   `NOTIFY pgrst, 'reload schema';`, confirm the app uses this project's URL,
   and check the function's argument names are `p_day` and `p_meter_reader`.

After applying the migration, verify using an authenticated session:

```js
await supabase.rpc('get_customers_by_reading_day', {
  p_day: 24,
  p_meter_reader: null,
}).select('no_langganan,tanggal_baca,pembaca_meter')
```

Records dated `2026-09-24`, `2026-08-24`, `2026-10-24`, and `2025-09-24`
should match, while dates ending in `-23` or `-25` should not. Check a specific
reader as well, then verify empty results, pagination, and restoring both
workspaces in the UI.


## Route behavior and limits

`useBacaMeter` fetches customers and commits applied filter state only when all
pages succeed. `useMeterRoute` reads that committed dataset; it never queries
Supabase and never runs automatically when filters change. A successful new
filter cancels and clears the old route. Failed filters preserve the old route,
markers, count and applied filters. An explicitly applied empty result clears
markers and disables routing.

Both **Lokasi Saya** and **Buat Rute** share one `useMyLocation` instance.
Generating a route requests fresh coordinates, or joins an already pending GPS
request, using the existing high-accuracy geolocation options. There is no
continuous tracking or coordinate persistence. Permission/availability errors
are displayed; filters do not require GPS. The route origin stays fixed at the
position used for that calculation, even if the user later refreshes their blue
location dot. Existing map tile loading continues normally.

The route uses Haversine Nearest Neighbor: start at GPS, repeatedly choose the
nearest unvisited customer, stop after each unique customer has been visited.
It does not mutate filter results. Null, blank, nonnumeric, infinite, or
out-of-range coordinates are excluded and counted. Duplicate identifiers are
visited once. Distances include the start-to-first-stop leg, without an implied
return to the start. They are geographical straight-line estimates, not road
distances, directions, or a guarantee of the shortest possible tour.

Exact Nearest Neighbor requires O(n²) work. Calculation yields approximately
every 8 ms and supports cancellation; routes above **5,000 unique valid stops**
are explicitly blocked with a message to narrow the reader filter. All filter
results remain available; no route is silently truncated. This limit also keeps
Leaflet numbered-marker rendering practical.

Normal customer clustering and customer popups are reused; route numbering
replaces marker icons instead of adding a second set of markers. The route is
shown only in Baca Meter, stays in memory across tab switches, and is fitted to
the map once on generation. Returning to the tab does not replay that movement.
**Hapus Rute** removes the line and numbering, restoring normal filtered markers
without clearing filters or the user's blue location marker.

## Verification

Run `node --test tests/*.test.mjs`, `npm run lint`, and `npm run build`.
Automated tests use mocked Supabase, GPS and Leaflet boundaries plus the actual
route algorithm and state hooks. They do not replace an authenticated smoke test
against the deployed RPC and real GPS in a browser. The SQL migration cannot be
applied automatically using the frontend publishable key.

## Implementation file map

| Files | Responsibility |
| --- | --- |
| `src/hooks/useBacaMeter.js` | Draft/applied filters, committing complete results, clear route only on filter success |
| `src/hooks/useMeterRoute.js`, `src/utils/meterRoute.js` | Independent route state, coordinate validation, deduplication, Haversine Nearest Neighbor, yielding/cancellation and explicit stop limit |
| `src/hooks/useMyLocation.js`, `src/components/MyLocationControl.jsx` | Shared on-demand GPS promise/state and persistent blue location layers |
| `src/components/MeterRouteLayer.jsx` | Straight-line polyline, fit once on generation, hide/restore without replaying camera movement |
| `src/components/MapView.jsx`, `src/index.css` | Numbered icons on the existing clustered markers, preserving customer popups |
| `src/pages/RootDashboard.jsx`, `src/pages/Dashboard.jsx` | Shared location wiring and workspace-specific route visibility |
| `src/components/workspaces/BacaMeterWorkspace.jsx` | Route button, loading/errors, counts, route summary and Hapus Rute |
| `supabase/migrations/20261024000000_baca_meter_reading_day.sql` | Missing day-filter RPC, expression index, permissions and schema-cache reload |
| `tests/bacaMeter.test.mjs`, `tests/bacaMeterRouting.test.mjs` | Paginated filtering, Customer Service regressions and filter/route state transitions |
| `tests/meterRoute.test.mjs`, `tests/routeRendering.test.mjs` | Algorithm, performance safeguards, numbering, popup reuse, polyline, sidebar and removal |
| `tests/myLocation.test.mjs`, `tests/workspaceNavigation.test.mjs`, `tests/helpers/routeHarness.mjs` | GPS sharing/cleanup, workspace persistence and test harnesses |

The automated suite passes 39 tests. A separate synthetic 5,000-stop run visited
all 5,000 unique customers, yielded to the event loop 56 times, and took about
0.5 seconds on the development machine; timings will vary by device. Browser
rendering/GPS and the deployed SQL still require the authenticated smoke test
above because no connected browser or database administration session is
available in this environment.
