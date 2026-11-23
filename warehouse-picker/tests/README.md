# Tests

`slip-reading.test.js` draws 60 packing slips laid out like the real ones
(order number, picture, item name that wraps, SKU, barcode, Bin and Quantity
columns, "Total items") in several layouts (including ones built like the real A4 slips: Items/Bin/Quantity
on one line, bin and quantity beside the second line of the name, names as
"Product - Colour - Size"), reads them back with the
app, and compares every order number, name, colour/size, SKU, barcode, bin and
quantity with what was printed. It prints `mistakes: 0` when everything matches. One deliberately hard layout
(no space between items) checks that anything the app can't read for certain is
sent to "Please look": the number of mistakes NOT flagged must be 0.

    cd warehouse-picker && python3 -m http.server 8765 &
    node tests/slip-reading.test.js   # needs Playwright (npm i playwright)

`real-slips.test.js` reads the real slips sent in so far (only their item tables are kept, in
`fixtures/real-slips.json`: no names or addresses), one at a time and all together, and checks every
field exactly, including an item kept in two boxes and barcodes printed in letters (like `PJ131PNK 6M`),
then scans each barcode and checks it finds its item. It must print `mistakes: 0`. When a new slip
reads wrong, add its item table there.

    node tests/real-slips.test.js

`check-these.test.js` makes slips with problems (wrong total, missing bin,
missing quantity, no "Total items", an order printed twice, a page with no
order number), checks each is flagged under "Please look", fixes them the way
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

`example-barcodes.test.js` films `web/barcodes.html` (the example items'
barcodes) into a camera video and goes through **Try an example** →
**Scan to unpack**: each barcode must go to the right order, two of the same
must count twice (and a barcode still in view only once), and the barcode
that isn't on the slips must ask which item it is and be remembered after.


`accounts.test.js` checks sign-in, asking to start a company and the owner accepting it, company admins, the live sharing switch, the one-week offline sign-out (and a clock turned back), removing a company, blocking and removing people, and that the database refuses everything it should
against the Firebase emulator, with `firebase/firestore.rules` (OWNER_EMAIL set
to owner@test.com): the owner signs in with Google and makes a company, a
worker makes an email account, a stranger is refused, the list and scans go
both ways, the Packing screen, still signed in after reopening, blocking
(live, and the phone's list is wiped), a manager who can only manage their own
company, and people trying to read other companies or promote themselves.
Start the emulator first, in a folder with that rules file and a firebase.json
for the auth (9099) and firestore (8080) emulators:
`firebase emulators:start --project pick-and-sort --only auth,firestore`.

The other tests run with accounts switched off (`noauth.js`).

`bins.test.js` checks Bins (practice): loading the practice items, the List (by bin, empty bins, items not in a
bin, sort, company filter, search), an item's colours and sizes and one size's details, a bin's Edit page (move,
the "bin taken" warning with See details, Undo, Edit all with See empty bins), Add / Edit (choose sizes, add to a
bin), scanning a bin's sticker and then items into it, the inventory-changes switch, History, and that picking
and settings are untouched.

`receive-merge.test.js` checks receiving a list when the phone already has one: only new orders are added,
after the old ones; everything already picked, placed, sorted and packed stays; a new order's item from a box
already picked gets its own pick line; what the sending device had done on new orders comes along; the same list
again changes nothing; an empty phone gets the list with its ticks.

`live-sync.test.js` (with the Firebase emulator, like `accounts.test.js`): two devices in one company tick and
untick the pick list at the same moment; both must end up with every change and the same list.

`live-join.test.js` (with the Firebase emulator): live sharing turned on while two devices are already working on the
same orders combines both lists (every tick, pile and Packed kept, on both); a device with different orders gets the
company's list; a device that ticked offline in the background catches up and sends its tick when it's back.

`company-store.test.js` (with the Firebase emulator): the admin saves the store setup (aisles, shelves, boxes,
walking order) for the company; a worker signing in on a new device gets it; a later change reaches the worker by
itself and keeps the ticks on the list; a worker can't save it; it stays after reopening.

`settings-file.test.js`: a full store (aisles of different shapes, picking patterns, a custom walking order, order
numbering, learned barcodes, inventory) and Bins are saved to a settings file and loaded on an empty device:
everything must be identical, the same orders must give the same pick order, and it must stay after reopening.

`pack-scan.test.js`: packing by scanning (the test address): the Code 128 barcodes the app draws (and the packing
slip PDF's order barcode) scan back exactly; the pack screen wants the sheet first, then each item, refuses another
order's sheet, an item not in the order and an extra one; when all are green the camera goes and Pack & Print / Pack
shows; Pack records the time and tag and makes the label; Find an order filters as you type and sorts; Scan an order
opens any order.

`print-station.test.js` (with the Firebase emulator): devices are named; holding the green circle lists every device in
the company, online first; the admin makes a computer the print station; a phone packing a local order sends its label
there and goes back to the list; a UPS order opens there for Shopify; with the station offline the phone prints its own
label and the UPS order waits, then reaches the station when it's back.

`shopify.test.js` (with the Firebase emulator): the Shopify connection. The real server code
(`firebase/functions/shopify.js`) runs against the emulator and a pretend Shopify: the admin connects the store from
Settings → More (a worker can't); the store's key can't be read from the app; a callback used twice or not signed by
Shopify is refused; Packing and Find use the store's open orders; Pack puts the "Packed ..." tag on the order in
Shopify; Orders → From Shopify lists the open orders, filtered by area, sorted, ticked and added to the list (items
without a bin go to Please look); Disconnect forgets the key. Inside the store's Shopify admin (a pretend App
Bridge): an admin opening it there connects by itself with Shopify's session token; a worker or a made-up token is refused. Bins → Inventory brings in the store's products (sizes, SKUs, barcodes, how many);
changing a name, barcode or how many here goes to the store (and Undo too); adding a colour, removing a size, a
brand-new item (a draft in the store, with its amounts) and deleting an item all reach the store.

`bins-share.test.js` (with the Firebase emulator, test address): Orders has only Add orders; Bins are shared by
everyone in the company (two people changing different sizes at once both keep their change; a deleted item goes on
both); orders added from the store get each item's bin from Bins, one without a bin waits under Please look and gets
its bin as soon as it's set on any phone.

`statuses.test.js` (test address, Use bins for orders on): an order list made of items in Bins (matched by barcode or
SKU): each item says how many are in its bin now, to pick, picked, sorted, packed; the bin's page shows how many are
in it now; finishing the list takes what was picked out of its bin and what was packed out of the inventory; with the
switch off nothing changes.

`stock.test.js`: Bins with amounts. Inventory lists every item with how many (and how many still to put away);
Scan to count in (a known barcode adds how many came in, a new barcode starts a new item with it); a new item's page sets
each size's barcode and how many; Put away: scan an item, it says which bin and suggests everything not in a bin yet,
other sizes of the same item go with it, the bin's sticker confirms and the wrong bin warns; loading a bin suggests the
amount and it can be changed; a bin's page shows and changes how many are in it.

`inventory-edit.test.js`: adding and editing the inventory in Bins (with Allow inventory changes on): a new item from
its name, company, colours and sizes; scanning its barcodes in order (a duplicate is refused); adding a colour;
removing a size; renaming; deleting; Undo.
