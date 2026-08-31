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

---

# Addendum: `driver_surge_rideaustin` repo review + data.world source check

## Task 1: `nikhgarg/driver_surge_rideaustin` preprocessing code

```
$ git clone https://github.com/nikhgarg/driver_surge_rideaustin.git
Cloning into 'driver_surge_rideaustin'...
$ grep -rn "Rides_Data" .
./readme.md:10:1. Download data from above link (Rides_DataA.csv, Rides_DataB.csv) and put in data/rideaustin/ folder
./readme.md:25:- **create_clean_rides_file.py**: merges Rides_DataA.csv, Rides_DataB.csv, and converts time-zones, and replaces incorrect values with NaN.
./data_preprocessing/create_clean_rides_file.py:17:    filename1 = 'Rides_DataA.csv'
./data_preprocessing/create_clean_rides_file.py:18:    filename2 = 'Rides_DataB.csv'
```

The only script in the repo that reads `Rides_DataA.csv`/`Rides_DataB.csv` directly is `data_preprocessing/create_clean_rides_file.py`. Relevant lines:

```python
# data_preprocessing/create_clean_rides_file.py, lines 16-23
def clean_and_merge_datafiles(folder = 'data/rideaustin/', filelabel = 'rides3', override_start_with_dispatch = False):
    filename1 = 'Rides_DataA.csv'
    filename2 = 'Rides_DataB.csv'

    df = pd.read_csv(folder + filename1)
    df2 = pd.read_csv(folder + filename2)

    austin= pd.merge(left= df, right= df2, on='RIDE_ID').set_index('RIDE_ID')
```

Both files are read with plain `pd.read_csv` (no `usecols`), so **every** column present in each raw CSV is loaded — the code doesn't itself enumerate a full schema of A vs. B. The only column it explicitly names as tying the two files together is **`RIDE_ID`** (the merge key). After the merge, the script goes on to explicitly reference these columns by name:

```python
# lines 30-32 (comment, listing fields — NOT all of these are actually processed, see below)
    # date_fields = ['driver_reached_on', 'started_on', 'completed_on', 'created_date', 'updated_date', 'driver_accepted_on', 'dispatched_on','cancelled_on']
    date_fields_to_convert = ['started_on', 'completed_on', 'dispatched_on']
    date_fields_newnames = ['start_hour', 'end_hour', 'dispatch_hour']
```

Only `started_on`, `completed_on`, `dispatched_on` are actually converted/used (`date_fields_to_convert`); `driver_reached_on`, `created_date`, `updated_date`, `driver_accepted_on`, `cancelled_on` appear **only inside a comment** (line 30, prefixed `#`) — the code never touches them.

Columns the script actually reads/writes later on (quoted verbatim):

```python
austin['surged_trip'] = austin.surge_factor>1                                    # line 66
incomplete =  austin[austin.total_fare.isnull()].index                           # line 69
austin['miles']= austin['distance_travelled']*.000621371                          # line 74
rates_to_low = austin[(austin.rate_per_minute <=0)].index                         # line 88
rates_to_low = austin[(austin.rate_per_mile <=0)].index                           # line 92
surge0 = austin[(austin.surge_factor <=0)].index                                  # line 98
toohightotalfare = austin[austin.total_fare>480].index                            # line 104
```

**Full set of Rides_DataA/B column names this preprocessing script explicitly references:** `RIDE_ID`, `started_on`, `completed_on`, `dispatched_on`, `surge_factor`, `total_fare`, `distance_travelled`, `rate_per_minute`, `rate_per_mile` — plus five more named only in the disabled comment on line 30 (`driver_reached_on`, `created_date`, `updated_date`, `driver_accepted_on`, `cancelled_on`), which the running code does not act on.

### Is there a driver identifier?

**Not in `create_clean_rides_file.py` itself** — I grepped this file specifically for `driver` (beyond the two `driver_*_on` timestamp fields above) and got zero matches. The merge-and-clean script that actually touches `Rides_DataA.csv`/`Rides_DataB.csv` never references a driver ID column.

A driver identifier **does appear elsewhere in the repo**, under two different names, both used only on the *already-merged* data (i.e., assumed to already be a column, not something the code derives):

**`driver_id`** — declared in `settings.py`'s `relevant_columns` list:
```python
# settings.py, line 36
    "driver_id",
```
and used downstream as the key to group/identify a driver's trips:
```python
# pipeline.py, line 100
df_grouped = df.groupby("driver_id")

# shift_earnings/shift_earning_functions.py, lines 15, 20
aggdict['driver_id'] = 'count' # doesn't matter which column it is, I just want a count
...
df_session.rename(columns = {'driver_id' : 'number_trips'}, inplace = True)

# trip_indifference/matching_period_functions.py, line 28
driverid = matched_row.driver_id

# trip_indifference/earnings_utilities.py, lines 29, 49
driverid = row.driver_id
driverid = matched_row.driver_id

# trip_indifference/matching_functions.py, lines 53, 55 (and duplicated at 86, 88)
relevant = relevant.drop_duplicates(subset = 'driver_id', keep = 'last', inplace =False)
relevant = relevant[relevant.driver_id != row.driver_id] #check that their driver id is different than the one I want to match
```
So `driver_id` is used to: group all of a driver's trips together (`groupby`/`get_group`) to look up "this driver's other trips" for earnings and matching calculations; count trips per driver; and exclude a row's own driver when searching for a comparable/matched driver nearby.

**`active_driver_id`** — also declared in `settings.py`'s `relevant_columns` (line 16), and used specifically as the grouping key for a driver **shift/session**, not the whole-history driver identity:
```python
# settings.py, lines 65
    "driver_shift_columns": ["active_driver_id"],

# shift_earnings/shift_earning_functions.py, line 7
def get_session_earnings_df(df, payment_function_names, shift_column = 'active_driver_id'):
...
df_session = df.groupby(shift_column).agg(aggdict)   # groups trips into a driver-shift/session
```
This groups trips by `active_driver_id` to compute one row per shift: shift length (`end_hour - dispatch_hour`), number of trips, proportion of the shift spent on a trip, and earnings.

**I did not find any comment or docstring in the repo that defines the difference between `driver_id` and `active_driver_id`.** The code just uses two differently-named columns for two different groupings (all-time driver identity vs. a shift/session identity) without documenting what distinguishes them. I'm reporting that gap plainly rather than guessing at RideAustin's schema.

**Important caveat:** because `driver_id`/`active_driver_id` are referenced only in code that runs on the *merged and preprocessed* file (not in `create_clean_rides_file.py`, which is the only script that names `Rides_DataA.csv`/`Rides_DataB.csv` directly), the repo's code never states which of the two raw files — A or B — either column physically comes from. That fact isn't in the code, so I'm not inferring it.

## Task 2: data.world source dataset

```
$ curl -sS -L -o page.html -w "HTTP_STATUS:%{http_code}\nFINAL_URL:%{url_effective}\nREDIRECTS:%{num_redirects}\n" \
  "https://data.world/ride-austin/ride-austin-june-6-april-13"
HTTP_STATUS:200
FINAL_URL:https://data.world/community/goodbye/
REDIRECTS:2
```

The dataset URL redirects (2 hops) to `https://data.world/community/goodbye/`. This is **not a login wall** — a data.world account would not help. The page content:

> "The data.world Open Data Community officially retired on July 13, 2026, and all associated community member data is being deleted as part of this process. As a result, the open data community datasets are no longer accessible or available for download."
>
> "It is with profound gratitude to the multitude of users who made this community what it was over the last decade that we announce the retirement of the data.world Open Data Community, discontinued as of July 13, 2026, following our acquisition by ServiceNow in 2025."

**The dataset is gone — not access-gated, but retired/deleted by data.world.** I could not download `Rides_DataA.csv`/`Rides_DataB.csv` and therefore cannot report row counts or column lists for them. I did not create a data.world account since one would not restore access to already-deleted community data (per the page's own text), and I did not search for third-party mirrors since that wasn't asked for — let me know if you'd like me to look for one.
