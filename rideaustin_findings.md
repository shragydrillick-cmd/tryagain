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

---

# Addendum 2: Searching for a surviving copy of Rides_DataA.csv / Rides_DataB.csv

Goal: find a mirror of the ~1.5M-row, 60-column raw file with `driver_id`/`active_driver_id`, since the data.world source is gone. Result: **not found anywhere I could actually check.** Full trail below — commands and raw output first, then what each result means.

## 1. GitHub — named repos

```
$ git clone https://github.com/Johnsoneer/RideAustin_Capstone.git
Cloning into 'Johnsoneer_RideAustin_Capstone'...  [succeeded]

$ git clone https://github.com/princebot/RideAustin.git
Cloning into 'princebot_RideAustin'...  [succeeded]

$ git clone https://github.com/JCMontalbano/RideAustin.git
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

`JCMontalbano/RideAustin` — a WebFetch directly to `https://github.com/JCMontalbano/RideAustin` returned a genuine **HTTP 404** from GitHub. The git-clone failure (asking for credentials) is consistent with that: git does the same thing for a 404 as for a private repo. A web search summary claimed this repo "exists," but I verified directly against GitHub itself and it does not — I'm going with the direct check, not the search summary.

Contents of the two repos that did clone (`find <repo> -type f`, `.git` excluded):

- **Johnsoneer/RideAustin_Capstone**: notebooks, a Tableau workbook, images, and a `csv's/` folder with `current_areas.csv`, `current_hotspots.csv`, `future_hotspots.csv`, `polygons.csv`, `previous_hotspots.csv`. All are small **derived/aggregated** tables (cluster centroids, polygon vertices, per-area summary stats) — not raw trip records. Header check on each, e.g.:
  ```
  $ head -1 current_hotspots.csv
  cluster,status_value,total_rides,avg_fare,lat,long
  ```
  No `driver_id` anywhere.
  ```
  $ grep -rl "driver_id\|Rides_DataA\|Rides_DataB\|active_driver_id" Johnsoneer_RideAustin_Capstone/ princebot_RideAustin/
  [no output — zero matches]
  ```

- **princebot/RideAustin**: one notebook, `masks.py`, and `RideVolume.csv`:
  ```
  $ head -3 RideVolume.csv
  Date,Rides
  "Thursday, June 16",190
  "Friday, June 17",345
  $ wc -l RideVolume.csv
  78
  ```
  A 78-row daily aggregate (just a date and a ride count) — no driver info. Its README explicitly says it's derived from `github.com/JCMontalbano/RideAustin` (doesn't exist, see above) and `data.world/andytryba/rideaustin` (dead, see §4).

**Ruled out**: neither repo contains, nor points to a live copy of, the raw file.

## 2. GitHub — code search / forks

I don't have unauthenticated GitHub code-search or API access in this environment — direct calls to `api.github.com` and to `github.com` web pages (outside `git clone`) are blocked by this session's proxy for repos outside its configured scope:
```
$ curl -i https://api.github.com/search/code?q=Rides_DataA.csv
HTTP/1.1 403 Forbidden
{"message":"GitHub access to this repository is not enabled for this session...
```
(Confirmed this is a blanket proxy block, not a repo-specific one — the same 403 comes back even for `octocat/Hello-World`, a repo that definitely exists and is public.)

So I substituted web search for GitHub-wide code search:
- `site:github.com "Rides_DataA.csv"` — only hit was the already-known `nikhgarg/driver_surge_rideaustin`.
- Fork list for `nikhgarg/driver_surge_rideaustin` (`https://github.com/nikhgarg/driver_surge_rideaustin/forks`): **"No forked repositories found."**

**Ruled out, with a caveat**: web search is not the same as GitHub's own code-search index, so I can't claim this is exhaustive — only that nothing surfaced.

## 3. Wayback Machine

```
$ curl "http://archive.org/wayback/available?url=data.world/ride-austin/ride-austin-june-6-april-13"
{"url": "...", "archived_snapshots": {"closest": {"status": "200", "available": true,
  "url": "http://web.archive.org/web/20260706153652/https://data.world/ride-austin/ride-austin-june-6-april-13",
  "timestamp": "20260706153652"}}}
```
This says a snapshot of the *dataset page* exists from 2026-07-06 (before the July 13 retirement) — potentially promising. But I **could not fetch it**:
```
$ curl -L "http://web.archive.org/web/20260706153652/https://data.world/ride-austin/ride-austin-june-6-april-13"
HTTP_STATUS:403   (0 bytes returned)

WebFetch same URL → "Claude Code is unable to fetch from web.archive.org"

$ curl "http://web.archive.org/cdx/search/cdx?url=data.world/ride-austin*&matchType=prefix&output=json"
Blocked by egress policy
```
**Not ruled out — genuinely unknown.** This is an environment restriction (this session cannot reach `web.archive.org` at all, via curl or WebFetch), not evidence about what is or isn't archived. Also worth noting even if I could fetch it: data.world dataset pages typically serve file downloads via signed/dynamic URLs, which the Wayback Machine usually can't capture even when it captures the page shell — so a snapshot existing is not the same as the actual CSV bytes being recoverable. **You may have better luck checking this snapshot yourself in a browser**: `http://web.archive.org/web/20260706153652/https://data.world/ride-austin/ride-austin-june-6-april-13`. I also tried `archive.ph` as an alternative archive and got a connection reset — also unreachable from here.

## 4. Other data.world uploads (not just the `ride-austin` org account)

Web search surfaced two more data.world links citing this same dataset:
- `data.world/andytryba/rideaustin` (RideAustin's CEO's own upload, cited by princebot's README, with a stated 1,494,002-row count that matches your ~1.5M figure)
- `data.world/jcmontalbano/kmeansdriveroptimization-historical-data-csv`

Both checked directly:
```
WebFetch → both show the identical "data.world Open Data Community... officially retired on July 13, 2026... all associated community member data is being deleted" notice.
```
**Ruled out.** The retirement is platform-wide across the whole Open Data Community, not scoped to the one `ride-austin` org account — every uploader's copy is gone the same way.

## 5. Other Kaggle uploads

```
$ kaggle datasets list -s rideaustin
mexwell/rideaustin-data                                   24238939 bytes  (already downloaded — see top of this file: 1 CSV, 911,057 rows, 29 cols, no driver_id)
thedevastator/austin-hourly-and-daily-weather-2016-2017    8248154 bytes  (weather only, unrelated)

$ kaggle datasets list -s "ride austin"
[same two, plus unrelated: historical-hourly-weather-data, leadforge-lead-scoring x3, google-capstone-project-cyclistic]

$ kaggle datasets list -s "austin rideshare"
mexwell/rideaustin-data   [only hit]

$ kaggle datasets list -s "ride-austin"
[same set as "ride austin" search]

$ kaggle datasets list -s "rideaustin trips"
No datasets found
```
**Ruled out.** Every search variant surfaces the same single relevant dataset (`mexwell/rideaustin-data`, already fully documented above — 29 columns, no driver ID) plus unrelated weather/other datasets. No second Kaggle upload with `driver_id`/60 columns exists under any of these search terms.

## 6. Zenodo, Figshare, Harvard Dataverse, ICPSR

```
$ curl -L "https://zenodo.org/api/records/?q=rideaustin&size=10"
{"hits": {"hits": [], "total": 0}, ...}
```
**Zenodo: 0 hits. Ruled out.**

```
$ curl -X POST "https://api.figshare.com/v2/articles/search" -d '{"search_for":"rideaustin"}'
[only unrelated hits: individual figures/supplementary files from a road-safety paper
 ("Associating ridesourcing with road safety outcomes: Insights from Austin, Texas"),
 not the raw trip dataset]
```
**Figshare: ruled out** — nothing matching a raw trip-level file with driver IDs.

```
$ curl "https://dataverse.harvard.edu/api/search?q=rideaustin"
{"status":"OK","data":{"total_count":1,"items":[{"name":"Shared mobility services and their
  connection to roadway fatalities [R13]", "global_id":"doi:10.15139/S3/WDBAHJ", ...
  "description":"We use RideAustin OD trips to examine the effect of ridesourcing exposure
  on road safety outcomes, such as road crashes, injuries, fatalities, and DWI offenses..."}]}}

$ curl "https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.15139/S3/WDBAHJ"
{"status":"ERROR","message":"User :guest is not permitted to perform requested action."}
```
**Harvard Dataverse: one hit, but not confirmed as a match, and I could not check its files.** The one result found is a *derived research dataset* about road-safety outcomes (crashes/injuries/DWI), built using RideAustin trips as an input — by its own description, not a repackaging of the raw `Rides_DataA/B` schema. Its file listing requires a Dataverse login I don't have (`guest` was rejected outright), so I could not confirm or rule out whether it happens to include a raw trip file with `driver_id`. I did not create an account to check, since the dataset's stated purpose (crash/safety outcome modeling) doesn't match what you're looking for closely enough to justify guessing — flagging it in case you want to pursue it yourself: https://doi.org/10.15139/S3/WDBAHJ

```
$ curl -i "https://www.icpsr.umich.edu/web/pages/ICPSR/index.html?q=rideaustin"
HTTP/1.1 403 Forbidden   (blocked, same as GitHub — cannot verify directly)
```
**ICPSR: not checked — blocked.** Web search for "RideAustin ICPSR dataset trip level driver" returned no ICPSR listing, but I could not query ICPSR's own search directly to confirm a true negative.

## Bottom line

**I did not find a working copy of `Rides_DataA.csv`/`Rides_DataB.csv`, or any file with a `driver_id` column, anywhere I could actually verify.** Nothing to download or report a column list for — the instruction to report columns/row count immediately upon finding a `driver_id` file doesn't apply, because no such file turned up.

What's genuinely ruled out (checked directly, confirmed absent or dead): all four named GitHub repos (2 have no raw data at all, 1 doesn't exist, and the parent repo has no forks), every Kaggle search variant tried, Zenodo, Figshare, and all data.world uploads of this dataset (platform-wide retirement, not one account).

What's unresolved because this environment's network access blocked the check, not because I found evidence it's unavailable: the Wayback Machine snapshot of the data.world page (`web.archive.org` and its CDX API are both unreachable from here), `archive.ph` (connection reset), ICPSR's own search (403), and the one Harvard Dataverse hit's actual file contents (needs a login). If you can check the Wayback Machine link above from your own browser, or you have institutional access to ICPSR/Dataverse, those are the three remaining leads worth you personally chasing — I've exhausted what I can verify from here.

---

# Addendum 3: INFORMS replication package and SSRN check

**Bottom line up front: I could not download or view any supplemental/replication content from either source.** Both sites blocked direct access; I'm reporting that plainly rather than guessing at what's behind the block.

## INFORMS PubsOnline article page

Confirmed the article page exists:
```
DOI: 10.1287/mnsc.2021.4058
URL: https://pubsonline.informs.org/doi/10.1287/mnsc.2021.4058
Journal: Management Science, Vol. 68, Issue 5, pp. 3219-3235
Published online: August 9, 2021
```

A direct `curl` to this domain (even with a browser User-Agent) is bot-blocked outright:
```
$ curl -A "Mozilla/5.0 ..." -L https://pubsonline.informs.org/doi/10.1287/mnsc.2021.4058
HTTP_STATUS:403
```

A fetch through the WebFetch tool (which renders/converts the page rather than raw `curl`) **did** load the article page, and confirmed a supplemental-material link exists:
```
Anchor tag href: /doi/suppl/10.1287/mnsc.2021.4058
Visible link text: "Supplemental Material"
```
So INFORMS's own page says supplemental material exists for this article. But following that exact link — `https://pubsonline.informs.org/doi/suppl/10.1287/mnsc.2021.4058` — did not surface any actual file list, PDF, dataset, or code archive. Every fetch of it (three attempts, with prompts specifically asking for raw HTML, embedded JSON, and any `.pdf`/`.zip`/`.csv`/`suppl_file`/`downloadSupplement` strings) returned only the generic INFORMS PubsOnline site shell — nav menus, login prompts, footer contact info — with **no matching strings found**:
```
"No files with extensions (.zip, .pdf, .csv, .r, .py) are present on this page."
"Result: No matching strings found." [searching for suppl_file, .pdf, .zip, .csv, .sm1, .sm2, downloadSupplement]
```

**I don't know why** — it's one of two things I can't distinguish from here: (a) the actual file list is loaded by JavaScript after page load, which the fetch tool doesn't execute, or (b) the supplement requires an authenticated/subscriber session and silently falls back to the generic shell instead of a clear paywall message. Either way, **nothing was ever exposed to me to download**, so I downloaded nothing. I can't report whether the replication package contains data files, code, or both — I never got to see its contents.

## SSRN (abstract_id=3390346)

**Completely inaccessible.** Every attempt returned HTTP 403:
```
$ curl -A "Mozilla/5.0 ..." -L https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3390346
HTTP_STATUS:403

WebFetch https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3390346 → HTTP 403 Forbidden
WebFetch https://ssrn.com/abstract=3390346 → HTTP 403 Forbidden
```
I could not load the SSRN page at all — not the abstract, not a file list, nothing. This is a hard block (SSRN is known to bot-block automated/non-browser traffic aggressively), not a finding that SSRN lacks supplementary files. I have no information about what, if anything, is attached to the SSRN version.

## What this means for your two questions

- **Does the replication package contain data files or only code?** Unknown — I never got to see its contents on either site.
- **Is there a file with `driver_id`/`active_driver_id`?** Unknown, for the same reason — nothing was downloadable through my access, so there's nothing to report a column list or row count for.

**This needs a human with a browser** (and ideally institutional/INFORMS-subscriber access, since Management Science articles are often paywalled beyond the abstract) to actually open `https://pubsonline.informs.org/doi/suppl/10.1287/mnsc.2021.4058` and `https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3390346` and see what's there. If you can get either page to load and either send me the resulting file(s)/URLs or paste what you see, I can pick up the analysis (row count, full column list, driver ID check) from there.

---

# Addendum 4: RideAustin statistics reported in the arXiv preprint

Downloaded both PDFs successfully — no paywall on either:
```
$ curl -L -o driver_surge_pricing_arxiv.pdf https://arxiv.org/pdf/1905.07544
HTTP_STATUS:200   (2,090,009 bytes)

$ curl -L -o nsf_fulltext.pdf https://par.nsf.gov/servlets/purl/10311967
HTTP_STATUS:200   (2,100,895 bytes, found via <meta name="citation_pdf_url"> on https://par.nsf.gov/biblio/10311967)

$ pdftotext -layout {file}.pdf {file}.txt   # both files, then:
$ diff arxiv.txt nsf.txt
[0 lines of output — identical text content]
```
Both sources are the **same manuscript, byte-for-byte identical text** once extracted (67 pages each). Everything below applies to both. Page numbers cited are actual PDF page numbers (verified by splitting on form-feed characters, not estimated).

The empirical RideAustin section is §6 ("Empirical Comparison of Surge Mechanisms," starting p. 18) plus Appendix B ("Supplementary empirical information," pp. 31–39). The paper has **no numbered tables** — all statistics appear either inline in the text or as figure captions/discussion. I checked (`grep "^Table"` — zero matches).

## Number of drivers, shifts, trips

The paper reports counts **only for its restricted analysis window** (Feb 16 – Apr 10, 2017), not for the full RideAustin dataset (June 2016 – Apr 2017) it says it draws from:

> "We analyze 503,383 completed trips by 3811 drivers." (p. 19)

Appendix B.2.1 ("Pre-processing," p. 37) itemizes how that number is reached:
- 509,823 raw trip rows in the analysis period
- 4,626 discarded (duration > 1 hour or < 30 seconds)
- 3,780 discarded (distance > 100 miles or < 0.25 miles; "some overlap" with the duration-based discards)
- 26 more excluded from fare-calibration only (erroneous total fare)
- Net: **503,383 trips** — consistent with the main text's "6440 such trips were discarded" (p. 19): 509,823 − 503,383 = 6,440 exactly.

**No shift/session count is reported anywhere** — no total number of shifts, no shifts-per-driver figure. The paper never states how many shifts exist in the data.

## Shift length distribution

**Not reported as a distribution.** The paper defines shift length (see below) and uses it only as a *weighting variable* for one histogram (Figure 12, per-hour earnings) — there is no histogram, mean, median, or percentile of shift length itself anywhere in the paper.

## Trips per shift

**Not reported as a distribution or number**, with one narrow exception: Figure 9e is restricted to "each driver session that has at least 5 trips" (p. 32) as a filter criterion for that one figure — but the paper never reports what fraction of sessions meet that bar, nor any mean/median/distribution of trips-per-shift.

## Proportion of shift spent on a trip (utilization)

**Not computed for RideAustin data.** "Utilization rate" appears several times, but only as a theoretical/model term in the introduction and the model appendix (e.g. p. 8, discussing incentive-compatibility theory) — never as a number calculated from the empirical RideAustin dataset. The paper explicitly does not measure shift-level utilization.

The closest empirical number is a **different, trip-level** metric — don't conflate the two — from Figure 10e (p. 34):

> "Note that this time is substantial in the RideAustin data, on average about 30%."

This is the fraction of a single job's total time that is the unpaid drive-to-rider portion (dispatch → pickup, vs. pickup → drop-off), not the fraction of a whole shift spent on trips at all. It says nothing about time between trips or time waiting for a request.

## Idle time, dispatch time, cancellations

- **Idle time**: not reported. The paper is explicit about why — it states directly (p. 20) that it cannot observe when a driver was idle/available: "we do not observe drivers being open to receive a request, unless they actually received a trip request." This is stated again in Appendix B.1.1 (p. 34) as a reason a related theoretical claim can't be tested empirically.
- **Dispatch time**: used only as a *timestamp/measurement anchor* (e.g. Figure 17, p. 39, re-runs an earnings calculation starting from dispatch time instead of trip-start time, as a robustness check), never reported as a duration statistic (no mean/median time-to-dispatch, no distribution).
- **Cancellations**: no cancellation statistic anywhere. The only use of "cancel" in the whole paper (p. 9) is one sentence of general/theoretical discussion about driver behavior in ride-hailing markets broadly ("Some drivers call ahead to find out the rider's destination or even cancel the trip at the pick-up location...") — it is not a RideAustin-derived number, and the paper doesn't cite one.

## How "shift"/"session" is defined

Two different operational definitions appear, both used to identify which trips belong together as one shift, on p. 36 (§B.1.3, "Driver earnings variance"):

> "we calculate statistics regarding the average amount drivers earn during a single driving 'shift,' ideally defined as the time between which drivers turn on their app and when they turn it off. To group trips together into a single driver shift, we use a data column called active driver ID, which is a refinement of driver ID and seems to correspond to a shift as defined internally by RideAustin."
>
> "The 'length' of a shift is defined as the time between the first time the driver was dispatched for a trip during the shift, and the end time of the last completed trip during the shift. Note that this value is an underestimate of the true shift length, as it does not contain the time it took to receive the first trip request or the time it takes for the driver to go home after their last trip. Thus, our estimated shift per hour earnings are biased upwards."

So: shifts are grouped by the `active_driver_id` column (which the authors say they believe corresponds to RideAustin's own internal shift concept, but note this is inferred — "seems to correspond to," not confirmed by RideAustin documentation), and shift *length* = first-dispatch-time to last-completed-trip-end-time, which the authors themselves flag as an underestimate.

A second, separate definition of a session boundary appears earlier (p. 20, describing the driver-matching procedure), used only to decide whether a driver is still available for matching purposes, not to define shift length:

> a driver is excluded from matching if they "ended their session (did not start any trip in the next hour)"

This is a 1-hour no-further-trip gap rule — a different, narrower notion than the `active_driver_id`-based shift grouping used for the earnings-variance analysis.

## Other RideAustin numbers reported (not asked for, but relevant context)

- Surge factor: mean 1.19; 70% of trips have surge factor 1 (unsurged); increments of 0.25 between 1 and 5; "more than 97% of surged trips have a surge factor in (1, 3]" (Figure 9a, p. 32)
- Trip length distribution (non-surge): "a Weibull distribution with shape 2.6 best fits the data" (p. 35, discussing Figure 10b)
- Per-hour shift earnings (weighted by shift length, Figure 12, p. 36): mean ≈ $32.22; standard deviation $16.97 (status quo fare) vs. $15.83 (simulated additive surge with base fare); in a separate pure-surge-only simulation, $16.59 (additive) vs. $18.35 (multiplicative)

## Bottom line

The paper reports **driver and trip counts** for its analysis window (3,811 drivers, 503,383 trips) and a precise **operational definition of a shift** (via `active_driver_id`, bounded by first-dispatch-to-last-trip-end), but does **not** report a shift-length distribution, a trips-per-shift distribution, shift-level utilization, idle time, dispatch-time duration, or any cancellation statistic. Where the paper is silent, I'm reporting it as silent rather than filling the gap — the "30% unpaid time" figure that superficially resembles a utilization number is a trip-level metric (unpaid drive-to-pickup share of one job), not the shift-level "time on trip ÷ shift span" metric you asked about.

---

# Addendum 5: driver-reconstruction method from a different paper (arXiv 2502.08893)

This is a **different paper** — "Uncovering Disparities in Rideshare Drivers' Earning and Work Patterns: A Case Study of Chicago" — using the Chicago Trip Network Provider dataset, not RideAustin. It's relevant here because it solves exactly the problem this whole investigation has been stuck on: reconstructing driver-level work patterns from a trip-level dataset **with no driver ID at all**.

```
$ curl -L -o paper.html https://arxiv.org/html/2502.08893v1
HTTP_STATUS:200   (no paywall)
```

## Why they had to do this (the problem, in their words)

They state plainly that the Chicago dataset has the same gap as RideAustin's Kaggle file:

> "the Chicago ride-sharing dataset, similar to many other datasets in this domain, does not associate trips with either drivers or passengers... This prevents us from estimating drivers' total earnings and work hours, which is necessary for studying biases, fairness among driver groups."

## The method: spatiotemporal feasibility between consecutive trips, not travel-time estimation

Yes, they use feasibility between consecutive trips — but it's worth being precise about what they did **not** do: they never estimate travel time as its own quantity (no routing engine, no haversine-distance/speed model, no "time to drive from drop-off to next pickup" calculation — I grepped for `speed`, `haversine`, `routing`, `OSRM`, `Google Maps` and none of those appear as part of the method). Instead, they substitute two independent fixed thresholds as a joint proxy for "this could plausibly be the same driver":

> "Our algorithm works under one assumption—if a driver takes a new trip after finishing a previous one, it is likely that the second trip's pickup location is close to the first one's drop-off location (spatial constraint), and the second trip starts shortly after the first one (temporal constraint)."

The two constraints, stated precisely:
1. **Temporal constraint**: "The new trip's start time must be after the current trip's end time but within a threshold α (e.g., 15 minutes)."
2. **Spatial constraint**: "The distance between the current trip's drop-off location and the next trip's pickup location must be less than a specified threshold max_distance."
3. **Driver constraint** (a third rule, bounding the whole route, not a per-trip feasibility check): "Each driver is assumed to work for no more than 8 hours per day or a maximum of 25 trips, whichever is reached first."

Parameter values actually used: "we set the time threshold α=0.25 (hour) and maximum distance maxDist = 1 (mile)."

**Algorithm 1** (their pseudocode, summarized — not reproduced verbatim line-by-line): pick a random unassigned trip as the seed for a new hypothetical driver's route; repeatedly look for unassigned trips whose start time falls in `[currentTrip.endTime, currentTrip.endTime + α]` **and** whose pickup is within `maxDist` of the current trip's drop-off; if any such candidates exist, randomly pick one of the "top feasible candidates" and append it, continuing until no candidate remains or the 8-hour/25-trip cap is hit; then start a new hypothetical driver with the next unassigned trip. Repeat until every trip is assigned to some hypothetical driver.

Two more assumptions baked into the earnings/hours estimates downstream:
- **No driver-earnings field exists in the data at all** (this is a fare-only dataset, like the RideAustin Kaggle file's lack of a driver payment column): "the Chicago dataset does not contain driver earning information but just trip cost for passengers. We use the trip total as a reasonable proxy to estimate driver earning."
- **No wait/idle-time field exists either**, so they impute a flat constant rather than measuring it: "Since the dataset lacks detailed wait-time information, we apply a 0.25-hour wait time to all trips to approximate the real work hours." (Same 15-minute figure as α, applied for a different purpose — added padding to every trip's duration to approximate the driver's actual elapsed work time, not the between-trip matching threshold.)

## Validation: against what, and how much

This is the part worth reading closely, because it's a real limitation, not a formality. They validate only **indirectly**, and say so themselves:

> "The t-SNE visualizations in Appendix A illustrate the spatial distribution of these cluster groups, validating both our simulation methodology and clustering approach."

That's it for direct validation — a qualitative visual check that the resulting clusters look spatially sensible, not a comparison against any independent ground truth. They are explicit that no ground truth exists to validate against:

> "While our approach provides valuable insights and matches previous empirical findings, the lack of direct ground truth data means we rely on approximations. We need alternative data sources to cross-verify our inferred driver activities."

And again, in the numbered limitations:

> "while our simulation model effectively assign trips to hypothetical drivers and return meaningful insights, it lacks a robust evaluation framework due to the absence of ground-truth data. To validate the findings, we plan to conduct a large-scale qualitative study of driver groups in Chicago."

So: no held-out real driver IDs, no comparison dataset, no accuracy/precision number for the reconstruction itself. The closest thing to validation is that the reconstructed clusters' patterns qualitatively "match previous empirical findings" from other studies, plus that t-SNE plot. They propose fixing this in future work — a "large-scale qualitative study" and, notably, they call for the field in general to build proper benchmarks: "we encourage the development of benchmarks and more quantitative studies to better assess simulation approaches for this type of problem" — i.e., as of this paper, no such benchmark exists, including for their own method.

## What they explicitly say it can't do

Stated directly in Section 6 ("Limitations and Future Work"), split into two groups by the paper's own framing — limitations of the raw dataset, and limitations of the simulation method itself:

- **No ground truth to check against** (quoted above) — the core limitation of the whole approach.
- **Earnings are a proxy, not real earnings**: "we estimated downtime between trips and assumed that drivers' earnings equaled the trip costs paid by passengers. However, this does not fully capture drivers' actual earnings, as it removes platform fees."
- **Can't scale beyond a small sample**: "due to computational constraints, we limited our analysis to weekly patterns in 2019 and 2023" — one week per year, not the full multi-year dataset, "due to computational constraints" of running the assignment algorithm.
- Randomness is baked into the algorithm itself (two different "randomly pick" steps — seed trip selection, and choice among tied feasible candidates), meaning **the reconstruction is not deterministic** — rerunning it on the same data would not necessarily produce the same hypothetical drivers. The paper does not report run-to-run stability/variance of the resulting clusters.
- Implicitly: the entire method identifies *hypothetical* drivers, not real ones — the paper is careful throughout to call the output "hypothetical drivers" / hypothetical driver routes, never claiming the reconstruction recovers actual driver identities, only plausible ones consistent with the spatiotemporal constraints.

## Direct relevance to the RideAustin question this investigation started from

This paper is a working example of the exact class of technique you'd need to apply to the Kaggle `mexwell/rideaustin-data` file (which, per Addendum 1 above, has no driver ID either) to approximate driver-day spans without a real driver key. But per their own limitations section, the output would be a **plausible reconstruction with no ground-truth validation available**, not a substitute for a real `driver_id` column — worth weighing against the earlier finding that RideAustin's own original CSVs (`Rides_DataA.csv`/`Rides_DataB.csv`, confirmed by the `driver_surge_rideaustin` code review in Addendum 1) *did* have a real `driver_id`/`active_driver_id`, making a from-scratch reconstruction a fallback of last resort, not a first choice, if either of those raw files ever resurfaces.

---

# Addendum 6: Forced-structure analysis on the RideAustin trips

**Headline result up front: under the feasibility rule exactly as specified (no bound on idle time between trips), every single trip in the 7-day window has 2 or more feasible predecessors and 2 or more feasible successors. Zero zero-predecessor trips. Zero zero-successor trips. Zero forced links. Zero forced chains. This holds identically across all 6 settings tested (2 coordinate floors × 3 speed multipliers) — it is not a bug or a computational shortfall, and I proved it by hand below.** The concurrency-floor computation (which doesn't depend on the feasibility rule at all) still works and is reported in full.

## 0. A blocking discrepancy I flagged before running anything

You said coordinates are truncated to 3 decimals (~100m). I checked empirically before trusting that:
```python
def decimals(x):
    s = f"{x:.10f}".rstrip('0')
    return len(s.split('.')[1]) if '.' in s else 0
for col in ["start_location_lat","start_location_long","end_location_lat","end_location_long"]:
    print(col, df[col].dropna().sample(200000, random_state=1).apply(decimals).value_counts().sort_index().to_dict())
```
```
start_location_lat  decimal-place distribution: {0: 3, 1: 20724, 2: 179273}
start_location_long decimal-place distribution: {0: 31, 1: 7138, 2: 192831}
end_location_lat    decimal-place distribution: {0: 10, 1: 23637, 2: 176353}
end_location_long   decimal-place distribution: {0: 62, 1: 6830, 2: 193108}
```
**Zero rows have 3+ decimal places.** The real grid is 2 decimals (~1.1km), not 3 (~100m). I asked you how to handle this; you said run both, treat the 1.1km floor as the reliable number and the 100m floor as the upper bound. That's what's below.

**Exact grid size, computed from this data's actual mean latitude (30.27573°N), not assumed:**
```
km per 0.01° latitude:  1.1132 km
km per 0.01° longitude: 0.9614 km
max rounding error (diagonal of one 0.01°x0.01° cell): 1.4709 km
```

## 1. Is deadhead distance measurable at 1.1km resolution, or is it noise? (your direct question)

I computed this before building anything else: for every trip in the core week, the haversine distance to whichever trip most recently completed anywhere in the city before it started (the "nearest-in-time candidate," not a proven driver match — just the natural baseline for "how far is the nearest possible handoff").
```python
pos = np.searchsorted(A_completed_sorted, B.started_on, side="right") - 1
# nearest-completed A found for every one of 41,084 core-week trips (0 unmatched)
```
```
deadhead distance to nearest-in-time predecessor (km), n=41,084:
  min=0.00   10%=1.11   25%=2.42   median=5.29   75%=10.41   90%=16.36   max=119.63   mean=7.41

gap to that same nearest-in-time predecessor (hours), n=41,084:
  min=0.000  10%=0.000  25%=0.0006  median=0.0017 (~6 sec)  75%=0.0047  90%=0.010  mean=0.0041

fraction of these deadhead distances below the 100m floor: 3.23%
fraction of these deadhead distances below the 1.1km floor: 6.79%
```
**Answer: mostly measurable, not mostly noise — but with a real, non-trivial exception.** At the median, the nearest-available dropoff-to-pickup distance is 5.29km, more than 3x the 1.47km worst-case grid error — clearly a real, meaningful distance, not rounding noise. But at the bottom of the distribution, ~7% of these pairings fall entirely inside the ~1.1–1.47km noise floor, and another chunk between the 10th and 25th percentile (1.11–2.42km) sits close enough to the grid size that the floor choice materially changes whether they read as "adjacent" or "far." So: for most trips, deadhead distance is a real signal; for roughly the closest 10th of pairings, it isn't distinguishable from rounding, which is exactly why the 100m-vs-1.1km floor choice matters and why I ran both.

Also notable, independent of the floor question: the *time* gap to the nearest-in-time candidate is almost always under a few seconds (median ~6 sec) — because ~41,000 trips/week citywide means something is always completing somewhere at almost every instant. That near-simultaneity is exactly why distance has to do the filtering work in this feasibility rule; time alone can't.

## 2. Median effective speed by hour of day (reported before doing anything else, as required)

Computed from the **full dataset** (911,057 rows, all months), duration = completed_on − started_on, distance = haversine(start, end) with the stated floor applied, speed = distance/duration. First dropped 17 rows with duration ≤ 0 (completed_on at or before started_on — a data error, not a modeling choice: negative/zero elapsed time makes speed undefined, so these can't be assigned a value rather than excluded).
```
Dropped 17 rows with duration<=0 (data error: completed_on <= started_on). 911057 -> 911040
```

| hour | n_trips | median speed km/h (100m floor) | frac dist=0 (100m) | median speed km/h (1.1km floor) | frac dist=0 (1.1km) |
|---|---|---|---|---|---|
|0|57545|20.634|0.030|20.568|0.074|
|1|60262|21.753|0.032|21.638|0.080|
|2|59499|22.459|0.034|22.361|0.081|
|3|64750|22.424|0.033|22.321|0.081|
|4|68448|22.644|0.036|22.514|0.085|
|5|61168|22.845|0.039|22.695|0.092|
|6|50600|23.761|0.042|23.634|0.092|
|7|43139|24.032|0.048|23.899|0.090|
|8|27884|24.838|0.050|24.704|0.091|
|9|10628|30.001|0.045|29.907|0.084|
|10|8582|36.936|0.027|36.916|0.051|
|11|8677|37.361|0.019|37.353|0.034|
|12|11965|31.212|0.023|31.118|0.052|
|13|18903|25.143|0.022|25.068|0.064|
|14|26421|24.796|0.022|24.719|0.069|
|15|28863|26.586|0.024|26.545|0.065|
|16|31406|26.226|0.023|26.182|0.063|
|17|33497|24.384|0.028|24.314|0.069|
|18|34902|23.059|0.028|22.990|0.069|
|19|35316|22.933|0.026|22.840|0.067|
|20|36861|22.528|0.027|22.422|0.064|
|21|39532|21.766|0.024|21.706|0.060|
|22|43152|20.306|0.026|20.228|0.063|
|23|49040|19.835|0.028|19.775|0.070|

No hour has a degenerate (all-zero or median-zero) speed — the "zero distance" fraction stays in the 2–9% range everywhere, so the speed model itself isn't broken by the floor choice. Note the sharp trip-count drop and speed jump at hours 9–11 (8,582–10,628 trips vs 27,000–68,000 elsewhere) — a real, reported pattern in the raw data, not something I'm explaining away; I'm not speculating on its cause since that's outside this task.

## 3. Week selection: 7 consecutive normal days

Checked daily trip counts across the full range to avoid picking a distorted week:
```
$ df.groupby(started_on.dt.date).size()  # full range: count=249 days, mean=3659/day, min=7, max=14182
```
The data (Jun 4, 2016 – Feb 7, 2017) never overlaps SXSW (mid-March) — it isn't in range at all. I checked Nov 2016 and Sep 2016 daily counts directly and found the same recurring pattern in both: **weekday counts run ~1,200–4,700/day, weekend (Fri night–Sun) counts run 5,600–14,000+/day, consistently, in both months** — a routine weekly cycle for this platform, not a one-off event. I chose **Nov 14 (Mon) – Nov 20 (Sun), 2016** as the core week (with Nov 13 and Nov 21 loaded as a 1-day buffer on each side, purely to supply candidate trips near the boundary so the reporting week's edge trips aren't artificially starved of predecessors/successors — buffer-day trips are never themselves reported on). This week avoids Thanksgiving (Nov 24) and Election Day (Nov 8); I found no record of a major one-off Austin event that week.
```
core week daily counts: 3698, 3188, 3325, 3765, 6628, 10570, 9910  (Mon..Sun)
buffered window (9 days, Nov13-21): 54,336 trips
core window (7 days, Nov14-20):     41,084 trips
```
Data-quality check on this window before proceeding: duration >2h: 11 trips (max 6.27h — nowhere near the 126.6h max seen in the full dataset); haversine start→end distance >100km: 11 trips (max 302km, plausible as real long trips, not obviously corrupted — not dropped, since I'm not filtering on an unstated threshold, just flagging them as present).

## 4. Feasibility computation — method, and proof of exactness

Implemented exactly as specified:
```
A can precede B  iff  B.started_on >= A.completed_on
                 and  A.completed_on + max(haversine(A.end,B.start)-floor, 0)/speed(hour of A.completed_on) <= B.started_on
```
For each trip, I classify predecessor count as 0, 1, or "≥2" (not the exact count — not needed for this task, and capping the search early is what makes it exact-and-fast rather than a heuristic): scan candidates in the 9-day buffered window backward from the trip's start time, nearest-completed-first, checking the inequality against each; stop the moment a 2nd satisfying candidate is found (classification is already "≥2" and can't change), otherwise scan every candidate back to the buffer boundary. This is exact — every candidate that could matter is actually checked in order until the answer is determined — not an approximation. Symmetric forward scan for successor count. Ran on the full 54,336-trip buffered window, all 6 (floor × multiplier) combinations:
```
[floor1p1_mult1.0]  n=54336  elapsed=40.2s   mean_scan_pred=42.8  max_scan_pred=1079   mean_scan_succ=44.5  max_scan_succ=2742
[floor1p1_mult0.7]  n=54336  elapsed=49.6s   mean_scan_pred=53.1  max_scan_pred=1504   mean_scan_succ=55.3  max_scan_succ=3610
[floor1p1_mult1.3]  n=54336  elapsed=33.6s   mean_scan_pred=36.6  max_scan_pred=843    mean_scan_succ=38.0  max_scan_succ=2106
[floor100m_mult1.0] n=54336  elapsed=44.3s   mean_scan_pred=46.8  max_scan_pred=1079   mean_scan_succ=48.6  max_scan_succ=2742
[floor100m_mult0.7] n=54336  elapsed=50.0s   mean_scan_pred=59.2  max_scan_pred=1504   mean_scan_succ=61.3  max_scan_succ=3610
[floor100m_mult1.3] n=54336  elapsed=34.0s   mean_scan_pred=39.5  max_scan_pred=843    mean_scan_succ=41.1  max_scan_succ=2106
```
**Graph size was never a problem** — every run completed in under a minute with an exact scan, no heuristic pruning, no sampling. Reporting this per your rule: I'm stating the size (54,336 nodes, worst-case scan 3,610 candidates) rather than claiming I had to approximate, because I didn't.

## 5. Zero-predecessor, zero-successor, forced links — the result, and proof it's real

```
=== floor1p1_mult1.0: core week n=41084 ===
pred_count distribution: {2: 41084}
succ_count distribution: {2: 41084}
zero-predecessor: 0 (0.00%)
zero-successor:   0 (0.00%)
forced links (pred_count==1): 0 (0.00%)
```
This is not one lucky/broken setting — **all 6 combinations gave the identical result:**
```
floor1p1_mult1.0       zero_pred=0  zero_succ=0  forced_links=0
floor1p1_mult0.7       zero_pred=0  zero_succ=0  forced_links=0
floor1p1_mult1.3       zero_pred=0  zero_succ=0  forced_links=0
floor100m_mult1.0      zero_pred=0  zero_succ=0  forced_links=0
floor100m_mult0.7      zero_pred=0  zero_succ=0  forced_links=0
floor100m_mult1.3      zero_pred=0  zero_succ=0  forced_links=0
```
I did not trust this on sight — I hand-verified it against the very first trip of the core week, the case most likely to be a genuine zero-predecessor (start of the reporting window):
```
B: started_on=2016-11-14 00:00:01, completed_on=2016-11-14 00:17:18, start=(30.22, -97.77)
candidates available (completed_on <= B.started_on) in the buffered window: 9,483
earliest available candidate completed_on: 2016-11-13 00:01:06  (gap ≈ 23.98 hours)

manual check of one candidate A, ~8 hours before B:
  A.completed_on=2016-11-13 15:59:59, A.end=(30.31,-97.69)
  gap_h=8.001   hour_of_A=15   speed=26.55 km/h   required_bound = 26.55*8.001 = 212.37 km
  actual deadhead = 12.62 km   -->  12.62 <= 212.37  -->  FEASIBLE
```
**This is the real mechanism, not a bug: the inequality rearranges to `deadhead_distance <= speed(hour_A) * gap`. Since the gap is completely unbounded (per your instruction: no shift-length cap), the right-hand side grows without limit as the candidate gets older, and any real Austin-metro distance is eventually dwarfed by it — typically within 1–3 hours at these speeds.** With thousands of trips completing somewhere in the city every day, essentially every trip in the window has *some* earlier-completed trip old enough that the reachability radius has grown past its actual distance — even a trip idling 24 hours "counts" as a feasible predecessor under this rule, because nothing in the stated formula penalizes waiting. The only trips that could ever be genuine zero-predecessor cases are ones with literally no completed trip anywhere before them in the loaded window — which none of the core week's trips are, because the buffer day supplies thousands of technically-eligible (if economically absurd) candidates.

**Consequence: forced links and forced chains do not exist in this dataset under this exact rule — at any of the 6 settings tested.** There is nothing to list per-day, no deadhead/idle-gap pairs to report, and no chain-length distribution to compute, because the set is empty by construction, not by data sparsity.

## 6. Forced chains

**None exist**, directly following from §5 (forced chains are built only from forced links, and there are zero forced links at every one of the 6 settings). No length distribution, span, or on-trip fraction to report — this is a hard empty-set result, not a "the file doesn't determine this" gap.

## 7. Concurrent trips by hour — the certain floor (unaffected by the feasibility rule)

This doesn't depend on the speed model or the floor at all — it's a direct sweep-line over trip start/end intervals (a trip counts as "in progress" from started_on up to completed_on; ties at an exact boundary instant are resolved as non-overlapping, the standard interval-scheduling convention). Peak concurrency per calendar day, core week:
```
2016-11-14   88
2016-11-15  101
2016-11-16  108
2016-11-17  104
2016-11-18  156
2016-11-19  223   <- Saturday night into Sunday morning
2016-11-20  199
```
Hourly floor ranges from as low as 8 (mid-morning weekday lull) up to 223 (Saturday ~4am). Full hour-by-hour table (168 hours) saved to `concurrency_by_hour.csv`, sent alongside this file.

## 8. Concurrency floor vs. zero-predecessor count

```
zero-predecessor count (all 6 settings): 0
peak concurrency floor (core week):      223
```
**These numbers tell two very different stories, and the gap between them is itself the finding.** The concurrency floor is airtight: at Saturday ~4am, 223 trips were provably in progress at the same instant, which means at least 223 distinct drivers existed at that moment — this doesn't depend on any speed or reachability assumption, just non-overlapping intervals. The zero-predecessor count, by contrast, is supposed to be a *different, independent* way of proving driver availability ("this pickup couldn't have been reached by anyone finishing a job") — but under the exact rule as specified, it proves nothing at all, anywhere, because unbounded idle-waiting makes almost every trip's "reachability" argument trivially satisfiable. So: the concurrency floor is real, sizable, and load-bearing; the zero-predecessor mechanism, as literally defined here, is not currently capable of independently corroborating it — not because the underlying driver availability isn't there (the concurrency count proves it is), but because the feasibility rule's lack of an idle-time bound makes it too permissive to ever find zero predecessors in a dataset this dense.

## 9. Sensitivity

Already shown in full in §5: all 6 combinations (both floors × all 3 multipliers, including 0.7x — the least generous case, where a lower speed shrinks the reachable radius the most) produced the identical result. **"Do the forced links survive all three?" — there are no forced links to survive, at any multiplier, at either floor. What *is* robust across all 6 settings is the absence itself**: the finding that this rule yields zero forced structure isn't a fragile edge case sensitive to the exact speed or floor chosen — it holds even under the most conservative (slowest-speed, tightest-floor) combination tested.

## Bottom line, and what would change this

Every number above is traceable either to the raw file (trip counts, coordinates, timestamps) or to the speed model derived from it (median speed by hour) — nothing was picked. The one substantive gap I'm flagging rather than filling: the feasibility rule as specified has no bound on idle time between trips, and that single property is what makes the entire forced-structure exercise (zero-predecessor, forced links, forced chains) come back empty on this dataset, regardless of coordinate-floor or speed assumptions. A bounded-idle-time variant (a maximum plausible wait, not a shift-length cap — a different, narrower assumption than the one you explicitly ruled out) would very likely produce a non-degenerate result, given how tight the *nearest-in-time* candidate distances actually are (§1: median 5.29km, near-simultaneous in time). I did not implement that on my own judgment since it's a new assumption you didn't specify — flagging it as the natural next question rather than picking a bound myself.

Files from this run (speed table, concurrency table, full per-trip classification for all 6 settings) are in the scratchpad and can be sent on request.

---

# Addendum 7: City of Toronto PTC datasets — still live, checked directly

**Both packages exist, are active, and have downloadable resources — confirmed against the raw server responses, not assumed.**

## `private-transportation-companies-summary-and-trip-data`

```
$ curl "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=private-transportation-companies-summary-and-trip-data"
HTTP_STATUS: 200
```
Key fields from the raw JSON (`result`):
```
success: true
id: fbac8e59-4883-4252-b73c-4a5caf19126d
state: active
is_retired: false
num_resources: 18
formats: [CSV, XML, JSON, ZIP, PDF]
```
All 18 listed resources, `state: active` on every one:

| name | format | url |
|---|---|---|
| trips_and_summary_readme | PDF | `.../resource/6c7e183b.../download/trips_and_summary_readme.pdf` |
| trips_sample | CSV (datastore) | `https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/8c434d44-73d1-4409-b8cf-e556c9ee41d3` |
| summary_stats | CSV (datastore) | `.../datastore/dump/782ff076-...` |
| summary_stats.csv | CSV | `.../resource/c2f8c4c8.../download/summary_stats.csv` (497,524 bytes) |
| summary_stats.xml / .json | XML/JSON | (4.4MB / 2.8MB) |
| trips_sample.csv / .xml / .json | CSV/XML/JSON | 1.28MB / 4.8MB / 3.5MB |
| trips_2018.zip … trips_2026.zip | ZIP | one per year, 27.7MB (2018) up to 55.4MB (2025), hosted at `opendata.toronto.ca/transportation.services/private-transportation-company-dev/trips/trips_YYYY.zip` |

## `private-transportation-companies-vehicle-operating-data`

```
$ curl "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=private-transportation-companies-vehicle-operating-data"
HTTP_STATUS: 200
```
```
success: true
id: 082c6a32-dcf2-43da-b4ab-8a2b9ec2e35b
state: active
is_retired: false
num_resources: 12
formats: [CSV, XML, JSON, ZIP, PDF]
```
12 resources, all `state: active`: a readme PDF, `operating_hours_sample` (datastore CSV) + `.csv`/`.xml`/`.json` static copies (1.3MB/8.0MB/5.5MB), and `operating_hours_2020.zip` through `operating_hours_2026.zip` (554MB up to 1.59GB each), same `opendata.toronto.ca/.../operating_hours/` host pattern.

Both packages' `collection_method` field states this is regulatory data PTCs must submit to the City under Toronto Municipal Code Chapter 546-116, covering trip records (pickup/dropoff, request/accept/arrival/pickup/dropoff timestamps, fare, distance, cancellation reason) and "driver availability records" (start/end time and location of a vehicle shift) — i.e., this is a live, still-collected, regulator-mandated feed, not an abandoned one-off upload.

## Downloaded and checked — actual columns and row counts

**`trips_sample.csv`** (from `summary-and-trip-data`):
```
$ curl -L -o trips_sample.csv "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/fbac8e59-4883-4252-b73c-4a5caf19126d/resource/749dec62-c305-4266-aaef-7cdf008f10e3/download/trips_sample.csv"
HTTP_STATUS:200   (1,277,107 bytes)
```
Columns (14): `_id, dt, pickup_hr, pickup_municipality, pickup_community_council, pickup_ward, dropoff_municipality, dropoff_community_council, dropoff_ward, trips_total, fare_avg, waittime_avg, distance_avg, duration_avg`
Row count: 8,134 lines total → **8,133 data rows**.

**Important finding, worth stating plainly despite the "trip data" naming**: this is not row-per-trip data. It's pre-aggregated to (date, pickup-hour, pickup-ward, dropoff-ward) buckets, with `trips_total` and averaged fare/wait/distance/duration per bucket — no individual pickup/dropoff coordinates, no trip-level timestamps, no driver or vehicle ID. I checked whether the *full* (non-sample) yearly files are actually row-per-trip, since "sample" might just mean "a sample of individual trip rows":
```
$ curl -L -o trips_2018.zip "https://opendata.toronto.ca/transportation.services/private-transportation-company-dev/trips/trips_2018.zip"
HTTP_STATUS:200   (27,745,620 bytes; unzips to 12 monthly CSVs, trips_201801.csv..trips_201812.csv, 319,106,871 bytes total)

$ unzip -p trips_2018.zip trips_201801.csv | head -1
dt,pickup_hr,pickup_municipality,pickup_community_council,pickup_ward,dropoff_municipality,dropoff_community_council,dropoff_ward,trips_total,fare_avg,distance_avg,waittime_avg,duration_avg
$ wc -l trips_201801.csv
154508
```
**Same schema (minus the datastore `_id` column) — the full yearly files are aggregated the identical way**, just with more (date, hour, ward-pair) buckets: January 2018 alone has 154,507 data rows of ward/hour aggregates. So "trip data" in this package's name means aggregated trip *statistics*, not individual trip records, at both the sample and full-file level — confirmed by actually opening the full file, not inferred from the sample alone.

**`operating_hours_sample.csv`** (from `vehicle-operating-data`):
```
$ curl -L -o operating_hours_sample.csv "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/082c6a32-dcf2-43da-b4ab-8a2b9ec2e35b/resource/ed5ed874-3a55-434f-b0a0-3dbbc29e637c/download/operating_hours_sample.csv"
HTTP_STATUS:200   (1,343,730 bytes)
```
Columns (20): `_id, vehid, hr, reported_trips_started, reported_trip_fractions, pooled_trips_started, pooled_trip_fractions, routed_trips_started, driver_cancelled_trips, passenger_cancelled_trips, toronto_boundary_crossed, fares, time_available, time_enroute, time_waiting, time_ontrip, dist_available_routed, dist_enroute_routed, dist_ontrip_routed, dist_ontrip_reported`
Row count: 9,004 lines total → **9,003 data rows**.

**This one is materially different and more relevant to this whole investigation: it has a `vehid` column and is grouped at (vehicle, hour) granularity**, with `time_available` / `time_enroute` / `time_waiting` / `time_ontrip` reported directly per vehicle-hour — i.e., a real utilization breakdown per vehicle, already computed by the City, not something I'd have to reconstruct. I did not download a full `operating_hours_YYYY.zip` to confirm the full files carry the same `vehid`-level granularity — they're 554MB–1.59GB each, too large for a quick check here — but I did confirm one is genuinely reachable and correctly sized rather than assuming:
```
$ curl -I "https://opendata.toronto.ca/transportation.services/private-transportation-company-dev/operating_hours/operating_hours_2020.zip"
HTTP/1.1 200 OK
Content-Length: 554204428   (matches the package_show API's reported size exactly)
```

## Bottom line

Both datasets are live and downloadable — nothing here needed a Wayback Machine or a login, unlike the RideAustin/data.world situation in earlier addenda. The `summary-and-trip-data` package's "trip data" is aggregated statistics only, confirmed at both sample and full-file granularity — not usable for driver-day reconstruction. The `vehicle-operating-data` package's `vehid` + per-vehicle-hour `time_available`/`time_ontrip` breakdown is the more promising lead of the two for anything utilization-related, though I've only confirmed that schema on the *sample* file, not yet on a full year — say the word if you want me to pull and check a full `operating_hours_*.zip` despite the size.
