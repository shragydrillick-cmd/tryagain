"""Re-measure every number that goes into the issues PDF, from the files.

Nothing here is quoted from memory. Each line prints what the file says so the
claim in the document can be checked against it.
"""
import pandas as pd, numpy as np, glob, os

OUT = {}
def say(k, v):
    OUT[k] = v
    print(f"{k:52s} {v}")

# ---------- the day files -------------------------------------------------
opf = sorted(glob.glob("days/op_*.csv"))
trf = sorted(glob.glob("days/trips_*.csv"))
say("day files (op / trips)", f"{len(opf)} / {len(trf)}")

OPC = ['vehid','hr','reported_trips_started','reported_trip_fractions',
       'pooled_trips_started','pooled_trip_fractions','routed_trips_started',
       'driver_cancelled_trips','passenger_cancelled_trips',
       'toronto_boundary_crossed','fares','time_available','time_enroute',
       'time_waiting','time_ontrip','dist_available_routed',
       'dist_enroute_routed','dist_ontrip_routed','dist_ontrip_reported']

rows = []
for f in opf:
    d = pd.read_csv(f)
    date = os.path.basename(f)[3:11]
    rows.append(dict(
        date=date, nrows=len(d), veh=d.vehid.nunique(),
        started=int(d.reported_trips_started.sum()),
        routed=int(d.routed_trips_started.sum()),
        pooled=int(d.pooled_trips_started.sum()),
        dcan=int(d.driver_cancelled_trips.sum()),
        pcan=int(d.passenger_cancelled_trips.sum()),
        dO=d.dist_ontrip_routed.sum(), dR=d.dist_ontrip_reported.sum(),
        tO=d.time_ontrip.sum(), tA=d.time_available.sum(),
        tE=d.time_enroute.sum(), tW=d.time_waiting.sum(),
        # impossible-value probes
        hi200=int((d.dist_ontrip_reported > 200).sum()),
        maxdR=d.dist_ontrip_reported.max(),
        fast150=int((d.dist_ontrip_routed > 150 * (d.time_ontrip/60.0).replace(0,np.nan)).sum()),
        zeroE=int(((d.time_enroute == 0) & (d.dist_enroute_routed > 0)).sum()),
        over60=int(((d.time_available+d.time_enroute+d.time_waiting+d.time_ontrip) > 60.0).sum()),
        maxact=(d.time_available+d.time_enroute+d.time_waiting+d.time_ontrip).max(),
        under=int((d.dist_ontrip_reported < d.dist_ontrip_routed - 1e-9).sum()),
        withdist=int((d.dist_ontrip_routed > 0).sum()),
    ))
OPS = pd.DataFrame(rows)
say("month: operating rows", f"{OPS.nrows.sum():,}")
say("vehicle-days (sum of daily distinct)", f"{OPS.veh.sum():,}")
say("month: rides started", f"{OPS.started.sum():,}")

trows = []
for f in trf:
    d = pd.read_csv(f)
    date = os.path.basename(f)[6:14]
    trows.append(dict(date=date, cells=len(d), trips=int(d.trips_total.sum()),
                      nulldist=int(d.distance_avg.isna().sum()),
                      nullwait=int(d.waittime_avg.isna().sum()),
                      maxwait=d.waittime_avg.max(),
                      zerowait=int((d.waittime_avg == 0).sum()),
                      wdist=float((d.distance_avg*d.trips_total).sum()),
                      wfare=float((d.fare_avg*d.trips_total).sum())))
TR = pd.DataFrame(trows)
say("month: trips-file cells", f"{TR.cells.sum():,}")
say("month: trips-file rides", f"{TR.trips.sum():,}")

M = OPS.merge(TR, on='date')
diff = M.trips - M.started
say("days where trips != op ride count", f"{int((diff!=0).sum())} of 30")
say("  total ride gap (trips minus op)", f"{int(diff.sum())}, range {diff.min()} to {diff.max()}")

# ---------- summary_stats -------------------------------------------------
S = pd.read_csv("summary_stats.csv")
say("summary_stats rows", f"{len(S):,}")
say("summary_stats span", f"{S.iloc[:,0].min()} .. {S.iloc[:,0].max()}")
say("summary_stats columns", list(S.columns))
S['d8'] = pd.to_datetime(S['dt']).dt.strftime('%Y%m%d')
SM = S[S.d8.isin(set(M.date))].merge(M, left_on='d8', right_on='date')
say("summary days matched to September", len(SM))
print()
print("--- summary vs hourly operating file, all 30 days ---")
def cmp(sumcol, opcol, tol, label):
    if sumcol not in SM.columns:
        print(f"  {label:34s} (no column '{sumcol}')"); return
    a = SM[sumcol].astype(float); b = SM[opcol].astype(float)
    ok = int((np.abs(a-b) <= tol).sum())
    gap = float(np.abs(a-b).sum()); worst = float(np.abs(a-b).max())
    print(f"  {label:34s} agree {ok:2d}/30   total gap {gap:,.0f}   worst day {worst:,.1f}")
    OUT[label] = (ok, gap, worst)

SM['dcan_sum'] = SM.trips_cancelled_driver_wav.fillna(0) + SM.trips_cancelled_driver_nonwav.fillna(0)
SM['pcan_sum'] = SM.trips_cancelled_passenger_wav.fillna(0) + SM.trips_cancelled_passenger_nonwav.fillna(0)
cmp('reported_trips_started', 'started', 0.5, 'rides started')
cmp('active_vehicles', 'veh', 0.5, 'active vehicles')
cmp('trips_started_pooled', 'pooled', 0.5, 'pooled trips')
cmp('dcan_sum', 'dcan', 0.5, 'driver cancellations')
cmp('pcan_sum', 'pcan', 0.5, 'passenger cancellations')
cmp('dist_ontrip_routed', 'dO', 0.05, 'dist_ontrip_routed')
cmp('dist_ontrip_reported', 'dR', 0.05, 'dist_ontrip_reported')
cmp('time_ontrip', 'tO', 0.05, 'time_ontrip')
cmp('time_available', 'tA', 0.05, 'time_available')
cmp('time_enroute', 'tE', 0.05, 'time_enroute')
cmp('time_waiting', 'tW', 0.05, 'time_waiting')

print()
print("--- day-level averages: does the trips file reproduce the summary? ---")
SM['dist_calc'] = SM.wdist / SM.trips
SM['fare_calc'] = SM.wfare / SM.trips
print(f"  dist_avg  max |summary - trips-file| = {(SM.dist_avg-SM.dist_calc).abs().max():.4f}")
print(f"  fare_avg  max |summary - trips-file| = {(SM.fare_avg-SM.fare_calc).abs().max():.4f}")
d1 = SM[SM.d8 == '20250901'].iloc[0]
print(f"  1 Sept: summary dist {d1.dist_avg}  trips-file {d1.dist_calc:.4f}")
print(f"  1 Sept: summary fare {d1.fare_avg}  trips-file {d1.fare_calc:.4f}")
print(f"  1 Sept WAV trips {int(d1.trips_started_wav)}, non-WAV {int(d1.trips_started_nonwav)}")
print(f"  1 Sept wait: WAV {d1.waittime_wav_avg}  non-WAV {d1.waittime_nonwav_avg}")
print(f"  1 Sept percent split: ontrip {d1.percent_time_ontrip} avail {d1.percent_time_available} "
      f"enroute {d1.percent_time_enroute} waiting {d1.percent_time_waiting}")

print()
print("--- impossible / contradictory values ---")
print(f"  vehicle-hours with reported > 200 km : {OPS.hi200.sum()} of {OPS.nrows.sum():,} "
      f"({100*OPS.hi200.sum()/OPS.nrows.sum():.5f}%), on {int((OPS.hi200>0).sum())} of 30 days")
print(f"  worst single vehicle-hour reported   : {OPS.maxdR.max():,.1f} km")
d0 = pd.read_csv(opf[0])
print(f"  1 Sept worst reported                : {d0.dist_ontrip_reported.max():,.1f} km")
print(f"  1 Sept routed speed > 150 km/h       : {rows[0]['fast150']} of {rows[0]['nrows']:,}")
print(f"  month routed speed > 150 km/h        : {OPS.fast150.sum()}")
print(f"  reported < routed  (1 Sept)          : {rows[0]['under']:,} of {rows[0]['nrows']:,} "
      f"({100*rows[0]['under']/rows[0]['nrows']:.1f}%)")
print(f"  reported < routed  (month)           : {OPS.under.sum():,} of {OPS.nrows.sum():,} "
      f"({100*OPS.under.sum()/OPS.nrows.sum():.1f}%)")
print(f"  zero en-route time, non-zero km      : 1 Sept {rows[0]['zeroE']}, month {OPS.zeroE.sum():,}")
print(f"  activity > 60 min                    : 1 Sept {rows[0]['over60']:,}, worst {OPS.maxact.max():.2f} min")
print(f"  trips-file nulls 1 Sept              : distance {trows[0]['nulldist']}, wait {trows[0]['nullwait']}")
print(f"  trips-file nulls month               : distance {TR.nulldist.sum()}, wait {TR.nullwait.sum()}")
print(f"  longest average wait, 1 Sept         : {trows[0]['maxwait']:.2f} min; zero-wait cells {trows[0]['zerowait']}")
print(f"  longest average wait, month          : {TR.maxwait.max():.2f} min")
un = OPS.started - OPS.routed
print(f"  unrouted rides 1 Sept                : {int(un.iloc[0]):,} ({100*un.iloc[0]/OPS.started.iloc[0]:.2f}%)")
print(f"  unrouted rides month                 : {int(un.sum()):,} "
      f"({100*un.min()/OPS.started[un.idxmin()]:.2f}%-{100*un.max()/OPS.started[un.idxmax()]:.2f}% per day)")
print(f"  pooled rides 1 Sept                  : {OPS.pooled.iloc[0]:,}")
OPS.to_csv("verify_daily.csv", index=False)
print("\nwrote verify_daily.csv")
