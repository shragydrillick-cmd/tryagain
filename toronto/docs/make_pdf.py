"""Build the plain-language data reference PDF.

Every number in it was measured by reading the two files end to end
(see data_facts.txt), not recalled.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether)

DOC = "Toronto_Rideshare_Data_Explained.pdf"
styles = getSampleStyleSheet()
H1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=17, spaceAfter=10,
                    textColor=colors.HexColor('#1a3a5c'))
H2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13, spaceBefore=14,
                    spaceAfter=6, textColor=colors.HexColor('#1a3a5c'))
H3 = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=11, spaceBefore=10,
                    spaceAfter=4, textColor=colors.HexColor('#33526e'))
BODY = ParagraphStyle('BODY', parent=styles['Normal'], fontSize=9.5, leading=13.5,
                      spaceAfter=6)
SMALL = ParagraphStyle('SMALL', parent=styles['Normal'], fontSize=8.5, leading=11.5)
CELL = ParagraphStyle('CELL', parent=styles['Normal'], fontSize=8, leading=10)
CELLB = ParagraphStyle('CELLB', parent=CELL, fontName='Helvetica-Bold')
NOTE = ParagraphStyle('NOTE', parent=BODY, fontSize=9, leading=12.5,
                      leftIndent=10, textColor=colors.HexColor('#5a3a00'))

S = []
def P(t, st=BODY): S.append(Paragraph(t, st))
def SP(h=8): S.append(Spacer(1, h))

def tbl(rows, widths, header=True, fs=8):
    data = []
    for i, r in enumerate(rows):
        data.append([Paragraph(str(c), CELLB if (header and i == 0) else CELL) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#b7c4d0')),
          ('LEFTPADDING', (0, 0), (-1, -1), 4),
          ('RIGHTPADDING', (0, 0), (-1, -1), 4),
          ('TOPPADDING', (0, 0), (-1, -1), 3),
          ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]
    if header:
        st += [('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dce6f0'))]
        for i in range(2, len(data), 2):
            st.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f4f7fa')))
    t.setStyle(TableStyle(st))
    return t

# =====================================================================
P("What the Toronto rideshare data actually says", H1)
P("A plain-language guide to every column in both files. Every number below was "
  "measured by reading the files, not estimated.", SMALL)
SP(4)
P("Day covered: <b>Monday 1 September 2025</b>. Two files. They agree exactly on "
  "the size of the day: both say <b>179,247 rides</b>.", BODY)

P("The two files", H2)
S.append(tbl([
    ["File", "One row is...", "Rows", "What it tells you"],
    ["<b>Trips file</b>", "one hour + one pickup district + one dropoff district",
     "8,133", "How many rides went from district A to district B in that hour, "
     "and the <i>average</i> fare, distance, wait and duration of those rides."],
    ["<b>Operating-hours file</b>", "one vehicle + one hour",
     "174,505<br/>(30,468 vehicles)",
     "What that one car did in that one hour: how many rides it began, how far "
     "and how long it drove, what it earned."],
], [1.15*inch, 1.85*inch, 0.85*inch, 3.1*inch]))
SP(6)
P("Neither file contains a single location, a single street, a single clock time, "
  "or any link saying which car did which ride. That is the whole gap we are "
  "filling in.", BODY)

# ---------------------------------------------------------------
P("The four kinds of number, and what each one demands", H2)
P("This is the most important page. What we must do to 'satisfy' a number depends "
  "entirely on which kind it is.", BODY)
S.append(tbl([
    ["Kind", "Plain meaning", "What we must produce", "What we are free to choose"],
    ["<b>A COUNT</b>",
     "A whole number of things that happened. No estimate involved.",
     "Exactly that many. 15 rides means 15 rides.",
     "<b>Which</b> rides, and everything about them."],
    ["<b>A TOTAL</b>",
     "Everything one car did in one hour, added up.",
     "Our pieces must add up to it.",
     "<b>How it splits</b>. A car that drove 30&nbsp;km over 3 rides could have done "
     "10+10+10 or 25+3+2. The file does not say."],
    ["<b>AN AVERAGE</b>",
     "Add up a group and divide by how many. Nothing more.",
     "The <b>average</b> of our rides must equal it.",
     "<b>Every single value.</b> An average of 8&nbsp;km does <b>not</b> mean every "
     "ride was 8&nbsp;km. It means they average 8. They should be as spread out as "
     "real trips are."],
    ["<b>A FLAG</b>",
     "A yes/no fact about one car in one hour.",
     "Must match exactly.",
     "Nothing."],
], [0.85*inch, 1.75*inch, 1.6*inch, 2.75*inch]))
SP(6)
P("<b>Rounding is part of the definition.</b> We measured how precisely each number "
  "is written down. Every distance is recorded to the nearest <b>0.1&nbsp;km</b>. "
  "Times, fares and all averages are recorded to <b>0.01</b>. So a ride of 7.34&nbsp;km "
  "and a ride of 7.26&nbsp;km are written down as the <i>same number</i>, 7.3. "
  "Matching a distance means landing within 0.05&nbsp;km of it — asking for more than "
  "that is asking for more than the file actually says.", NOTE)

S.append(PageBreak())

# ---------------------------------------------------------------
P("File 1 — The trips file", H1)
P("8,133 rows. Each row is one hour and one pair of districts. Think of it as: "
  "<i>“between 4am and 5am, 26 rides went from Spadina-Fort York to Toronto Centre, "
  "and on average they were 4.2 km and cost $18.30.”</i>", BODY)

P("The 8 label columns — these say where and when", H3)
S.append(tbl([
    ["Column", "What it is", "What is in it"],
    ["dt", "The date", "One value: 2025-09-01"],
    ["pickup_hr", "The hour the ride began", "24 hours, midnight to 11pm"],
    ["pickup_municipality<br/>dropoff_municipality", "The city",
     "14 values: Toronto, plus Mississauga, Brampton, Vaughan, Markham, Richmond Hill, "
     "Pickering, Ajax, Whitby, Oshawa, Oakville, Burlington, Pearson Airport, "
     "and “Other Municipality”"],
    ["pickup_community_council<br/>dropoff_community_council", "A group of wards",
     "5 values: Toronto and East York, Etobicoke York, North York, Scarborough, "
     "and “Not in Toronto”"],
    ["pickup_ward<br/>dropoff_ward", "The city ward — the actual district",
     "27 values: Toronto’s 25 wards, plus two special ones explained below"],
], [1.55*inch, 1.55*inch, 3.85*inch]))
SP(8)

P("The two special districts — these matter a great deal", H3)
S.append(tbl([
    ["Value", "What it means", "How many rides"],
    ["<b>“Not in Toronto”</b>",
     "The ride started or ended outside the city. We only know which municipality, "
     "not where in it.",
     "<b>38,555</b> rides (21.5% of the day)"],
    ["<b>“Not included elsewhere”</b>",
     "The City <b>deliberately hid</b> which ward this was, because too few rides "
     "used it and naming it could identify someone. We know the community council "
     "but not the ward.",
     "<b>30,753</b> rides (17.2% of the day)"],
    ["A named ward",
     "We know exactly which of the 25 districts.",
     "<b>109,939</b> rides (61.3% of the day)"],
], [1.4*inch, 3.75*inch, 1.8*inch]))
SP(6)
P("<b>Read that table carefully, because it is easy to read it wrongly.</b> It does "
  "<i>not</i> say four rides in ten leave town. Counting whole rides:", BODY)
S.append(tbl([
    ["Where the ride goes", "Rides", "Share"],
    ["<b>Entirely inside Toronto</b>", "<b>140,692</b>", "<b>78.5%</b>"],
    ["&nbsp;&nbsp;&nbsp;— and both ends name a ward", "109,939", "61.3%"],
    ["&nbsp;&nbsp;&nbsp;— but one or both ends are withheld", "30,753", "17.2%"],
    ["<b>One end outside the city</b>", "<b>38,555</b>", "<b>21.5%</b>"],
], [3.6*inch, 1.7*inch, 1.65*inch]))
SP(6)
P("So <b>nearly four rides in five never leave Toronto</b>. About one in five crosses "
  "the city line. The withholding is a separate thing entirely: it affects about one "
  "ride in six, and those rides are inside the city. That is a fact about the data, "
  "not a mistake in it.", BODY)
P("And the withholding is <b>one-sided</b>, which is worth a great deal. Of the 30,753 "
  "in-city rides with a district withheld, <b>26,342 (86%) still tell us the pickup "
  "ward</b> — only the dropoff is hidden. There is <b>not a single ride in the whole "
  "day</b> where the pickup ward is withheld but the dropoff ward is named. So for "
  "almost every hidden ride we know where the driver started, and only have to work "
  "out where they ended.", BODY)

P("The 5 number columns", H3)
S.append(tbl([
    ["Column", "Kind", "Plain meaning", "The actual numbers"],
    ["<b>trips_total</b>", "COUNT",
     "How many rides went from this district to that one, in this hour.",
     "Adds to <b>179,247</b>. Typical cell has <b>15</b> rides; a quarter have 11 or "
     "fewer; the biggest single cell has <b>636</b>. Only 319 cells have just one ride. "
     "<b>7,258 of 8,133 cells (89%) have 5 or more.</b>"],
    ["<b>distance_avg</b>", "AVERAGE",
     "The average length of those rides, door to door — <b>the whole trip</b>, "
     "including any part outside Toronto.",
     "Shortest average <b>1.56 km</b>, typical <b>13.53 km</b>, longest <b>107.62 km</b>. "
     "<b>1 cell has no value.</b>"],
    ["<b>duration_avg</b>", "AVERAGE",
     "The average time those rides took, door to door.",
     "Shortest average <b>4.08 min</b>, typical <b>20.68 min</b>, longest <b>105 min</b>."],
    ["<b>fare_avg</b>", "AVERAGE",
     "The average fare paid.",
     "Cheapest average <b>$7.12</b>, typical <b>$21.56</b>, dearest <b>$223.97</b>."],
    ["<b>waittime_avg</b>", "AVERAGE",
     "The average time the passenger waited from booking to pickup.",
     "Typical <b>4.35 min</b>; a quarter under 3.65; the extreme is <b>395 min</b> "
     "(6½ hours — almost certainly a data error). <b>7 cells have no value</b>, "
     "3 more say zero."],
], [1.05*inch, 0.55*inch, 2.15*inch, 3.2*inch]))
SP(6)
P("<b>What this means in practice.</b> Take the typical cell: 15 rides averaging "
  "13.53&nbsp;km. We must invent 15 rides whose lengths average exactly 13.53. They "
  "should look like real trips — some 4&nbsp;km, some 30&nbsp;km — not fifteen identical "
  "13.53&nbsp;km rides. Both would satisfy the arithmetic; only one is a real day.", NOTE)

S.append(PageBreak())

# ---------------------------------------------------------------
P("File 2 — The operating-hours file", H1)
P("174,505 rows covering <b>30,468 vehicles</b>. Each row is one car in one hour. "
  "Think of it as: <i>“this car began 2 rides between 4am and 5am, drove 18.3 km "
  "carrying passengers over 31 minutes, and took $47.20.”</i>", BODY)
SP(4)
P("Note that <b>70,468 of the rows have the car starting no ride at all</b> — it was "
  "logged on but idle, or still finishing a ride begun earlier. Of those, "
  "<b>14,851 were driving with a passenger</b> the whole hour without starting "
  "anything new.", BODY)

P("Counting rides — 4 columns that sound alike but are not", H3)
S.append(tbl([
    ["Column", "Kind", "Plain meaning", "The actual numbers"],
    ["<b>reported_trips_started</b>", "COUNT",
     "How many rides this car <b>began</b> in this hour.",
     "Adds to <b>179,247</b> — matching the trips file exactly. Never more than "
     "<b>7</b> in one hour."],
    ["<b>reported_trip_fractions</b>", "COUNT<br/>(with parts)",
     "How much riding was <b>going on</b> during the hour, counting part-rides. A ride "
     "that starts at 4:50 and ends at 5:10 is <i>half</i> in this hour.",
     "Adds to <b>180,395.1</b> — slightly more than rides started, because rides "
     "spill across the hour boundary. Highest single value <b>7.33</b>."],
    ["<b>routed_trips_started</b>", "COUNT",
     "How many of those rides had a route calculated for them.",
     "Adds to <b>177,048</b> — <b>2,199 fewer than were actually started.</b> "
     "So about 1 ride in 80 has no route recorded at all."],
    ["<b>pooled_trips_started</b><br/><b>pooled_trip_fractions</b>", "COUNT",
     "The same two ideas, but only for shared rides (two passengers, separate bookings).",
     "<b>7,705</b> pooled rides began; <b>7,760.1</b> pooled part-rides were in progress. "
     "That is 4.3% of all rides."],
], [1.35*inch, 0.6*inch, 2.0*inch, 3.0*inch]))
SP(8)

P("Time — 4 columns, and they divide the hour", H3)
P("Every minute a driver is logged on falls into one of four buckets. They add to at "
  "most 60 per hour.", BODY)
S.append(tbl([
    ["Column", "Plain meaning", "Day total", "Typical hour"],
    ["<b>time_ontrip</b>", "Minutes with a passenger in the car.",
     "3,257,457 min", "<b>17 min</b>"],
    ["<b>time_available</b>", "Minutes logged on, empty, waiting for a booking.",
     "2,792,040 min", "<b>11.2 min</b>"],
    ["<b>time_enroute</b>", "Minutes driving to collect a passenger, after accepting.",
     "568,501 min", "<b>2 min</b>"],
    ["<b>time_waiting</b>", "Minutes parked at the pickup point waiting for them to come out.",
     "174,716 min", "<b>0 min</b> (most hours: none)"],
], [1.3*inch, 3.3*inch, 1.05*inch, 1.3*inch]))
SP(6)
P("Put plainly: across the whole day drivers spent about <b>48% of their logged time "
  "carrying someone</b>, 41% cruising empty, 8% driving to a pickup, and 3% parked "
  "waiting.", BODY)

P("Distance — 4 columns, and two of them are the key to everything", H3)
S.append(tbl([
    ["Column", "Plain meaning", "Day total", "Typical hour"],
    ["<b>dist_ontrip_routed</b>",
     "Distance driven with a passenger, <b>inside Toronto only</b>, measured along the "
     "ideal computed route.",
     "1,732,288 km", "<b>7.3 km</b>"],
    ["<b>dist_ontrip_reported</b>",
     "Distance driven with a passenger as the car itself reported it — "
     "<b>the whole trip, including outside Toronto</b>.",
     "2,097,816 km", "<b>8.7 km</b>"],
    ["<b>dist_available_routed</b>", "Distance driven while empty and available.",
     "753,209 km", "<b>1.9 km</b>"],
    ["<b>dist_enroute_routed</b>", "Distance driven to collect a passenger.",
     "161,796 km", "<b>0.1 km</b>"],
], [1.4*inch, 3.15*inch, 1.05*inch, 1.35*inch]))
SP(6)
P("<b>Why the two on-trip distances differ — and what that buys us.</b> We split every "
  "vehicle-hour by whether the car left Toronto:", NOTE)
S.append(tbl([
    ["Cars that...", "reported ÷ routed", "What that tells us"],
    ["<b>never left Toronto</b>", "<b>1.000</b> typical, 1.019 overall",
     "The two columns are measuring the same thing. Real routes are only about "
     "<b>2% longer</b> than the ideal computed route."],
    ["<b>left Toronto</b>", "<b>1.184</b> typical, 1.308 overall",
     "The difference <b>is the driving done outside Toronto</b> — a quantity we would "
     "otherwise have no way of knowing."],
], [1.4*inch, 1.5*inch, 4.05*inch]))
SP(6)
P("The most notable single value in either file: one car records "
  "<b>1,077.9&nbsp;km in a single hour</b>. That is impossible — it would need an "
  "average speed of 1,078&nbsp;km/h. Recorded numbers can still be wrong, and this "
  "column needs a rule for outliers rather than being trusted blindly.", NOTE)

P("The remaining 4 columns", H3)
S.append(tbl([
    ["Column", "Kind", "Plain meaning", "The actual numbers"],
    ["<b>toronto_boundary_crossed</b>", "FLAG",
     "Did this car leave Toronto during this hour? Just “t” or “f”.",
     "<b>62,996 of 174,505</b> vehicle-hours are “t” — 36%. This is a hard fact about "
     "each individual car."],
    ["<b>fares</b>", "TOTAL",
     "Money this car took in this hour.",
     "<b>$3,784,062</b> across the day. Typical hour <b>$18.70</b>; best single hour "
     "<b>$383.64</b>."],
    ["<b>driver_cancelled_trips</b>", "COUNT",
     "Rides the driver cancelled after accepting.",
     "<b>4,156</b> across the day. One driver cancelled <b>31</b> in a single hour."],
    ["<b>passenger_cancelled_trips</b>", "COUNT",
     "Rides the passenger cancelled after booking.",
     "<b>11,849</b> — nearly three times as many as driver cancellations."],
], [1.45*inch, 0.5*inch, 2.1*inch, 2.9*inch]))

S.append(PageBreak())

# ---------------------------------------------------------------
P("Things the files tell us only when read together", H1)
P("Four facts that are not in any single column, but follow from the data with "
  "certainty.", BODY)

P("1. The distance driven outside Toronto", H3)
P("<b>dist_ontrip_reported − dist_ontrip_routed</b>, for a car flagged as crossing the "
  "boundary, is the distance it drove beyond the city limits. We know this because "
  "for cars that never crossed, the two columns are identical (ratio 1.000). This is a "
  "real recorded quantity — not something we have to invent.", BODY)

P("2. How much of a ride spills into the next hour", H3)
P("A car can only carry one passenger group at a time. So within any hour, only the "
  "<b>last</b> ride it started can still be running when the hour ends. Combined with "
  "“rides started” and “riding going on”, that pins down exactly how much of each ride "
  "crossed the hour boundary — it is arithmetic, not guesswork.", BODY)

P("3. Rides with no route", H3)
P("179,247 rides began, but only 177,048 had a route calculated. <b>2,199 rides "
  "have no route</b>, and legitimately contribute no routed distance.", BODY)

P("4. Real routes are about 2% longer than ideal ones", H3)
P("Measured from cars that never left the city: 1.019. Drivers take very nearly the "
  "best route. <i>Note: the overall figure across all cars is 1.211, but that is "
  "mostly the out-of-Toronto driving, not detours. Using 21% as a “detour factor” "
  "would be wrong.</i>", BODY)

P("What is genuinely not in the data", H2)
P("After going through every column, exactly three things cannot be recovered:", BODY)
S.append(tbl([
    ["", "Why not"],
    ["<b>1. Where a ride that was already underway at midnight on 1 September began</b>",
     "The download starts at 00:00 on 1 September. A car mid-ride at that moment carries "
     "in a journey from 31 August, which is not in the file. <b>This applies to the 1st "
     "only</b> — for every other day of the month the previous day is right there, so the "
     "hand-over can be built rather than guessed."],
    ["<b>2. Which ward a “Not included elsewhere” ride actually used</b>",
     "The City withheld it on purpose to protect privacy. We know the community "
     "council, so we can pick a ward within it, but we can never know the true one. "
     "<b>30,753 rides</b> — though for 86% of them the pickup ward is still named and "
     "only the dropoff is hidden."],
    ["<b>3. Street addresses</b>",
     "The map gives streets and intersections, not house numbers. We can say “on Dundas "
     "St W between Bathurst and Spadina”; we cannot say “number 412”."],
], [2.9*inch, 4.05*inch]))
SP(8)
P("Everything else in the day — who drove which ride, where exactly each pickup and "
  "dropoff was, which streets were taken, what time each ride began, how a car's "
  "distance split across its rides — is <b>not recorded anywhere</b>, and is ours to "
  "choose. The only requirement is that our choices add up to every number in this "
  "document.", BODY)

P("The size of the job, in one table", H2)
S.append(tbl([
    ["", "Number"],
    ["Rides to place, with a pickup point, dropoff point, route and clock time", "<b>179,247</b>"],
    ["Vehicles to give a day to", "<b>30,468</b>"],
    ["Vehicle-hours to account for", "<b>174,505</b>"],
    ["District-pair-hours whose count and 4 averages must all come out", "<b>8,133</b>"],
    ["Individual recorded numbers that must be satisfied", "<b>8,133 × 5  +  174,505 × 17</b>"],
], [4.6*inch, 2.35*inch]))

S.append(Spacer(1, 14))
P("Every number in this document was produced by reading the two files directly. "
  "Where a value looks wrong — the 6½-hour wait, the 1,078 km hour — it is flagged "
  "as such rather than quietly smoothed over.", SMALL)

doc = SimpleDocTemplate(DOC, pagesize=letter,
                        leftMargin=0.7*inch, rightMargin=0.7*inch,
                        topMargin=0.7*inch, bottomMargin=0.7*inch,
                        title="What the Toronto rideshare data actually says")
doc.build(S)
print("wrote", DOC)
