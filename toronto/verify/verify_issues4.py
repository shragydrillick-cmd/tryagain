"""Fourth pass: the user's question — when a value is impossible, do the
neighbouring hours and days tell us what it should have been?"""
import pandas as pd, numpy as np, glob, os

# ---------- is a vehid the same car from day to day? ----------------------
d1 = pd.read_csv("days/op_20250901.csv"); d2 = pd.read_csv("days/op_20250902.csv")
s1, s2 = set(d1.vehid), set(d2.vehid)
print("--- vehid stability ---")
print(f"   1 Sept vehicles {len(s1):,}   2 Sept {len(s2):,}   in both {len(s1&s2):,} "
      f"({100*len(s1&s2)/len(s1):.1f}% of 1 Sept)")
print(f"   a vehid seen on 1 Sept appears on {len(s1&s2)/len(s1)*100:.0f}% of the next day")

# ---------- the impossible rows: what do their neighbours look like? -------
print("\n--- 1 Sept: the 8 vehicle-hours whose ROUTED distance implies >150 km/h ---")
d1['sp'] = np.where(d1.time_ontrip > 0, d1.dist_ontrip_routed/d1.time_ontrip*60, np.nan)
bad = d1[d1.sp > 150].sort_values('sp', ascending=False)
cols = ['vehid','hr','reported_trips_started','routed_trips_started','time_ontrip',
        'dist_ontrip_routed','dist_ontrip_reported','toronto_boundary_crossed']
print(bad[cols + ['sp']].to_string(index=False,
      float_format=lambda x: f"{x:,.2f}"))
print("\n   the same vehicles' other hours that day:")
for v in bad.vehid.unique()[:8]:
    o = d1[d1.vehid == v][cols]
    print(f"   vehid {v}: {len(o)} hours, on-trip minutes "
          f"{o.time_ontrip.min():.2f}-{o.time_ontrip.max():.2f}, routed km "
          f"{o.dist_ontrip_routed.min():.1f}-{o.dist_ontrip_routed.max():.1f}")

print("\n--- 1 Sept: the vehicle-hour reporting 1,077.9 km ---")
w = d1.loc[[d1.dist_ontrip_reported.idxmax()]]
print(w[cols].to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
v = w.vehid.iloc[0]
print("   that vehicle's whole day:")
print(d1[d1.vehid == v][cols].to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
# and the days either side
for f in ["days/op_20250902.csv", "days/op_20250903.csv"]:
    dd = pd.read_csv(f)
    sub = dd[dd.vehid == v]
    if len(sub):
        print(f"   {os.path.basename(f)}: {len(sub)} hours, reported km "
              f"{sub.dist_ontrip_reported.min():.1f}-{sub.dist_ontrip_reported.max():.1f}, "
              f"total {sub.dist_ontrip_reported.sum():.1f}")
    else:
        print(f"   {os.path.basename(f)}: vehicle absent")

# ---------- the 395-minute wait cell: what do neighbouring hours say? ------
print("\n--- 1 Sept: the district pair with a 395-minute average wait ---")
t1 = pd.read_csv("days/trips_20250901.csv")
r = t1.loc[t1.waittime_avg.idxmax()]
print(f"   {r.pickup_ward}  ->  {r.dropoff_ward}   hour {r.pickup_hr}")
print(f"   {int(r.trips_total)} rides, wait {r.waittime_avg} min, "
      f"distance {r.distance_avg} km, duration {r.duration_avg} min, fare ${r.fare_avg}")
same = t1[(t1.pickup_ward == r.pickup_ward) & (t1.dropoff_ward == r.dropoff_ward)]
print(f"   the same pair in other hours of the day ({len(same)} hours): wait "
      f"{same.waittime_avg.min():.2f}-{same.waittime_avg.max():.2f} min, "
      f"median {same.waittime_avg.median():.2f}")
print(f"   city-wide that hour: median wait {t1[t1.pickup_hr==r.pickup_hr].waittime_avg.median():.2f} min")

# ---------- do neighbouring days repair it? --------------------------------
print("\n   the same pair, same hour, across all 30 days:")
vals = []
for f in sorted(glob.glob("days/trips_*.csv")):
    d = pd.read_csv(f)
    m = d[(d.pickup_ward == r.pickup_ward) & (d.dropoff_ward == r.dropoff_ward)
          & (d.pickup_hr == r.pickup_hr)]
    if len(m):
        vals.append((os.path.basename(f)[6:14], int(m.trips_total.iloc[0]),
                     float(m.waittime_avg.iloc[0])))
V = pd.DataFrame(vals, columns=['date', 'trips', 'wait'])
print(f"   present on {len(V)} of 30 days; wait median {V.wait.median():.2f}, "
      f"range {V.wait.min():.2f}-{V.wait.max():.2f}")
print(V.to_string(index=False))
