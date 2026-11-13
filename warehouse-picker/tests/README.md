# Tests

`slip-reading.test.js` draws 60 packing slips laid out like the real ones
(order number, picture, item name that wraps, SKU, barcode, Bin and Quantity
columns, "Total items") in several layouts (including ones built like the real A4 slips: Items/Bin/Quantity
on one line, bin and quantity beside the second line of the name, names as
"Product - Colour - Size"), reads them back with the
app, and compares every order number, name, colour/size, SKU, barcode, bin and
quantity with what was printed. It prints `mistakes: 0` when everything matches. One deliberately hard layout
(no space between items) checks that anything the app can't read for certain is
sent to "Check these": the number of mistakes NOT flagged must be 0.

    cd warehouse-picker && python3 -m http.server 8765 &
    node tests/slip-reading.test.js   # needs Playwright (npm i playwright)

`check-these.test.js` makes slips with problems (wrong total, missing bin,
missing quantity, no "Total items", an order printed twice, a page with no
order number), checks each is flagged under "Check these", fixes them the way
a person would, and checks the lists afterwards.

`aisle-map.test.js` makes 400 random aisles (2–8 shelves, numbers down the
columns from any corner, some shelves shorter), gives the app only the box at
each end of each shelf, and checks the map it builds against the real layout box
by box. "WRONG map" must be 0: anything it can't work out must become a
question instead.

`aisle-wide.test.js` does the same with 600 aisles of which about half have one
wide box (a box taking up two spaces), with a pretend person who answers every
question truthfully (taps the shelf each number is really on, confirms real shelf lengths).
"WRONG map" must be 0. A wide box that is the last box of its shelf can't be
told from a shorter shelf by the numbers, so those count as right when every box
is in the right place. `node tests/aisle-wide.test.js plain` runs it without wide boxes.

`linking.test.js` checks **Send to phone** (QR code, link, list file) and
linked devices with three browsers and a pretend Firestore database that
answers the same calls: joining with the link text, ticks going both ways, new
orders and **Clear list** reaching the other device, a wrong key, and changes
made offline being sent once the database is reachable again.

`qr-scan.test.js` makes a big list (80 orders), shows it as several changing QR
codes, films them into a video (needs ffmpeg), uses the video as a second
browser's camera, and checks that **Scan from computer** rebuilds exactly the same
list. The iPhone app's self-test on the build server also makes the codes and
reads them back with Safari's engine.

`scan-unpack.test.js` checks the barcode and SKU shown under items and which
order each scan goes to (an item in two orders, two of one item, Undo, unknown
codes, already placed), then draws real barcodes into a video (needs ffmpeg)
that a second browser uses as its camera, and checks **Scan to unpack** places
each item once on the right order. The iPhone app's self-test also draws an
EAN-13 barcode and reads it with Safari's engine.
