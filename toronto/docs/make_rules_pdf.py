"""ASSUMPTIONS AND DEDUCTIONS -- what is data, what is deduced, what is invented.

Rebuilt after the working container was reclaimed. Every figure in here was
measured from the September 2025 City of Toronto files during the session that
produced it; the measurement scripts are in ../verify where they were
committed, and the figures that came from scripts written after that commit are
carried forward from the session record rather than re-measured. Where a number
is carried forward rather than re-run it is marked so.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak)

DOC = "Toronto_Assumptions_and_Deductions.pdf"
st = getSampleStyleSheet()
H1 = ParagraphStyle('H1', parent=st['Heading1'], fontSize=15.5, spaceAfter=8,
                    textColor=colors.HexColor('#1a3a5c'))
H2 = ParagraphStyle('H2', parent=st['Heading2'], fontSize=12, spaceBefore=12,
                    spaceAfter=4, textColor=colors.HexColor('#1a3a5c'))
H3 = ParagraphStyle('H3', parent=st['Heading3'], fontSize=10.2, spaceBefore=8,
                    spaceAfter=3, textColor=colors.HexColor('#2a5c8c'))
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

# ===================================================================== page 1
P("Assumptions and deductions: what is data, what we worked out, "
  "and what we are free to invent", H1)
P("Every claim below is labelled. <b>DATA</b> is recorded in a City file and may never "
  "be changed. <b>DEDUCED</b> follows from the data by reasoning that is written out so "
  "it can be checked. <b>ASSUMED</b> is a choice that could have been made differently. "
  "<b>FREE</b> is unconstrained and may be randomised. "
  "All figures are from the 30 days of September 2025.", SMALL)
SP(4)

P("The four labels, and what each one obliges us to do", H2)
S.append(tbl([
    ["Label", "Meaning", "What we owe it"],
    ["<b>DATA</b>", "Written in a City file.",
     "Reproduce it exactly, to the precision it is recorded at. Never trade one piece "
     "of data against another."],
    ["<b>DEDUCED</b>", "Not written down, but forced by what is.",
     "State the reasoning. Hold it as binding. If the reasoning breaks, the deduction "
     "goes with it — but nothing else may set it aside."],
    ["<b>ASSUMED</b>", "A choice, made because something had to be chosen.",
     "Record it, keep it visible, and change it only by an explicit decision — never "
     "silently and never for convenience."],
    ["<b>FREE</b>", "Nothing in the data constrains it.",
     "Choose realistically and spread it as widely as reality allows."],
], [0.85*inch, 2.3*inch, 3.85*inch]))

P("A principle that applies everywhere: an average is not its parts", H2)
P("When we invent values that must hit a recorded average, the temptation is to make "
  "every value equal that average. That satisfies the arithmetic and is unlike reality "
  "in every other respect.", BODY)
P("<b>The rule: reproduce what made the average, not the average.</b> Where the real "
  "quantity swings — day to day, hour to hour, ward to ward — the built values should "
  "swing the same way. Where the shape of that variation is visible in the data, mimic "
  "the shape. Where it is not, spread the values as widely as the physical limits allow "
  "rather than clustering them on the mean. We are never reproducing anyone's actual "
  "numbers, only producing numbers that could plausibly have averaged to what is "
  "recorded.", BODY)
P("So a swinging distribution and a flat one are not interchangeable even when their "
  "means match, and <b>\"it satisfies the average\" is never on its own a reason to "
  "accept a set of values.</b>", BODY)

P("How the trips file is actually shaped", H2)
P("Worth stating plainly because it is easy to picture wrongly. <b>There is no "
  "council-level total row.</b> Every row is one hour, one pickup ward, one dropoff "
  "ward. The council columns are labels attached to the ward, not rows of their own, and "
  "no row anywhere has a blank ward. The file also never prints a zero: a pair that did "
  "not happen is simply absent, and the smallest value in the file is 1.", BODY)
P("So a council-to-council total is never published — it exists only if you add that "
  "council's ward rows together with its withheld row. The withheld row is therefore not "
  "a summary standing above the wards; it is <b>the leftover bucket standing beside "
  "them</b>. That is exactly why elimination works: anything named is out of the bucket "
  "by construction.", BODY)
P("Scale of the sparsity: 25 wards give 625 ward-pairs per hour, 15,000 per day. On "
  "1 September <b>3,284 of them (22%) appear</b>. The rest had no rides.", BODY)

# ===================================================================== page 2
S.append(PageBreak())
P("The withheld ward: what is DATA", H2)
S.append(tbl([
    ["The recorded fact", "Measured"],
    ["Every cell that names a Toronto ward has at least 10 rides.",
     "No exception in 268,217 cells. Named ward-pair counts jump from <b>0 cells at nine "
     "rides to 296 at ten</b>."],
    ["A cell naming no Toronto ward may have as few as 1 ride.",
     "41,815 such cells are under 10."],
    ["The community council is never withheld.",
     "0 rows on either end, all 30 days."],
    ["A withheld ward always sits inside Toronto.",
     "All 14,189 withheld pickups on 1 September have municipality = Toronto. The file "
     "labels other municipalities \"Other Municipality\", a different string, so the two "
     "can never be confused."],
    ["Outside Toronto there is no ward and no council at all.",
     "Both columns read \"Not in Toronto\". There is never a finer level."],
    ["<b>Which end gets withheld is directional.</b>",
     "Toronto to Toronto, too small → the <b>destination</b> is withheld, never the "
     "origin (0 cases in 7,194,939 rides). Toronto to outside → the <b>origin</b> is "
     "withheld. Outside to Toronto → the <b>destination</b>. One rule: blur whichever "
     "Toronto ward the cell holds; when both ends are Toronto wards the destination goes "
     "first."],
], [2.6*inch, 4.4*inch]))

P("The withheld ward: what is DEDUCED", H2)
S.append(tbl([
    ["The deduction", "The reasoning", "Strength"],
    ["<b>A ward already published in that hour is not in the withheld cell.</b>",
     "A ward-pair with 10 or more rides is published in full. No mechanism splits one "
     "ward-pair between a published row and a withheld one. So its rides are accounted "
     "for elsewhere.",
     "<b>Solid.</b> Reduces candidates from 6.44 to 5.15 on average. The mixed pattern "
     "it relies on occurs in <b>856 groups on 1 September</b>."],
    ["<b>A withheld cell of N rides used at least ⌈N/9⌉ different wards.</b>",
     "Every ward-pair inside it held at most 9 rides, or it would have been published. "
     "So N rides cannot fit in fewer than N/9 wards.",
     "<b>Solid, outside the nine exceptions.</b> 64% of withheld cells need 2+ wards, "
     "29% need 3+, 6% need 4+."],
    ["<b>Where the two meet, the destination set is fully determined.</b>",
     "When the number of wards required equals the number still possible, every "
     "remaining ward must have been used.",
     "<b>Solid.</b> 145 cells on 1 September (9.9%), 2,291 rides."],
], [1.85*inch, 2.75*inch, 2.4*inch]))

P("The nine exceptions, and how to spot them", H2)
P("Nine cells in the month hold more rides than 9 × (wards in the council) could "
  "contain. Inspected hour by hour they are not privacy suppression at all: one cell's "
  "ward detail fails and returns the next hour.", BODY)
S.append(tbl([
    ["Fact", "Measured"],
    ["<b>The two populations separate perfectly by size.</b>",
     "Ordinary totally-withheld groups top out at <b>50</b> rides across 15,902 cases. "
     "The nine start at <b>231</b>. <b>Zero groups fall between.</b> Any cut-off in that "
     "void selects the same nine."],
    ["<b>The destination council itself is not broken.</b>",
     "In every one of the nine, all of that council's wards (6 for Scarborough, 8 for "
     "Toronto and East York) are named normally by <b>9 to 22 other pickup wards in the "
     "same hour</b>. The failure is one (pickup ward → destination council) cell, not "
     "the council, the hour, or the day."],
    ["<b>They are never mixed.</b>",
     "All nine show zero named wards in the affected council. Ordinary suppression shows "
     "the mixed pattern or a small total one. That is what makes the nine identifiable "
     "at all."],
    ["In one case the whole hour went.",
     "25 Sept 08:00, Scarborough-Rouge Park: 0 named wards anywhere against a typical 5. "
     "23 Sept is nearly the same at 1."],
    ["They concentrate.", "6 of 9 are Scarborough at exactly 08:00, in wards 20 and 25."],
    ["They are undocumented.",
     "Absent from both readmes, from the dataset's portal page, and from every external "
     "source searched."],
    ["They are tiny.", "9 cells of 39,837. 3,034 rides of 7,194,939 — <b>0.04%</b>."],
], [1.9*inch, 5.1*inch]))

# ===================================================================== page 3
S.append(PageBreak())
P("THE RULE, stated plainly", H2)
P("<b>The data is what establishes this rule.</b> 39,828 of the 39,837 withheld cells "
  "obey it, and the published side obeys the ten-ride threshold without a single "
  "exception in 268,217 cells. It is not a convenience and it is not a guess.", BODY)
P("It carries the word <i>assumed</i> for one reason only: <b>nine cells contradict "
  "it</b>, and while those nine exist the rule cannot be proved universal. The evidence "
  "says they are a different phenomenon — separated from every ordinary case by an empty "
  "gap between 50 and 231 rides — but <i>says</i> is not <i>guarantees</i>. So the rule "
  "stands as <b>assumed until proven otherwise</b>, which is a far stronger position "
  "than a preference.", BODY)
SP(3)
S.append(tbl([
    ["When a cell gives only the council, and it is not one of the nine:", ""],
    ["<b>1.</b>",
     "Assume the ward was withheld <b>because every ward-pair inside it held fewer than "
     "10 rides</b> — that and nothing else."],
    ["<b>2.</b>",
     "Put those rides <b>only in wards of that same council that are not already named "
     "in that hour, going to the same place</b>. A ward that appears by name has its "
     "rides counted there already, so it is not in the withheld bucket."],
    ["<b>3.</b>",
     "Put <b>no more than 9 rides in any one ward</b>. Ten or more would have been "
     "published."],
    ["<b>4.</b>",
     "<b>It does not have to be 9 each.</b> No data says how the rides divide. Any split "
     "is allowed so long as no ward exceeds 9 — and the split should vary rather than "
     "being even or maximal every time."],
], [0.5*inch, 6.5*inch]))
SP(5)

P("Who may set this rule aside", H3)
S.append(tbl([
    ["", ""],
    ["<b>Not me.</b>",
     "This rule is not dropped because a build is stuck, because a solver will not "
     "converge, because it is slower, or because no solution has been found yet. "
     "<b>None of those is a reason.</b> Being unable to satisfy it is a result to "
     "report, not a licence to discard it."],
    ["<b>Only on an explicit decision by the project's owner.</b>",
     "If relaxing the rule looks like it would unblock something, the move is to say so: "
     "name what is stuck, show that relaxing this would help, list what <b><i>else</i></b> "
     "could be changed instead and what each of those would cost — then wait for the "
     "decision. It is one candidate among several, never the default and never the "
     "convenient first resort."],
    ["<b>Or by evidence.</b>",
     "A published ward-pair with fewer than 10 rides, or a withheld cell provably holding "
     "a ward published in the same hour, would overturn it on the data. Neither has "
     "appeared in 7,194,939 rides."],
], [2.0*inch, 5.0*inch]))
SP(5)
P("<b>What the rule does not decide.</b> It narrows which wards are possible and caps "
  "how many rides each may take. It does not say which ward gets which ride, and it is "
  "not meant to. A cell of 17 rides across 2 determined wards could be 9 and 8 or 8 and "
  "9. That remainder is genuinely free and should be spread, not flattened.", BODY)

P("The procedure, by case", H2)
S.append(tbl([
    ["Case", "Share", "What we do", "Label"],
    ["<b>Mixed</b> — some wards named, some withheld",
     "60.1% of withheld groups, 414,603 rides",
     "Both deductions apply. Distribute only across wards not already published, at most "
     "9 per ward. Where required wards equal available wards, every one must be used.",
     "DEDUCED, then FREE within it"],
    ["<b>Totally withheld, ordinary</b> (50 rides or fewer)",
     "15,902 groups",
     "Same, except no ward is eliminated — the whole council stays possible. The ⌈N/9⌉ "
     "floor still binds.",
     "DEDUCED, then FREE"],
    ["<b>The nine</b>",
     "3,034 rides, 0.04% of the month",
     "Both deductions are void: a wider area and a bigger pool to spread over. Fall back "
     "on the same pickup ward and council at the same hour on other days — take the "
     "<i>shape</i> of how those rides usually spread across wards and reproduce a similar "
     "spread, not the same numbers and not a flat split. Where the other days vary "
     "evenly, randomise. When an hour is flagged, distrust <b>every</b> withheld cell "
     "from that pickup ward in that hour, not only the impossible one.",
     "ASSUMED"],
], [1.3*inch, 1.05*inch, 3.45*inch, 1.2*inch]))

# ===================================================================== page 4
S.append(PageBreak())
P("What arrivals cannot tell us — a line that was tried and abandoned", H2)
P("Departures from a named ward are complete, because a Toronto pickup ward is never "
  "withheld when the destination is also a Toronto ward. Arrivals are incomplete: on "
  "1 September <b>38,859 rides</b> have a withheld Toronto destination and are missing "
  "from every ward's arrival count.", BODY)
P("The tempting move is to treat a ward's arrival shortfall as evidence that the "
  "withheld rides ended there. <b>It does not work.</b> The shortfall correlates with "
  "ward size at <b>0.68</b> on log volume: small wards look short not because rides are "
  "genuinely missing from them, but because a small ward's pairs fall under ten more "
  "often and get withheld more often. The shortfall measures how often a ward was "
  "censored, which we already knew from counting the withheld cells. Circular, so "
  "useless.", BODY)
P("Two further reasons it could not have worked even unconfounded: people do not return "
  "by the same mode, and rides crossing the city line do not balance inside Toronto at "
  "all. Driver movement between a dropoff and the next pickup is <i>not</i> one of the "
  "reasons — that travel is not in the trips file at all, it sits in the operating "
  "file's en-route columns.", BODY)
P("<b>Recorded so the same ground is not covered twice.</b> There is no fourth handle. "
  "The constraints are the two deductions above and nothing more.", BODY)

P("The midnight rule", H2)
P("Two files, two different rules for the same trip.", BODY)
S.append(tbl([
    ["File", "Rule"],
    ["<b>Trips file</b>",
     "A trip belongs entirely to the hour and day it <b>started</b>. Its full distance, "
     "duration and fare sit in that one cell even if the ride finishes the next day. The "
     "readme is explicit: \"Based on trips that started during the specified hour.\""],
    ["<b>Operating file</b>",
     "<i>reported_trips_started</i> follows the same rule. But <i>reported_trip_"
     "fractions</i>, all four time columns and all four distance columns are "
     "<b>apportioned to the hour the driving actually happened in</b>. A trip crossing "
     "midnight splits across two days."],
], [1.3*inch, 5.7*inch]))
SP(4)
P("So for any single day the trips file includes the tail of rides that finish tomorrow "
  "and excludes the tail of rides that started yesterday. <b>That is the entire cause of "
  "the ±0.5% daily wobble between the two files</b>, which was at one point wrongly "
  "blamed on pooled trips. Over the 30 days the two agree to 0.04%.", BODY)
SP(3)
P("What was measured", H3)
S.append(tbl([
    ["Question", "Answer"],
    ["<b>How big is the carry at midnight?</b>",
     "Only an hour's last ride can still be running, which gives an exact identity and "
     "so a floor on the carry-in. Across the month: carry-in median <b>784</b> "
     "trip-fractions, carry-out median <b>798</b>, both about <b>0.4%</b> of a day's "
     "rides."],
    ["<b>Does distance split the way time does?</b>",
     "<b>Yes, confirmed on all 30 days.</b> Kilometres per on-trip minute: spilling hours "
     "<b>0.413</b>, complete hours <b>0.428</b>, ratio <b>0.963</b> (range 0.888–1.008). "
     "If distance were booked whole to the starting hour that ratio would be far above 1; "
     "<b>no day exceeds even 1.15</b>. The build's assumption is correct."],
    ["<b>The month is one chain, not 30 days.</b>",
     "One day's carry-out is the next day's carry-in, so the per-day floors must agree. "
     "Propagating the constraint through all 30 days raises 1 September's minimum "
     "carry-in from <b>1,431.73 to 1,680.73</b>, the binding day being 3 September. With "
     "that value no day violates its own floor, and the month hands <b>1,109.30</b> into "
     "October. <b>Fix 1 September and every other day's carry-in is determined.</b>"],
    ["<b>1 September is the hard one.</b>",
     "It needs a carry-in roughly double the median, and 31 August is not in the "
     "download, so its inherited rides cannot be built — only invented subject to that "
     "floor. Every other day can have its carry-in built from the day before. "
     "<b>ASSUMED</b>, and the only free parameter in the whole month's chain."],
], [1.75*inch, 5.25*inch]))

P("Still to be worked through in this format", H2)
S.append(tbl([
    ["Open question", "Why it matters"],
    ["<b>The driver who leaves Toronto</b>",
     "Rides that never touch the city are invisible — zero cells have both ends outside "
     "Toronto. But the driver stays in the record (a crossing hour is followed by another "
     "row 71.8% of the time, against 73.1% for non-crossing hours), and the time and "
     "distance are still recorded. Of 20,009 crossing vehicle-hours that start no ride at "
     "all, half still record on-trip time, at a reported-to-routed ratio of 1.85. What we "
     "may invent for those hours is unsettled."],
    ["<b>Vehicle mileage versus rider mileage</b>",
     "Pooled trips are counted once per passenger in the reported column and once per "
     "vehicle in the routed one: an hour that is mostly pooled reports <b>1.40×</b> its "
     "routed distance, against <b>0.998×</b> for an hour with no pooling. The trips file "
     "has no pooled marker at all, so <i>where</i> pooling happened is entirely free."],
], [1.9*inch, 5.1*inch]))

doc = SimpleDocTemplate(DOC, pagesize=letter, leftMargin=0.65*inch,
                        rightMargin=0.65*inch, topMargin=0.6*inch,
                        bottomMargin=0.6*inch,
                        title="Toronto: assumptions and deductions")
doc.build(S)
print("wrote", DOC)
