"""Fifth pass, two questions that matter more than the rest:

  (a) When a trip crosses an hour boundary, is the ROUTED DISTANCE split
      between the two hours the way the TIME is, or is it all booked to the
      hour the trip started?  The build assumes the former.

  (b) Are the absurd reported distances scattered hours, or a few broken
      vehicles?  If it is a few vehicles, they can be identified and handled
      as vehicles instead of as random noise.
"""
import pandas as pd, numpy as np, glob, os

d = pd.read_csv("days/op_20250901.csv")
d['h'] = pd.to_datetime(d.hr, utc=True).dt.tz_convert('America/Toronto').dt.hour
d = d.sort_values(['vehid', 'h'])

# ---------- (a) the hour-boundary split ------------------------------------
print("--- (a) how a trip that crosses the hour is booked ---")
# a vehicle-hour that starts a trip but records almost no on-trip time is a
# trip that began in the last seconds of the hour.
tail = d[(d.reported_trips_started >= 1) & (d.time_ontrip < 1.0) &
         (d.dist_ontrip_routed > 0.5)]
print(f"   vehicle-hours that START a trip, record <1 min on-trip, yet >0.5 km routed: {len(tail):,}")
print("   for each, what does the SAME vehicle's next hour look like?")
nxt = d.set_index(['vehid', 'h'])
shown = 0
for _, r in tail.head(6).iterrows():
    try:
        n = nxt.loc[(r.vehid, r.h + 1)]
    except KeyError:
        print(f"   veh …{r.vehid[-6:]} h{r.h:02d}: start={int(r.reported_trips_started)} "
              f"frac={r.reported_trip_fractions:.2f} t={r.time_ontrip:.2f} "
              f"routed={r.dist_ontrip_routed:.2f}  |  NO next hour")
        continue
    print(f"   veh …{r.vehid[-6:]} h{r.h:02d}: start={int(r.reported_trips_started)} "
          f"frac={r.reported_trip_fractions:.2f} t={r.time_ontrip:5.2f} routed={r.dist_ontrip_routed:6.2f} "
          f"|| h{r.h+1:02d}: start={int(n.reported_trips_started)} frac={n.reported_trip_fractions:.2f} "
          f"t={n.time_ontrip:5.2f} routed={n.dist_ontrip_routed:6.2f}")
    shown += 1

# the decisive test: fractions vs distance.  If distance were booked whole to
# the starting hour, an hour with fractions < starts would still carry full km.
d['spill'] = d.reported_trips_started - d.reported_trip_fractions
sp = d[(d.reported_trips_started > 0) & (d.spill > 0.5)]
print(f"\n   vehicle-hours that start a trip and spill >half of it into the next hour: {len(sp):,}")
print(f"   their median routed km    : {sp.dist_ontrip_routed.median():.2f}")
print(f"   their median on-trip min  : {sp.time_ontrip.median():.2f}")
ns = d[(d.reported_trips_started > 0) & (d.spill.abs() < 0.02)]
print(f"   vehicle-hours that start a trip and finish it inside the hour: {len(ns):,}")
print(f"   their median routed km    : {ns.dist_ontrip_routed.median():.2f}")
print(f"   their median on-trip min  : {ns.time_ontrip.median():.2f}")
print("   -> if spilling hours carry LESS distance and LESS time in proportion,")
print("      distance is apportioned like time, which is what the build assumes.")
for nm, g in [('spilling', sp), ('complete', ns)]:
    ok = g[g.time_ontrip > 0]
    print(f"   {nm:9s}: median km per on-trip minute = "
          f"{(ok.dist_ontrip_routed/ok.time_ontrip).median():.3f}")

# ---------- (b) broken hours or broken vehicles? ---------------------------
print("\n--- (b) the absurd reported distances ---")
rows = []
for f in sorted(glob.glob("days/op_*.csv")):
    x = pd.read_csv(f)
    t = x.time_ontrip.values.astype(float)
    sp2 = np.where(t > 0, x.dist_ontrip_reported/np.maximum(t, 1e-9)*60, np.nan)
    m = (sp2 > 150) | (x.dist_ontrip_reported > 200)
    if m.any():
        y = x[m][['vehid', 'hr', 'time_ontrip', 'dist_ontrip_routed', 'dist_ontrip_reported']]
        y = y.assign(date=os.path.basename(f)[3:11])
        rows.append(y)
BAD = pd.concat(rows) if rows else pd.DataFrame()
print(f"   offending vehicle-hours in the month : {len(BAD):,}")
print(f"   distinct vehicles involved           : {BAD.vehid.nunique():,}")
vc = BAD.vehid.value_counts()
print(f"   worst vehicle appears in             : {vc.iloc[0]} of them")
print(f"   vehicles offending more than once    : {int((vc>1).sum())}")
print(f"   share of offences from repeat vehicles: {100*vc[vc>1].sum()/len(BAD):.0f}%")
print("\n   top offending vehicles:")
for v, c in vc.head(6).items():
    sub = BAD[BAD.vehid == v]
    print(f"     …{v[-8:]}  {c:2d} bad hours over {sub.date.nunique()} days, "
          f"reported km {sub.dist_ontrip_reported.min():,.1f}-{sub.dist_ontrip_reported.max():,.1f}")
BAD.to_csv("bad_reported_rows.csv", index=False)
print(f"\n   wrote bad_reported_rows.csv ({len(BAD)} rows)")

# how much distance do they carry?
tot = 0.0
for f in sorted(glob.glob("days/op_*.csv")):
    tot += pd.read_csv(f).dist_ontrip_reported.sum()
print(f"   month reported km total              : {tot:,.0f}")
print(f"   km sitting in the offending rows     : {BAD.dist_ontrip_reported.sum():,.0f} "
      f"({100*BAD.dist_ontrip_reported.sum()/tot:.3f}%)")
