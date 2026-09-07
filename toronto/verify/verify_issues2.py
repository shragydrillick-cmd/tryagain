"""Second pass: the numbers the first pass got wrong or measured with the
wrong denominator. Speed tests are done against each row's OWN time, which is
the physically meaningful test, not an arbitrary kilometre threshold."""
import pandas as pd, numpy as np, glob, os

opf = sorted(glob.glob("days/op_*.csv"))
trf = sorted(glob.glob("days/trips_*.csv"))
veh = set(); rows = []
for f in opf:
    d = pd.read_csv(f)
    date = os.path.basename(f)[3:11]
    veh |= set(d.vehid.unique())
    t = d.time_ontrip.values.astype(float)
    dO = d.dist_ontrip_routed.values.astype(float)
    dR = d.dist_ontrip_reported.values.astype(float)
    act = (d.time_available + d.time_enroute + d.time_waiting + d.time_ontrip).values
    hasT = t > 0
    spR = np.where(hasT, dR / np.maximum(t, 1e-9) * 60.0, np.nan)
    spO = np.where(hasT, dO / np.maximum(t, 1e-9) * 60.0, np.nan)
    rows.append(dict(
        date=date, n=len(d), veh=d.vehid.nunique(),
        started=int(d.reported_trips_started.sum()),
        routed_n=int(d.routed_trips_started.sum()),
        # denominators
        withT=int(hasT.sum()), withO=int((dO > 0).sum()), withR=int((dR > 0).sum()),
        # speed impossibilities, measured against each row's own time
        R_over150=int(np.nansum(spR > 150)), R_over200=int(np.nansum(spR > 200)),
        R_over300=int(np.nansum(spR > 300)),
        O_over150=int(np.nansum(spO > 150)),
        maxspR=np.nanmax(spR), maxspO=np.nanmax(spO),
        maxdR=dR.max(), maxdO=dO.max(),
        # reported below routed
        under=int((dR < dO - 0.05).sum()),
        under_of_withO=int(((dR < dO - 0.05) & (dO > 0)).sum()),
        # time budget
        over60=int((act > 60.0 + 1e-9).sum()), maxact=act.max(),
        # no time but distance
        zeroT_dist=int(((t == 0) & (dO > 0)).sum()),
        zeroE=int(((d.time_enroute == 0) & (d.dist_enroute_routed > 0)).sum()),
    ))
D = pd.DataFrame(rows)
D['unrouted'] = D.started - D.routed_n
D['unrouted_pct'] = 100 * D.unrouted / D.started

print(f"distinct vehicles in the month      : {len(veh):,}")
print(f"vehicle-hours in the month          : {D.n.sum():,}")
print()
print("--- speed, measured against each row's own on-trip minutes ---")
print(f"  rows with on-trip time            : {D.withT.sum():,}  ({D.withT.iloc[0]:,} on 1 Sept)")
print(f"  REPORTED implies >150 km/h        : 1 Sept {D.R_over150.iloc[0]:,}   month {D.R_over150.sum():,}"
      f"   ({100*D.R_over150.sum()/D.withT.sum():.3f}% of rows with time)")
print(f"  REPORTED implies >200 km/h        : 1 Sept {D.R_over200.iloc[0]:,}   month {D.R_over200.sum():,}")
print(f"  REPORTED implies >300 km/h        : 1 Sept {D.R_over300.iloc[0]:,}   month {D.R_over300.sum():,}")
print(f"  ROUTED   implies >150 km/h        : 1 Sept {D.O_over150.iloc[0]:,}   month {D.O_over150.sum():,}"
      f"   ({100*D.O_over150.sum()/D.withT.sum():.4f}%)")
print(f"  fastest reported speed            : 1 Sept {D.maxspR.iloc[0]:,.0f} km/h   month {D.maxspR.max():,.0f} km/h")
print(f"  fastest routed   speed            : 1 Sept {D.maxspO.iloc[0]:,.0f} km/h   month {D.maxspO.max():,.0f} km/h")
print(f"  largest reported km in one hour   : 1 Sept {D.maxdR.iloc[0]:,.1f}   month {D.maxdR.max():,.1f}")
print(f"  largest routed   km in one hour   : 1 Sept {D.maxdO.iloc[0]:,.1f}   month {D.maxdO.max():,.1f}")
print()
print("--- reported below routed ---")
print(f"  1 Sept : {D.under.iloc[0]:,} of {D.n.iloc[0]:,} rows ({100*D.under.iloc[0]/D.n.iloc[0]:.1f}%)"
      f"  |  {D.under_of_withO.iloc[0]:,} of {D.withO.iloc[0]:,} rows that have routed distance"
      f" ({100*D.under_of_withO.iloc[0]/D.withO.iloc[0]:.1f}%)")
print(f"  month  : {D.under.sum():,} of {D.n.sum():,} ({100*D.under.sum()/D.n.sum():.1f}%)"
      f"  |  {100*D.under_of_withO.sum()/D.withO.sum():.1f}% of rows that have routed distance")
print()
print("--- time budget ---")
print(f"  activity > 60 min : 1 Sept {D.over60.iloc[0]:,}   month {D.over60.sum():,}"
      f"   worst {D.maxact.max():.2f} min")
print(f"  zero on-trip time but routed km   : 1 Sept {D.zeroT_dist.iloc[0]:,}  month {D.zeroT_dist.sum():,}")
print(f"  zero en-route time but km         : 1 Sept {D.zeroE.iloc[0]:,}  month {D.zeroE.sum():,}")
print()
print("--- unrouted rides ---")
print(f"  1 Sept {int(D.unrouted.iloc[0]):,} ({D.unrouted_pct.iloc[0]:.2f}%)")
print(f"  month  {int(D.unrouted.sum()):,}; per-day share ranges "
      f"{D.unrouted_pct.min():.2f}% to {D.unrouted_pct.max():.2f}%")
print()
print("--- trips file: extreme averages ---")
mx = []
for f in trf:
    t = pd.read_csv(f)
    mx.append(dict(date=os.path.basename(f)[6:14],
                   maxwait=t.waittime_avg.max(), maxdist=t.distance_avg.max(),
                   maxdur=t.duration_avg.max(), maxfare=t.fare_avg.max(),
                   mindur=t.duration_avg.min(), mindist=t.distance_avg.min(),
                   nulldist=int(t.distance_avg.isna().sum()),
                   nullwait=int(t.waittime_avg.isna().sum()),
                   nullfare=int(t.fare_avg.isna().sum()),
                   nulldur=int(t.duration_avg.isna().sum()),
                   zerowait=int((t.waittime_avg == 0).sum()),
                   # a cell whose average speed is impossible
                   fastcell=int((t.distance_avg / t.duration_avg * 60 > 150).sum())))
X = pd.DataFrame(mx)
print(f"  longest average wait   : 1 Sept {X.maxwait.iloc[0]:.2f} min   month {X.maxwait.max():.2f} min "
      f"({X.maxwait.max()/60:.1f} hours) on {X.loc[X.maxwait.idxmax(),'date']}")
print(f"  longest average trip   : 1 Sept {X.maxdist.iloc[0]:.2f} km    month {X.maxdist.max():.2f} km")
print(f"  longest average dur    : 1 Sept {X.maxdur.iloc[0]:.2f} min   month {X.maxdur.max():.2f} min")
print(f"  highest average fare   : 1 Sept ${X.maxfare.iloc[0]:.2f}     month ${X.maxfare.max():.2f}")
print(f"  shortest average trip  : month {X.mindist.min():.2f} km, {X.mindur.min():.2f} min")
print(f"  cells implying >150km/h: 1 Sept {X.fastcell.iloc[0]}   month {X.fastcell.sum()}")
print(f"  nulls month            : dist {X.nulldist.sum()}, wait {X.nullwait.sum()}, "
      f"fare {X.nullfare.sum()}, duration {X.nulldur.sum()}")
print(f"  zero-wait cells        : 1 Sept {X.zerowait.iloc[0]}   month {X.zerowait.sum()}")
D.to_csv("verify_daily2.csv", index=False); X.to_csv("verify_trips2.csv", index=False)
print("\nwrote verify_daily2.csv, verify_trips2.csv")
