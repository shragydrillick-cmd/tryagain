# THE DATA — every column, its type, and exactly what satisfying it means

Built by reading both files end to end and measuring, not from memory.
Row counts: trips file 8,133 rows (hour × pickup district × dropoff district);
operating-hours file 174,505 rows for 2025-09-01 (vehicle × hour), 30,468 vehicles.

**The two files agree exactly on the day's size: `trips_total` sums to 179,247
and `reported_trips_started` sums to 179,247.**

---

## THE TYPES

| type | what it means | what satisfying it requires | what is free |
|---|---|---|---|
| **COUNT** | a whole number of things that happened | the build must produce that many, exactly | which ones, and where |
| **TOTAL** | a sum over a vehicle-hour | the parts must add to it, within the recorded precision | how it splits across the parts |
| **AVERAGE** | a mean over a group | the mean of the built values must equal it. **It does not mean every value equals it** — the spread is free and should be as wide as reality allows | every individual value |
| **FRACTION** | a count that includes part-trips | portions present must sum to it | which ride is the partial one |
| **FLAG** | true/false about a vehicle-hour | must match exactly | nothing |
| **LABEL** | a place or an id | must match exactly | nothing |

**Rounding is part of the definition.** Measured from the files: distances are
recorded to the nearest **0.1 km**; times, fares and all averages to **0.01**.
So a ride of 7.34 km and one of 7.26 km are the same recorded number, 7.3.
Satisfying a distance means landing within 0.05 km; satisfying an average means
within 0.005. Demanding more than that is demanding more than the file says —
I had been auditing distances 100× tighter than the data is written.

---

## TRIPS FILE — 13 columns

| column | type | numbers | satisfying it |
|---|---|---|---|
| `dt` | LABEL | 1 value: 2025-09-01 | — |
| `pickup_hr` | LABEL | 24 hours | the ride starts in that hour |
| `pickup_municipality` | LABEL | 14 | — |
| `pickup_community_council` | LABEL | 5 | — |
| `pickup_ward` | LABEL | 27 (25 wards + "Not in Toronto" + "Not included elsewhere") | pickup lies inside it |
| `dropoff_municipality` | LABEL | 14 | — |
| `dropoff_community_council` | LABEL | 5 | — |
| `dropoff_ward` | LABEL | 27 | dropoff lies inside it |
| `trips_total` | **COUNT** | 179,247; median 15/cell, max 636 | exactly that many rides in the pair |
| `fare_avg` | **AVERAGE** | $7.12–$223.97, median $21.56 | mean fare of the pair's rides, ±0.005 |
| `distance_avg` | **AVERAGE** | 1.56–107.62 km, median 13.53; **1 null** | mean whole-trip length, ±0.005 |
| `waittime_avg` | **AVERAGE** | 0–395.23 min, median 4.35; **7 nulls** | mean wait, ±0.005 |
| `duration_avg` | **AVERAGE** | 4.08–105.00 min, median 20.68 | mean whole-trip duration, ±0.005 |

## OPERATING-HOURS FILE — 19 columns

| column | type | numbers | satisfying it |
|---|---|---|---|
| `vehid` | LABEL | 30,468 vehicles | — |
| `hr` | LABEL | 24 hours | — |
| `reported_trips_started` | **COUNT** | 179,247; 0–7 per hour | that vehicle begins exactly that many |
| `reported_trip_fractions` | **FRACTION** | 180,395.1 | portions present sum to it, ±0.005 |
| `pooled_trips_started` | **COUNT** | 7,705 | that many of its rides are pooled |
| `pooled_trip_fractions` | **FRACTION** | 7,760.4 | pooled portions present, ±0.005 |
| `routed_trips_started` | **COUNT** | 177,048 — **2,199 fewer than were started** | that many rides have a route; the rest have none |
| `driver_cancelled_trips` | **COUNT** | 4,156 | that many events |
| `passenger_cancelled_trips` | **COUNT** | 11,849 | that many events |
| `toronto_boundary_crossed` | **FLAG** | t/f | the vehicle leaves Toronto that hour iff true |
| `fares` | **TOTAL** | $3,784,062 | its rides' fares sum to it, ±0.005 |
| `time_available` | **TOTAL** | 2,792,040 min | cruising minutes, ±0.005 |
| `time_enroute` | **TOTAL** | 568,501 min | minutes driving to pickups, ±0.005 |
| `time_waiting` | **TOTAL** | 174,716 min | stopped-waiting minutes, ±0.005 |
| `time_ontrip` | **TOTAL** | 3,257,457 min | on-trip minutes present in the hour, ±0.005 |
| `dist_available_routed` | **TOTAL** | 753,209 km | cruising km, ±0.05 |
| `dist_enroute_routed` | **TOTAL** | 161,796 km | km driving to pickups, ±0.05 |
| `dist_ontrip_routed` | **TOTAL** | 1,732,288 km | **Toronto-side, ideal route**, ±0.05 |
| `dist_ontrip_reported` | **TOTAL** | 2,097,816 km | **actually driven, whole trip**, ±0.05 |

---

## WHAT THE PAIRS OF COLUMNS TELL YOU (derived, and as binding as the data)

1. **`reported` − `routed` = the distance driven outside Toronto.**
   Proof from the data: for vehicles that never crossed the boundary the two
   columns agree — ratio median **1.000**, total **1.019**, with 46.8% below 1.
   For crossing vehicles the ratio is **1.308**. So the difference is the
   out-of-Toronto travel, and the true route-vs-ideal deviation is only **1.9%**.
   I had earlier read the 21% day-total ratio as a deviation factor; it is not.

2. **`started` − `fractions` telescopes into the spill.** A car is on one trip
   at a time, so only an hour's last ride can still be running: `s_h = Σ(n−F)`.

3. **`reported_trips_started` − `routed_trips_started` = 2,199 rides with no route.**
   Those rides legitimately contribute no routed distance.

4. **`dist_ontrip_reported` contains bad values** — one vehicle-hour records
   1,077.9 km, impossible in 60 minutes. A recorded number can be wrong; this
   column needs an outlier rule, not blind fitting.

---

## WHEN A CHANGE BREAKS SOMETHING — the options, in order of cost

Changing any one thing touches others. The options are always:

| if this breaks | the ways to fix it |
|---|---|
| a **route isn't the fastest** | move the dropoff (many points give the same length) · move the pickup · re-time the street — but then every other ride on that street changes and must be re-checked |
| a **vehicle's distance** | shift length between its own rides (total is recorded, the split is not) · swap one of its pairs with another vehicle · move an endpoint |
| a **pair's average** | change any of its rides' lengths so the mean still lands · swap a ride in or out of the pair |
| a **pair's average fare/wait** | re-split that vehicle's fare across its rides · swap a ride between pairs |
| the **boundary flag** | swap a crossing ride onto a flagged vehicle and a non-crossing one back |
| **en-route too long** | move the previous dropoff nearer · move this pickup nearer · reorder the vehicle's rides · give the pair to a vehicle that was already nearby |
| **timeline impossible** | lengthen the gap by moving a ride earlier · shorten the drive by moving an endpoint · reorder |

A fix is allowed to break something else, provided the chain is followed until
everything closes. Only the columns above may never move.
