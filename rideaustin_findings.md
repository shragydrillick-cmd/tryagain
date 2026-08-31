# RideAustin Data — Findings

Dataset downloaded from Kaggle: `mexwell/rideaustin-data` (slug worked on first try, no 404).
License: CC0-1.0.

All commands below were run in a scratch directory after `kaggle datasets download -d mexwell/rideaustin-data`.

## 1. Files, sizes, row counts, columns

The archive contains **exactly one file**.

```
$ unzip -l rideaustin-data.zip
Archive:  rideaustin-data.zip
  inflating: RideAustin_Weather.csv
```

| File | Zipped size | Unzipped size | Rows (excl. header) | Columns |
|---|---|---|---|---|
| `RideAustin_Weather.csv` | 24,238,939 bytes (~24 MB) | 165,706,522 bytes (~159 MB) | 911,057 | 29 |

Row count check:
```
$ wc -l RideAustin_Weather.csv
911058 RideAustin_Weather.csv   # includes 1 header row -> 911,057 data rows
```

Full column list (from the header row), with dtype as pandas inferred it:

```
completed_on            str
distance_travelled      float64
end_location_lat        float64
end_location_long       float64
started_on              str
driver_rating            float64
rider_rating             float64
start_zip_code           str
end_zip_code              str
charity_id                float64
requested_car_category    str
free_credit_used          float64
surge_factor               float64
start_location_long        float64
start_location_lat         float64
color                       str
make                        str
model                       str
year                        int64
rating                      float64
Date                        str
PRCP                        float64
TMAX                        int64
TMIN                        int64
AWND                        float64
GustSpeed2                  float64
Fog                         float64
HeavyFog                    float64
Thunder                     float64
```

This is a single, pre-merged ride+weather table (the `Date`/`PRCP`/`TMAX`/`TMIN`/`AWND`/`GustSpeed2`/`Fog`/`HeavyFog`/`Thunder` columns are daily weather fields joined onto each ride by date). No separate drivers, riders, or weather file exists in the archive — it's all one CSV.

## 2. Is there a driver ID column?

**No.** There is no column identifying a driver in this file.

I checked the full column list for anything containing "id", "driver", or "rider":

```python
id_like = [c for c in df.columns if "id" in c.lower() or "driver" in c.lower() or "rider" in c.lower()]
print(id_like)
# -> ['driver_rating', 'rider_rating', 'charity_id']
```

- `driver_rating` and `rider_rating` are numeric rating scores (1–5), not identifiers.
- `charity_id` is a charity identifier (49 distinct values, 700,229 of 911,057 rows null) — unrelated to drivers.
- There is also no `trip_id`/`ride_id`, no `rider_id`, and no vehicle ID. The only vehicle-related fields are `color`, `make`, `model`, `year` — descriptive attributes, not identifiers, and not unique per driver (multiple drivers can share the same make/model/color/year).

**Distinct driver count: cannot be computed — there is no field to count distinct drivers by.** I am not substituting a proxy (e.g., vehicle attributes) for a driver ID, since that would be inference, not what's in the data.

## 3. Driver-day span distribution (first ride start → last ride end)

**Cannot be computed.** This requires grouping rides by driver and by day, which requires a driver ID column. Since none exists (see #2), there is no way to group rides by driver at all, so no per-driver-day span can be derived — not even approximately, without inventing a driver key that isn't in the source data.

Even if a driver ID existed, the requested approximation (driver's first ride start to last ride end, per day) would still be a flawed proxy for "how long a driver chose to work," for reasons worth flagging in advance:
- It only spans between observed trips, so any idle/searching time before the first ride or after the last ride of the day isn't captured — a driver could have been online (searching for rides) well before their first pickup or after their last drop-off.
- Gaps between rides within the span get counted as "working" time even if the driver went offline, took a break, or was unavailable, inflating the estimate.
- Shifts crossing midnight would be split across two calendar days by a naive date grouping, artificially shortening both days' spans, unless the day is defined relative to a shift start.
- A driver with only one ride in a day would have a span of zero, understating that they were working around that single ride.

## 4. Are cancelled/unaccepted/unmatched requests in the data, or completed trips only?

**There is no status column**, and I did not find any field indicating cancellation, acceptance, or match state:

```python
status_like = [c for c in df.columns if "status" in c.lower() or "state" in c.lower()
               or "cancel" in c.lower() or "accept" in c.lower()]
print(status_like)
# -> []
```

Circumstantial signals (not proof, and I'm not treating them as such):
- `completed_on` has 0 nulls across all 911,057 rows — every row has a completion timestamp.
- `started_on` has 0 nulls.
- `distance_travelled` is null in only 2 rows and exactly `0` in 10 rows (out of 911,057).

These patterns are *consistent with* the file containing only completed trips, but there is no explicit status/outcome column that says so. I can't confirm or rule out that cancelled/unaccepted/unmatched requests were filtered out upstream before this CSV was produced — that information isn't in the file.

## 5. Utilization (time on trips ÷ total driver-day span)

**Cannot be computed.** This metric requires:
1. A driver ID to group trips by driver (doesn't exist — see #2), and
2. A driver-day span as the denominator, which itself can't be computed without #1 (see #3).

Both prerequisites are absent, so neither the per-driver nor the overall utilization number can be produced from this file. I'm not substituting a placeholder or fleet-wide estimate in place of a real per-driver calculation.

If it *could* be computed, the concept of "available" would still need a working definition — e.g., "available" = clock time between a driver's first and last ride of the day, which silently assumes the driver was online/available the whole time between trips (including any break, meal, or offline period), which would push utilization artificially high, and using calendar-day boundaries would understate spans for shifts crossing midnight.

## 6. Date range and total ride count

```python
df["started_on_dt"] = pd.to_datetime(df["started_on"])
df["completed_on_dt"] = pd.to_datetime(df["completed_on"])
print(df["started_on_dt"].min(), df["started_on_dt"].max())
print(df["completed_on_dt"].min(), df["completed_on_dt"].max())
```

Output:
```
started_on   min: 2016-06-04 04:34:52   max: 2017-02-07 10:09:22
completed_on min: 2016-06-04 04:35:56   max: 2017-02-07 10:19:12
```

- **Date range:** 2016-06-04 to 2017-02-07 (based on `started_on`; `completed_on` matches to within minutes at both ends).
- **Total rides:** 911,057 rows.
- Note: 2,713 fully duplicate rows exist in the raw file (identical across all 29 columns) — not deduplicated for the count above, since the task asked for what's in the data.

## Other things noticed while reading the file (not asked for, but relevant to trustworthiness of the above)

- Null counts by column, for reference:

```
completed_on                 0
distance_travelled           2
end_location_lat             0
end_location_long            0
started_on                   0
driver_rating            106,163
rider_rating               22,077
start_zip_code             16,913
end_zip_code               18,286
charity_id                700,229
requested_car_category         0
free_credit_used          724,357
surge_factor                    0
start_location_long             0
start_location_lat              0
color                           0
make                            0
model                           0
year                             0
rating                           0
Date                             0
PRCP / TMAX / TMIN / AWND / GustSpeed2 / Fog / HeavyFog / Thunder    0 (all)
```

- `requested_car_category` values: `REGULAR` (866,277), `SUV` (32,474), `PREMIUM` (8,451), `LUXURY` (2,342), `HONDA` (1,513). "HONDA" as a category alongside vehicle-class names is an oddity in the raw data, reported as-is.

## Summary answer to the main question

**There is no driver ID column in this dataset.** Nothing in the 29 columns identifies which driver operated a given ride. As a direct consequence, distinct driver count, driver-day work-span distribution, and utilization (all of #2, #3, #5) cannot be computed from this file — not approximated, not estimated from proxies, just not derivable from what's here.
