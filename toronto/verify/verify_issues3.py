"""Third pass: the claims about labels, suppression, missing dates and the
2026 cancellation change. All from the files."""
import pandas as pd, numpy as np, glob, os

# ---------- the under-10 suppression rule ---------------------------------
NAMED = lambda w: w not in ('Not in Toronto', 'Not included elsewhere')
t = pd.read_csv("days/trips_20250901.csv")
named = t[t.pickup_ward.map(NAMED) & t.dropoff_ward.map(NAMED)]
print("--- the under-10 rule, 1 Sept ---")
for k in range(1, 13):
    print(f"   named ward-pair cells with exactly {k:2d} rides: {int((named.trips_total==k).sum()):5d}")
print(f"   named ward-pair cells below 10 rides : {int((named.trips_total<10).sum())}")
print(f"   suppressed cells below 10 rides      : "
      f"{int((t[~(t.pickup_ward.map(NAMED)&t.dropoff_ward.map(NAMED))].trips_total<10).sum())}")

# does it hold every day?
bad = []
for f in sorted(glob.glob("days/trips_*.csv")):
    d = pd.read_csv(f)
    nm = d[d.pickup_ward.map(NAMED) & d.dropoff_ward.map(NAMED)]
    bad.append((os.path.basename(f)[6:14], int((nm.trips_total < 10).sum()), int(nm.trips_total.min())))
B = pd.DataFrame(bad, columns=['date', 'under10', 'min'])
print(f"   days where a named ward-pair has <10 rides: {int((B.under10>0).sum())} of 30")
print(f"   smallest named ward-pair cell in the month: {B['min'].min()} rides")

# ---------- which side is hidden -------------------------------------------
print("\n--- which end is hidden (whole month) ---")
tot = dict(hid_pu_only=0, hid_do_only=0, hid_both=0, out_any=0, named_both=0, all=0)
for f in sorted(glob.glob("days/trips_*.csv")):
    d = pd.read_csv(f)
    pu, do = d.pickup_ward, d.dropoff_ward
    pO, dO_ = pu.eq('Not in Toronto'), do.eq('Not in Toronto')
    pH, dH = pu.eq('Not included elsewhere'), do.eq('Not included elsewhere')
    n = d.trips_total
    tot['all'] += int(n.sum())
    tot['out_any'] += int(n[pO | dO_].sum())
    ins = ~(pO | dO_)
    tot['named_both'] += int(n[ins & ~pH & ~dH].sum())
    tot['hid_pu_only'] += int(n[ins & pH & ~dH].sum())
    tot['hid_do_only'] += int(n[ins & ~pH & dH].sum())
    tot['hid_both'] += int(n[ins & pH & dH].sum())
N = tot['all']
for k, v in tot.items():
    print(f"   {k:14s} {v:10,d}  {100*v/N:5.2f}%")

# ---------- municipality vs ward label reuse -------------------------------
print("\n--- is 'Not included elsewhere' distinguishable at ward vs municipality? ---")
d = pd.read_csv("days/trips_20250901.csv")
print("   pickup_municipality values:", sorted(d.pickup_municipality.unique()))
print("   pickup_community_council values:", sorted(d.pickup_community_council.unique()))
sub = d[d.pickup_ward.eq('Not included elsewhere')]
print("   when pickup_ward is hidden, municipality is:",
      sub.groupby('pickup_municipality').trips_total.sum().to_dict())
sub2 = d[d.pickup_municipality.eq('Not included elsewhere')]
print("   when pickup_municipality is 'Not included elsewhere', ward is:",
      sub2.groupby('pickup_ward').trips_total.sum().to_dict())

# ---------- missing dates and the 2026 cancellation change -----------------
S = pd.read_csv("summary_stats.csv")
S['d'] = pd.to_datetime(S.dt)
full = pd.date_range(S.d.min(), S.d.max(), freq='D')
missing = sorted(set(full) - set(S.d))
print(f"\n--- summary_stats: {len(S)} rows, {S.d.min().date()} to {S.d.max().date()} ---")
print(f"   calendar days in that span: {len(full)}; missing: {len(missing)}")
print("   missing dates:", [str(x.date()) for x in missing])
S['dcan'] = S.trips_cancelled_driver_wav.fillna(0) + S.trips_cancelled_driver_nonwav.fillna(0)
S['pcan'] = S.trips_cancelled_passenger_wav.fillna(0) + S.trips_cancelled_passenger_nonwav.fillna(0)
by = S.set_index('d').resample('MS')[['dcan', 'pcan', 'reported_trips_started']].mean()
print("\n   monthly mean cancellations, Oct 2025 - Jun 2026:")
print(by.loc['2025-10-01':'2026-06-30'].round(0).to_string())
print("\n   first date with any cancellation figure:",
      S.loc[S.dcan.gt(0).idxmax(), 'dt'] if S.dcan.gt(0).any() else 'none')
nn = S[S[['trips_cancelled_driver_nonwav']].notna().all(axis=1)]
print("   cancellation columns first populated:", nn.dt.min(), "-> last:", nn.dt.max())
print("   dist_avg first populated:", S[S.dist_avg.notna()].dt.min())
print("   fare_avg first populated:", S[S.fare_avg.notna()].dt.min())
print("   time_* first populated  :", S[S.time_ontrip.notna()].dt.min())
print("   waittime first populated:", S[S.waittime_nonwav_avg.notna()].dt.min())
