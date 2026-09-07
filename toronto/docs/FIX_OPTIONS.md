# EVERY FIX FOR EVERY VIOLATION

Derived from the data list, not invented. Built in two directions:
first every move I am allowed to make and what each one disturbs;
then inverted — for each recorded number, every move that can repair it.

Nothing here is a recommendation. It is the complete option set, so that when
something is wrong the question is "which of these", never "is anything possible".

---

## PART 1 — THE MOVES, AND WHAT EACH ONE TOUCHES

Key to the columns: `dO`=dist_ontrip_routed · `tO`=time_ontrip ·
`dR`=dist_ontrip_reported · `dE`/`tE`=dist/time_enroute · `dA`/`tA`=available ·
`tW`=time_waiting · `F`=fares · `n`=trips_total / trips_started ·
`avg`=the pair's distance_avg & duration_avg · `favg`/`wavg`=fare_avg/waittime_avg ·
`X`=toronto_boundary_crossed · `frac`=trip_fractions

| # | move | what it changes | what it must not break | free? |
|---|---|---|---|---|
| M1 | move a ride's **dropoff**, same district, **same length** | `dE`,`tE` of the next ride; the route; the timeline | nothing — length and district hold | **yes, always** |
| M2 | move a ride's **dropoff**, same district, **different length** | `dO`,`dR`,`tO`,`avg`,`dE`,`tE` | must be re-paid elsewhere | yes |
| M3 | move a ride's **pickup**, same district | `dO` (route changes), `dE`,`tE` of this ride | length changes unless compensated | yes |
| M4 | **swap two rides' district pairs** between vehicles | `avg` of both pairs, `dO`/`tO` of both vehicles, `X`, `dE` | pair COUNTS and vehicle COUNTS hold automatically | **yes — counts are safe by construction** |
| M5 | **reorder** a vehicle's rides | `dE`,`tE`, the timeline, which ride spills | `frac` if the last ride changes | yes |
| M6 | change **which ride carries the spill** | `frac`, `dO`, `tO` (portion weights change) | — | yes |
| M7 | shift **length between two rides of one vehicle** | `avg` of both pairs | `dO` of the vehicle is preserved | yes |
| M8 | shift **length between two rides of one pair** | `dO`,`tO` of both vehicles | the pair's `avg` is preserved | yes |
| M9 | change a ride's **route**, same endpoints | `tO`; `dR` if the length differs | must still be the fastest, or `dR` must absorb it | yes |
| M10 | change a **street's speed** | `tO`,`tE`,`tA` of **every ride using that street**, and which routes are fastest | must stay within the class limits; all affected rides re-checked | yes, with the widest blast radius |
| M11 | change a **driver's multiplier** | `tO`,`tE` of that vehicle only | must stay in the city-wide band | yes |
| M12 | change a ride's **dwell** | `tO` only | must stay ≥ 0 and realistic | yes |
| M13 | re-split a vehicle's **fare** across its rides | `favg` of the pairs involved | vehicle's `F` preserved | yes |
| M14 | re-split a vehicle's **waiting time** | `wavg` of the pairs involved | vehicle's `tW` preserved | yes |
| M15 | change **which rides are pooled** | `pooled_trip_fractions` | pooled COUNT preserved | yes |
| M16 | move a **cancellation** in time | nothing measured | — | yes |
| M17 | change the **cruise route** | `dA`,`tA` | — | yes |
| M18 | change a ride's **start time** | the timeline, `frac`, which portion falls in the hour | — | yes |
| M19 | change a crossing ride's **outside portion** | `dR`, `avg` (whole-trip length) | vehicle's recorded `dR−dO` must hold | **constrained — this is recorded** |
| M20 | move a **suppressed** ride to another ward of its council | that ward-pair's `avg`, `dE` | the council-row's own average holds | yes |
| M21 | change which **gateway** a crossing ride uses | `dO`, the route, `dE` | length must be re-paid | yes |

---

## PART 2 — FOR EACH VIOLATION, EVERY FIX

### `trips_total` — too many or too few rides in a pair
Cannot happen by construction (the apportionment fixes counts). If it does:
**M4** only. Every other move preserves counts.

### `distance_avg` too long (or too short) for a pair
1. **M7** — shorten another ride of the same vehicle to pay for lengthening this one → moves the *other* pair's average, so recurse there.
2. **M8** — shift length between two rides in *this* pair → the pair's average is untouched; the two vehicles' `dO` move instead → recurse on those.
3. **M2** — re-place one ride's dropoff at a different length → same debt as M7.
4. **M4** — swap a too-long ride out of the pair for a shorter one from elsewhere → both pairs' averages move.
5. **M21** — for a crossing pair, exit at a nearer or farther gateway.
6. **M20** — for a suppressed pair, put the ride in a different ward.

### `duration_avg` wrong for a pair
1. **M12** — dwell on those rides (cheapest; touches only `tO`).
2. **M11** — the drivers' multipliers (touches only those vehicles).
3. **M9** — a different route of the same length.
4. **M10** — the speed of a street those rides share → **re-check every other ride on it**.
5. **M2/M4** — change which rides are in the pair.

### `fare_avg` / `waittime_avg` wrong for a pair
1. **M13/M14** — re-split within each vehicle; the vehicle total is preserved, so the only casualty is the *other* pairs those vehicles serve → recurse.
2. **M4** — swap rides between pairs.

### `dist_ontrip_routed` wrong for a vehicle
1. **M7** — re-split length across its own rides (pair averages move → recurse).
2. **M2** — re-place a dropoff at a different length.
3. **M4** — swap one of its pairs for a longer/shorter one.
4. **M6** — change which ride spills, altering the portion weights.

### `time_ontrip` wrong for a vehicle
1. **M12** dwell → **M11** multiplier → **M9** route → **M10** street speed. In that order: each has a wider blast radius than the last.

### `dist_ontrip_reported` wrong
Only **M19**, and it is nearly pinned: the vehicle's `reported − routed` is
recorded. The split across its crossing rides is the only freedom.

### `dist_enroute_routed` / `time_enroute` too large
1. **M1** — move the previous dropoff nearer this pickup. **Costs nothing.** Always try first.
2. **M3** — move this pickup nearer the previous dropoff.
3. **M5** — reorder the vehicle's rides.
4. **M4** — give this pair to a vehicle that was already nearby.

### `toronto_boundary_crossed` wrong
**M4** only — swap a crossing ride onto a flagged vehicle and a non-crossing
ride back. Nothing else can change whether a vehicle leaves the city.

### `reported_trip_fractions` wrong
1. **M6** — change which ride carries the spill.
2. **M18** — move start times so a different amount falls inside the hour.
3. **M5** — reorder.

### `dist_available_routed` / `time_available`
**M17** — the cruise is entirely free; it only has to be a real route.

### The timeline is impossible (driver cannot reach the next pickup)
1. **M1** — move the previous dropoff nearer. Free.
2. **M18** — start this ride later.
3. **M5** — reorder.
4. **M4** — a different pair for this vehicle.

### A route is not the fastest
1. **M1/M2** — move the dropoff so the required length *is* the fastest path.
2. **M9** — take the genuinely fastest route and let `dR` absorb the difference.
3. **M10** — slow the streets on the faster alternative so this route wins →
   **every ride on those streets changes**; only worth it if several rides gain.

---

## PART 3 — THE ORDER TO TRY THEM

By blast radius, smallest first:

1. **M1, M16, M17** — touch nothing recorded. Always safe.
2. **M12, M13, M14, M15, M18** — touch one vehicle's own split.
3. **M11** — one vehicle's speed.
4. **M5, M6, M7** — one vehicle's internal arrangement.
5. **M2, M3, M9, M21** — one ride's geometry; debt must be repaid.
6. **M4, M8, M20** — two vehicles or two pairs at once.
7. **M10** — a street, and therefore every ride on it. Last resort, but legitimate.

The engine: detect a violation → take its option list above → try in blast-radius
order → after each, re-check every column the move touches → if a new violation
appears, recurse on it → keep the chain only if the whole set closes better than
before. That is the Rummikub rule made mechanical.
