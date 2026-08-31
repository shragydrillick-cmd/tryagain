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
