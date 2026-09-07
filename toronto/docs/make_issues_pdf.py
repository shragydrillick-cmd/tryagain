"""Data completeness and issues report.

Every number in this document was re-measured from the files by
verify_issues.py through verify_issues5.py. Nothing is quoted from memory.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak)

DOC = "Toronto_Data_Completeness_and_Issues.pdf"
st = getSampleStyleSheet()
H1 = ParagraphStyle('H1', parent=st['Heading1'], fontSize=15.5, spaceAfter=8,
                    textColor=colors.HexColor('#1a3a5c'))
H2 = ParagraphStyle('H2', parent=st['Heading2'], fontSize=12, spaceBefore=12,
                    spaceAfter=4, textColor=colors.HexColor('#1a3a5c'))
BODY = ParagraphStyle('B', parent=st['Normal'], fontSize=9.3, leading=12.6, spaceAfter=5)
SMALL = ParagraphStyle('S', parent=st['Normal'], fontSize=8.3, leading=10.8,
                       textColor=colors.HexColor('#444444'))
CELL = ParagraphStyle('C', parent=st['Normal'], fontSize=7.6, leading=9.6)
CELLB = ParagraphStyle('CB', parent=CELL, fontName='Helvetica-Bold')
S = []
def P(t, s=BODY): S.append(Paragraph(t, s))
def SP(h=6): S.append(Spacer(1, h))
def tbl(rows, widths):
    data = [[Paragraph(str(c), CELLB if i == 0 else CELL) for c in r]
            for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    sty = [('VALIGN', (0, 0), (-1, -1), 'TOP'),
           ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#b7c4d0')),
           ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dce6f0')),
           ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
           ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]
    for i in range(2, len(data), 2):
        sty.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f4f7fa')))
    t.setStyle(TableStyle(sty))
    return t

W = 7.0 * inch

# =====================================================================
P("Toronto rideshare data: what exists, what is wrong with it, "
  "and what to do about each thing", H1)
P("Checked against the City of Toronto open data portal and re-measured from the files "
  "on 7 September 2026. Every figure below was counted, not remembered. Where a number "
  "differs from an earlier document, this one is the measured value.", SMALL)
SP(4)

# ---------------------------------------------------------------- 1
P("1. Everything the City publishes, and what we hold", H2)
S.append(tbl([
    ["Dataset", "What it is", "Published span", "What we hold"],
    ["<b>Vehicle Operating Data</b>", "One row per vehicle per hour",
     "2020-01-01 onward,<br/>refreshed monthly",
     "<b>September 2025.</b> 7,028,672 rows, 30 days, <b>77,446 distinct vehicles</b>. "
     "The other 5½ years are published but not downloaded."],
    ["<b>Trip Data</b>", "One row per hour per district pair",
     "2018-01-01 onward,<br/>refreshed monthly",
     "<b>September 2025.</b> 268,217 rows, <b>7,194,939 rides</b>. "
     "January 2018 also downloaded but unused."],
    ["<b>Summary Data</b>", "One row per day",
     "2018-01-01 to<br/>2026-06-30",
     "<b>All of it.</b> 3,100 daily rows. This is the file that had never been opened."],
], [1.25*inch, 1.55*inch, 1.15*inch, 3.05*inch]))
SP(4)
P("<b>Nothing is missing that we cannot get.</b> Two readme PDFs are the complete "
  "technical documentation — one for the trips and summary tables, one for vehicle "
  "operating hours. Both are version 1.2, dated 23 July 2026. There is no third "
  "document, and no external source adds anything. The only gap is history: we hold one "
  "month of detail out of the years published, and the rest is downloadable if wanted.", BODY)
P("Two things about the summary file are worth knowing before relying on it. "
  "<b>Only <i>distance_avg</i> goes back to 2018</b> — fares, wait times, all four time "
  "columns, all four distance columns and every cancellation count begin on 2020-01-01, "
  "so 2018 and 2019 are near-empty rows. And in the whole 3,103-day span there are "
  "<b>exactly three missing days: 26, 27 and 28 May 2025</b>, which the readme documents. "
  "None of them is in September.", BODY)

# ---------------------------------------------------------------- 2
P("2. What the summary file adds that exists nowhere else", H2)
S.append(tbl([
    ["What", "The numbers on 1 September", "Can the detailed files reproduce it?"],
    ["<b>Wheelchair-accessible trips</b>", "26 WAV trips out of 179,247 — 0.015%",
     "<b>No.</b> Neither detailed file has a WAV column. This is new information."],
    ["<b>Wait times split by WAV</b>", "WAV riders 5.22 min, everyone else 4.81 min",
     "<b>No.</b> Same reason."],
    ["<b>Day-level averages</b>", "11.59 km and $20.89 per ride",
     "<b>Yes — and they check out.</b> The trips file gives 11.5927 km and $20.8864. "
     "Across all 30 days the largest disagreement is 0.006 km and half a cent."],
    ["<b>Percentage split of driver time</b>",
     "47.96% on trip · 41.10% available · 8.37% en route · 2.57% waiting",
     "<b>Yes</b>, derivable from the operating file."],
], [1.35*inch, 2.35*inch, 3.3*inch]))

# ---------------------------------------------------------------- 3
P("3. The City's own files against each other, all 30 days", H2)
S.append(tbl([
    ["Quantity", "Days that<br/>match exactly", "Total gap over the month", "Verdict"],
    ["Rides started", "<b>30 of 30</b>", "zero", "Perfect. Build on it."],
    ["Active vehicles", "<b>30 of 30</b>", "zero", "Perfect."],
    ["Pooled trips started", "<b>30 of 30</b>", "zero", "Perfect."],
    ["dist_ontrip_routed", "0 of 30", "293 km out of 1,732,288 — 0.017%",
     "Rounding. Worst day off by 28.8 km. Ignorable."],
    ["dist_ontrip_reported", "0 of 30", "3,130 km out of 2,097,816 — 0.15%",
     "Worst day off by 126.8 km. Small, unexplained, ignorable."],
    ["The four time columns", "0–1 of 30", "13 to 80 minutes each, over ~3.3 million",
     "Rounding. Ignorable."],
    ["<b>Driver cancellations</b>", "<b>0 of 30</b>", "<b>974</b>, worst day off by 84",
     "<b>A real disagreement.</b> Neither file is obviously right."],
    ["<b>Passenger cancellations</b>", "<b>0 of 30</b>", "<b>2,256</b>, worst day off by 200",
     "<b>A real disagreement.</b>"],
], [1.25*inch, 0.85*inch, 2.25*inch, 2.65*inch]))
SP(4)
P("The trips file and the operating file also disagree on how many rides happened on "
  "<b>16 of the 30 days</b> — but only ever by 1 or 2 rides, <b>18 in total out of "
  "7,194,939</b> (0.00025%), and the trips file always has the extra one. On "
  "1 September they agree exactly, at 179,247.", BODY)

S.append(PageBreak())

# ---------------------------------------------------------------- 4
P("4. Every impossible or contradictory value, and what to do about each", H2)
P("Ordered by how much it matters, not by how strange it looks.", SMALL)
SP(4)
S.append(tbl([
    ["#", "What is wrong", "How big", "The options, and the cost of ignoring it"],

    ["<b>1</b>",
     "<b>20 cells record a distance and a duration that cannot both be true.</b> "
     "Example: 81 rides averaging <b>26.97 km in 8.04 minutes</b> — 201 km/h — for a "
     "fare of <b>$9.26</b>. Another says 658.73 km in 35.84 minutes.",
     "20 cells, <b>722 rides</b> of 7,194,939 (0.010%). "
     "<b>None of them on 1 September.</b>",
     "<b>The fare says which field is broken.</b> Fitting fare against distance and "
     "duration on 1 September's clean cells gives fare = $4.56 + $0.865/km + $0.343/min "
     "(R² = 0.92, typical error $2.36). Run backwards on these 20 cells it implies "
     "<b>2 to 32 km, not 27 to 659</b>, and every implied speed then lands between 15 "
     "and 73 km/h. So <i>distance_avg</i> is the wrong field; duration and fare agree "
     "with each other.<br/><br/>"
     "<b>Option A</b> — replace distance_avg with the fare-implied value. <b>Option B</b> "
     "— leave those cells' distance unconstrained and let the build choose. "
     "<b>Option C</b> — fit them as recorded: <b>impossible</b>, it demands 200–1,100 km/h. "
     "<br/><b>Ignoring it costs nothing on 1 September</b> and 0.01% of rides elsewhere."],

    ["<b>2</b>",
     "<b>Wildly overstated reported distances.</b> One vehicle-hour records "
     "<b>6,921 km</b>. On 1 September the worst is <b>1,077.9 km</b> in an hour with "
     "10.15 minutes on trip and <b>no rides started at all</b>.",
     "112 vehicle-hours in the month out of 7,028,672 (0.0016%), holding 76,734 km of "
     "74,542,192 (0.103%).",
     "<b>This is not scattered noise — it is mostly one broken vehicle.</b> 81 vehicles "
     "are involved, but a single VIN accounts for 26 of the 112 bad hours across 14 "
     "separate days and <b>73,459 km on its own</b>. Its routed distances are always "
     "sane (never above 167 km in a day); only its reported odometer breaks, and only "
     "on some days. It is the same vehicle that produces 1 September's 1,077.9 km.<br/><br/>"
     "<b>Option A</b> — cap reported distance at what the hour's minutes allow. "
     "<b>Option B</b> — treat that one VIN's reported column as unusable and fit only "
     "its routed distance. <b>Option C</b> — fit as recorded: forces a car to drive "
     "1,078 km in 10 minutes. <br/><b>Ignoring costs 0.05% of 1 September's reported "
     "distance</b> and cannot be seen in any district average."],

    ["<b>3</b>",
     "<b>Routed speeds above 150 km/h — which the readme says were removed.</b> "
     "The readme: “a small portion of routed records have speeds greater than 150 km/h. "
     "These records have been removed from the dataset.” They were not all removed.",
     "8 on 1 September; <b>567 in the month</b>, 0.011% of vehicle-hours that have any "
     "on-trip time.",
     "<b>The time is the broken field, not the distance.</b> Every one is a sub-minute "
     "value: the worst is <b>0.05 minutes carrying 3.2 km</b>, another 0.18 minutes "
     "carrying 0.9 km. These are trips clipped by the hour boundary where the minutes "
     "rounded almost to nothing but the kilometres did not.<br/><br/>"
     "<b>Option A</b> — give such rows a floor on time instead of trusting 0.05 min. "
     "<b>Option B</b> — drop the 8 rows. <b>Ignoring is safe</b>: 8 rows on the day, "
     "carrying about 34 km between them."],

    ["<b>4</b>",
     "<b>31.1% of vehicle-hours report driving LESS than the ideal routed path.</b> "
     "If “routed” were the shortest way, that would be impossible a third of the time.",
     "36,573 of the 117,760 vehicle-hours on 1 September that have any routed distance "
     "(21.0% of all rows). 32.7% across the month.",
     "<b>This is not an error, and treating it as one would wreck the build.</b> The two "
     "columns are different measurements: routed is the City's own calculation over its "
     "street network, reported is what the operator's system submitted. Split by the "
     "boundary flag it becomes obvious — for cars that <b>never left Toronto</b>, 45.5% "
     "fall on this side, the median ratio is exactly <b>1.000</b>, and the median excess "
     "is <b>0.6 km</b>: symmetric rounding-scale noise. For cars that <b>did</b> cross, "
     "only 12.2% do, and the median ratio is <b>1.197</b> — the out-of-town driving "
     "showing up exactly where it should.<br/><br/>"
     "<b>There is only one option: do not treat routed as a floor.</b> Forcing "
     "reported ≥ routed would make <b>a third of the data unsatisfiable</b>. This is the "
     "single most consequential item in this document."],
], [0.22*inch, 1.62*inch, 1.28*inch, 3.88*inch]))

S.append(PageBreak())
S.append(tbl([
    ["#", "What is wrong", "How big", "The options, and the cost of ignoring it"],
    ["<b>5</b>",
     "<b>Zero en-route time but real en-route distance.</b> The car drove to a pickup in "
     "no time at all.",
     "551 vehicle-hours on 1 September; 37,580 in the month.",
     "<b>Rounding, and explained.</b> Times are recorded to 0.01 minutes, so a very short "
     "leg rounds to zero while keeping its distance. <b>Keep the distance, ignore the "
     "zero.</b> No cost."],
    ["<b>6</b>",
     "<b>More than 60 minutes of activity inside a 60-minute hour.</b>",
     "1,176 vehicle-hours on 1 September; 50,744 in the month. <b>Nothing exceeds "
     "60.01 minutes.</b>",
     "<b>Rounding, one hundredth of a minute.</b> Ignore entirely. No cost."],
    ["<b>7</b>",
     "<b>Zero on-trip time but real on-trip distance.</b>",
     "0 on 1 September; 14 in the whole month.",
     "Same as #5, and it does not occur on the day being built. Ignore."],
    ["<b>8</b>",
     "<b>Missing values.</b> A cell with no average distance, or no average wait.",
     "1 September: <b>1</b> cell with no distance, <b>7</b> with no wait. Month: 2 and "
     "223. No fare or duration is ever missing.",
     "<b>Leave those cells' averages unconstrained</b> — there is no number to satisfy. "
     "Cost: 8 rides out of 179,247 have one attribute the build may choose freely. "
     "Note the one null-distance cell in the month is also the strangest row in the "
     "data: one ride, 0.03 minutes long, $78.01."],
    ["<b>9</b>",
     "<b>An average wait of 395 minutes</b> — six and a half hours — on 1 September. "
     "The month's worst is <b>4,433 minutes: nearly 74 hours</b>, on 10 September.",
     "1 cell on 1 September (39 rides). 3 cells that day record a wait of exactly zero.",
     "<b>Keep them.</b> A long wait is unusual, not impossible — it is a recorded number "
     "with no physical contradiction, unlike a speed. The 395-minute cell is a "
     "withheld-to-withheld district pair at 8am where the rest of the city averaged 3.58 "
     "minutes. Dropping it would break that cell's recorded average for no gain."],
    ["<b>10</b>",
     "<b>The readme and the data use different labels.</b> The readme says other "
     "municipalities “are identified as <i>Not included elsewhere</i>”. The data actually "
     "says <i>Other Municipality</i>.",
     "A documentation slip, not a data error.",
     "<b>It works in our favour.</b> Because the two levels use different strings, the "
     "ward-level “Not included elsewhere” is unambiguous: every time it appears, the "
     "municipality is Toronto. Verified — all 14,189 hidden pickups on 1 September are "
     "inside the city. So a withheld ward always means <b>inside Toronto, ward hidden</b>, "
     "never <b>outside Toronto</b>."],
    ["<b>11</b>",
     "<b>Vehicle IDs are not fully stable from day to day.</b>",
     "72.8% of 1 September's 30,468 vehicles appear again on 2 September.",
     "Some of that is ordinary driver turnover, so it is not necessarily a fault. But the "
     "readme's own change log records that vehid values were <b>corrected for October to "
     "December 2025</b> — not September. <b>Do not assume a vehid is the same car across "
     "months.</b> Within September, and within a day, it is safe."],
], [0.22*inch, 1.62*inch, 1.28*inch, 3.88*inch]))

S.append(PageBreak())

# ---------------------------------------------------------------- 5
P("5. Not errors — but they change how the data has to be read", H2)
S.append(tbl([
    ["What the documentation or the data says", "What it means for the build"],
    ["<b>Time is counted “whether inside or outside the City of Toronto”, but routed "
     "distance is Toronto-only.</b>",
     "A trip that leaves the city contributes <b>all</b> its minutes but only its Toronto "
     "kilometres. Matching on-trip time against Toronto-side driving alone is wrong — and "
     "that is what the build has been doing. <b>This needs fixing.</b>"],
    ["<b>For pooled trips, reported distance is counted once per passenger</b> — the "
     "operating readme says it “will be duplicated”.",
     "Part of the gap between reported and routed distance is double-counted pooling, not "
     "out-of-town travel. 7,705 pooled rides on 1 September, and the three files agree on "
     "that count exactly."],
    ["<b>Cruising distance is routed between the start and end of each free period and "
     "“may understate actual distances travelled”.</b>",
     "The City states this is an <b>underestimate</b>. We still have to reproduce the "
     "recorded number, but must not treat it as the real distance driven."],
    ["<b>Delivery work is excluded entirely</b> — “data related to those activities are "
     "not included”.",
     "A driver doing food delivery while logged on shows as available. Nothing to fix; it "
     "explains why cruising time looks so long (41% of all driver time)."],
    ["<b>Records from different platforms are de-duplicated before publication.</b>",
     "A driver logged on to two apps at once is not double-counted. The hour's minutes "
     "are a real budget, which is why nothing exceeds 60.01."],
    ["<b>Ward detail is withheld wherever a group would have fewer than 10 records.</b>",
     "<b>Verified exactly, all 30 days.</b> There is not one named ward-pair cell "
     "anywhere in the month with fewer than 10 rides; the smallest is exactly 10. On "
     "1 September the count jumps from 0 cells at nine rides to <b>296 cells at ten</b>. "
     "So a withheld row of 17 rides is several distinct ward-pairs of under 10 each, "
     "pooled together — which tells us something real about what is hiding in it."],
    ["<b>The withholding is one-sided.</b>",
     "Across all <b>7,194,939 rides in the month there is not a single one</b> where the "
     "pickup ward is hidden but the dropoff ward is named. Dropoff-only hidden: 9.67%. "
     "Both hidden: 2.00% — and those are always paired with an out-of-town end. "
     "<b>So for almost every withheld ride we know where the driver started.</b>"],
    ["<b>1.02% to 1.23% of rides each day have no route at all</b> (2,199 on "
     "1 September; 79,726 in the month).",
     "By design: the City only routes within Toronto and to 11 named municipalities. "
     "These rides went further afield. They must be built as rides that exist and "
     "<b>contribute no routed distance</b>. Ignoring this would inflate every distance."],
    ["<b>Cancellations drop sharply from January 2026.</b>",
     "Measured: driver cancellations fall from about 4,375 a day in December 2025 to 706 "
     "a day by April 2026 — an 84% drop — while rides <i>rose</i> from 262,000 to "
     "270,000 a day. The City says it is investigating a possible methodology change. "
     "Only matters if we ever use 2026 data."],
], [2.5*inch, 4.5*inch]))

S.append(PageBreak())

# ---------------------------------------------------------------- 6
P("6. What was checked and came back sound", H2)
P("Confirmations matter as much as faults. These were tested, not assumed.", SMALL)
SP(4)
S.append(tbl([
    ["The question", "The test", "The answer"],
    ["<b>Is a trip that crosses the hour boundary split by distance the same way it is "
     "split by time?</b> The whole build assumes yes. If distance were instead booked "
     "whole to the hour the trip started, every distance in every hour would be wrong.",
     "Compare kilometres per on-trip minute in hours that spill a trip into the next hour "
     "against hours that finish their trips.",
     "<b>Confirmed.</b> Spilling hours: <b>0.500 km per minute</b>. Complete hours: "
     "<b>0.516</b>. Nearly identical — so distance is apportioned exactly as time is. "
     "Had distance been booked whole, spilling hours would have shown a far higher rate."],
    ["<b>Do the three files agree on the size of the day?</b>",
     "Sum each independently for all 30 days.",
     "<b>Yes.</b> Rides started, active vehicles and pooled trips all match exactly, "
     "every day, across all three files."],
    ["<b>Do the day-level averages the City publishes actually follow from the "
     "district-level file?</b>",
     "Re-weight every district cell by its ride count and compare.",
     "<b>Yes.</b> Largest disagreement over 30 days: 0.006 km and half a cent."],
    ["<b>Is the under-10 privacy rule real, or just described?</b>",
     "Count named ward-pair cells by ride count, every day.",
     "<b>Real and exact.</b> Zero cells below 10 rides in the entire month."],
    ["<b>Is anything missing from what the City publishes?</b>",
     "Compare the portal's resource list against what we hold.",
     "<b>No.</b> All three datasets and both readmes accounted for. Only history is "
     "un-downloaded, and it is freely available."],
], [2.5*inch, 1.85*inch, 2.65*inch]))

# ---------------------------------------------------------------- 7
P("7. The honest summary", H2)
S.append(tbl([
    ["Question", "Answer"],
    ["Is anything missing that we need?",
     "<b>No.</b> Three datasets, two readmes, all accounted for. Three calendar days are "
     "absent from the City's own 8½-year record (26–28 May 2025) and none is in September."],
    ["Is the data internally consistent?",
     "<b>Mostly.</b> Ride counts, vehicle counts and pooled counts agree perfectly across "
     "all three files on all 30 days. Distances and times agree to within rounding. "
     "<b>Cancellations do not agree at all</b> — 974 and 2,256 apart across the month, "
     "with no day matching."],
    ["Are there impossible values?",
     "<b>Yes, and they fall into two kinds.</b> Genuinely broken: 20 district cells whose "
     "distance and duration contradict each other, 112 absurd reported distances (mostly "
     "one vehicle), and 567 sub-minute rows implying impossible speeds. Merely rounded: "
     "everything else — zero times with real distance, 60.01-minute hours. "
     "<b>Together the broken ones are under 0.02% of anything.</b>"],
    ["If we ignore the broken values, does anything break?",
     "<b>No.</b> On 1 September specifically the entire cost of ignoring every one of them "
     "is: one vehicle-hour's reported distance (0.05% of the day), eight rows carrying "
     "about 34 km, and eight rides with one free attribute. <b>None of the 20 "
     "contradictory district cells is on 1 September at all.</b>"],
    ["Is there anything that <b>would</b> break everything?",
     "<b>Yes — one thing.</b> Treating item 4 as an error and forcing reported distance to "
     "be at least routed distance. That would make a third of the data unsatisfiable. "
     "Routed and reported are two different measurements, not a floor and a total."],
    ["What did this review change?",
     "Four things the build must now do differently: <b>(1)</b> on-trip time includes "
     "driving outside Toronto while routed distance does not, so the two cannot be matched "
     "directly; <b>(2)</b> pooled trips double-count reported distance; <b>(3)</b> the "
     "1.2% of rides with no route must add no routed distance; <b>(4)</b> the under-10 "
     "rule means every withheld row is made of small ward-pairs, and the pickup ward is "
     "never the hidden one."],
], [1.65*inch, 5.35*inch]))

doc = SimpleDocTemplate(DOC, pagesize=letter, leftMargin=0.65*inch,
                        rightMargin=0.65*inch, topMargin=0.6*inch,
                        bottomMargin=0.6*inch,
                        title="Toronto rideshare data: completeness and issues")
doc.build(S)
print("wrote", DOC)
