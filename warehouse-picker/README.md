# Pick & Sort

A small tool for a warehouse packer. You give it a file listing the orders
you're about to pack. It gives you back two lists:

1. **Pick list.** Every item from every order, combined and sorted in the
   order you walk the shelves ("take 3 of #10"). Take a cart down the aisle
   and go top to bottom.
2. **Unpack & sort list.** The cart unloaded from the top down (last thing
   picked comes off first), showing which order pile each item goes on.
   When an item finishes an order, it says **LAST ITEM, pack it**.

Long order numbers are swapped for short ones (1, 2, 3…), with a key at the
top of the unpack list so you can write the short number on each order
sheet.

## How to use it

Open `index.html` in any web browser (phone, tablet, or computer). It doesn't
need an account, Claude, or a server.

1. **Settings (top right):** enter your shelving units, which item numbers
   are on each shelf, and how you like to walk them. The app remembers this on
   that device. Use "Save settings file" to copy it to another device.
2. **Choose file:** pick your orders spreadsheet (Excel or CSV), or paste it.
3. Download the two PDFs, print them, or use **Unpack step by step** on a
   phone or tablet.

## Packing slips (PDF)

The quickest way: choose the PDF with all the packing slips, or select many PDFs
at once (one per order is fine); they're all read together into one pick list. For each slip the
app reads the **order number**, every item's **name** ("Product - Colour - Size": the part
after the first " - " is kept as the colour/size), **SKU**, **barcode**, **Bin** and **Quantity**,
and checks the count against the slip's **"Total items"**. Any slip that doesn't
add up is named so it can be checked by hand. Slips that run onto a second page
are joined up. Addresses and phone numbers are ignored, and nothing leaves the
phone. If a slip has no bin for an item, the inventory (by SKU) fills it in.

**Check these.** Anything missing or uncertain stops for a person to look at:
a slip whose items don't add up to its "Total items", no "Total items" at all,
an item with no bin, no quantity or no name, the same order in the files twice
(used once unless you keep both), or a page with no order number. Each shows
what was read; fix the bin/quantity/name, add a missing item or remove one,
then tap **Confirmed ✓**. A red banner stays until everything is checked.

`tests/slip-reading.test.js` checks this against 60 test slips in five layouts.

## The orders file

One line per item works best:

| Order | Box | Item             | Details | Qty |
|-------|-----|------------------|---------|-----|
| 10452 | A3  | Blue ceramic mug | 12 oz   | 1   |
| 10452 | A14 | Notebook         | Lined   | 2   |
| 10452 | A3  | Mug coaster      | Cork    | 1   |

- **Box** is the code on the shelf box: aisle letter + box number (A1 = aisle A, box 1).
  It decides the walking order. `a1`, `A-1` and `A01` all count as A1.
- **Item** and **Details** say what to take from the box. Any other columns
  (color, size…) are shown as details too. A box can hold more than one kind of
  item; each gets its own line.
- The **pick list** shows box + item. When one box holds several items, the
  box number is shown once across all of them, and the words that differ
  (e.g. **Blue** vs **Gray**) are highlighted. The **unpack list** shows only
  the item and which order it goes to.
- Both lists come as a PDF and as a **step by step** screen (tap Next as you go).
- Qty is optional (1 if left out). A blank order number means "same order as
  the line above".

See `example-orders.csv`.

### Two files: inventory + orders

If the orders only have **item numbers**, load an **inventory file** first:
each item number with its **bin** (and its name/details if you have them).

| Item Number | Bin | Name           | Details |
|-------------|-----|----------------|---------|
| 1001        | A3  | Fleece blanket | Blue    |
| 1002        | A3  | Fleece blanket | Gray    |

Then the orders file only needs `Order, Item Number, Qty`; each item's bin
and name are looked up in the inventory. The inventory is remembered on the
phone (and included in a saved settings file) until it's replaced or removed.
Item numbers match regardless of capitals and leading zeros (`blk-100` =
`BLK-100`, `777` = `00777`). Items not in the inventory are listed at the end
with bin "?". An orders file that has its own Bin column ignores the inventory.

## The shelf map

Each shelving unit can have its own number of shelves. For each shelf, type its
boxes from left to right: a run like `A1-A10`, or a list like `A1, A2, A5`.
Quick setup can build an aisle-style map (A1, A2… B1, B2…) in one go.
**Make a map from my bins** builds the map straight from the bins in your
inventory and orders: one unit per aisle, boxes in number order. Bins that aren't
on the map yet are marked "not on map" and still listed by aisle and number.

## The list is remembered

The current list stays on the phone (or computer) until it's cleared: the orders,
every tick on the pick and unpack lists, and where you were in step by step
(including skipped items). Close the app or the browser and open it again, and it
says "Picked up where you left off" and carries on from the same step.
**✕ Clear list & start new** (tap twice) wipes it, ready for the next orders.
Choosing new order files also replaces it. If the shelf map changes so the pick
order is different, the orders are kept but the ticks start again.

## Settings: Map and Order

Settings opens with two buttons:

- **Map**: the store's layout. It lists the aisles (e.g. "Aisle C · 6 shelves high
  · C1 – C96"), with **Edit** for one aisle, **+ Add an aisle** and **Change all**.
  Each of those asks only: how many aisles (Change all), the aisle's letter, how
  many shelves high, then **the box at the left end of each shelf, top to bottom**
  and **the box at the right end of each shelf, top to bottom**. Once a pattern is
  clear the rest is filled in (shown in grey to check). From those numbers the app
  works out where box 1 is and whether the numbers go along the shelves or down
  the columns. If something doesn't add up it asks one question at a time, with
  the likely answers as buttons (including "Where is C2: next to C1 or under it?"
  when it can't tell).
  Filling in happens only for empty boxes: after that, every change (typing, − / +)
  changes just that one box. Every shelf end has − / + to nudge it by one. Shelves of different lengths are
  worked out from the numbers (e.g. 33 boxes on each shelf but the bottom one has
  32, so it ends a column early), and the app notes which shelves are shorter.
  Along the shelves the two ends say it all, so there are no questions about
  lengths (a gap like 1–5, then 7… still asks "Where is C6?"). Down the columns
  the last shelf in number order ending early is fine as it is, and a shelf
  ending early anywhere else gets "Is that right?".
  **Wide boxes:** when every shelf reaches the end but the numbers come out one
  box short, one box takes up two spaces, and the app finds which one by asking
  "Which shelf is C99 on?" a few times (each answer halves where it can be),
  then "Then C57 on shelf 3 is the wide one. Is that right?". If he can see the
  wide box he can just type it instead. The map then shows that box two spaces
  wide (C57 ↔), and the picking order and the picture of it follow.
- **Order**: which aisle first, how to pick (for every aisle at once, or one
  aisle only), with a picture of the picking order.

**More** has order numbers, backup, the look, getting the app, and **Advanced**
(everything on one page, including editing shelves one by one).

## Setting up the shelves and the picking order

**Aisles (how they really are).** Each aisle is one shelving unit with one
letter, and its boxes are numbered across all its shelves (A1–A10 on the top
shelf, A11–A20 on the next…). For each aisle fill in:

- **Aisle letter**, **Shelves**, **Boxes per shelf** (one number, or one per
  shelf from the top when they differ: `10, 10, 12, 8`), **First number**
- **Numbers go** along each shelf (A2 beside A1) or **down each column** (A2 under A1,
  A3 under A2… then the next column)
- **Numbers run** / **Columns go** left → right or right → left
- **Numbering starts on** the top shelf or the bottom shelf (for columns: each column
  starts at the top or the bottom)

Or set **Shelf numbers → I'll type each shelf's first and last box**: type
the box at each end of every shelf (top shelf C1 to C91, shelf 2 C2 to C92…).
With numbers going down the columns, each shelf counts up by the number of
shelves (C1, C7, C13 … with 6 shelves); along a shelf every number in between is
there. An end that doesn't fit is pointed out with the likely right number.

The app works out every shelf's boxes and shows them ("A1 – A50"). **Quick
setup** makes several aisles (A, B, C…) the same way in one go; **Make a map
from my bins** fills in each aisle's first and last box from your files. For an
odd aisle, "Edit the shelves one by one" lets you type each shelf's boxes and
which end its first number is on.

**Picking order (per unit, or once for every unit):**

- **Start from** the left end or the right end. Starting on the right of a
  shelf numbered from the left means starting at the high numbers.
- **Order:** shelf by shelf (top first or bottom first), up and down one box
  across at a time, or **sections** of a few boxes on each shelf, then the
  shelf below, then the next section.
- **Inside each section:** the same way you're walking (start right, 3 at a
  time: 50, 49, 48) or the other way (48, 49, 50).
- **Zigzag:** shelf by shelf back and forth, or columns down then up.
- Sections and zigzag skip anything not on the order automatically.

**Show the picking order** draws the unit's shelves with every box's turn
number, so you can check it at a glance. **Walking order** sets which unit or
aisle comes first.

## Internet

The page loads two free helper libraries the first time (for making PDFs and
for reading Excel files). After that the browser usually caches them. CSV
files and the Print button work without them.

## Android app (APK)

`android/` is a small Android app that shows this same page, built in, with no
internet needed and no internet permission. Everything stays on the phone:

- The shelf setup is saved in a file inside the app's private storage. It stays
  through restarts and app updates. It's only removed if the app is uninstalled
  or its data is cleared in Android settings. "Settings → Save settings file"
  makes a backup copy.
- PDFs are saved to **Downloads › Pick and Sort** (Android 10+) and opened in the
  phone's PDF viewer, where they can be printed or shared.
- Works on Android 8.0 and newer.

### Building it

Needs Java 17+ and the Android SDK (platform 35, build-tools 35).

1. Put the signing key details in `android/keystore.properties` (never commit it):

   ```
   storeFile=/path/to/pick-and-sort.jks
   storePassword=...
   keyAlias=picksort
   keyPassword=...
   ```

2. `cd android && ./gradlew assembleRelease`
3. The app is at `android/app/build/outputs/apk/release/app-release.apk`.

The build copies `../index.html` into the app automatically, so changes to the
page show up in the next build. **Always sign updates with the same key**:
Android refuses an update signed with a different key, and the only way round
that is uninstalling, which erases the saved shelf setup. For an update, also
raise `versionCode` in `android/app/build.gradle`.

## iPhone / iPad app

`ios/` is the same idea for iPhone and iPad (iOS 15+): a small Swift app that
shows the bundled page, fully offline. The shelf setup is saved in a file on the
device; PDFs open in a preview with **Share / Print / Save to Files**, and a
copy is kept in the app's folder in the Files app ("On My iPhone › Pick & Sort").

Apple only lets iPhone apps be built on a Mac, so GitHub builds it: the
**Pick & Sort apps** workflow (`.github/workflows/pick-and-sort-apps.yml`) runs
on every change. It builds the app, runs an automatic check in the iPhone
simulator (loads the example orders, makes both PDFs, saves settings), and
uploads **PickAndSort-unsigned.ipa** under the run's *Artifacts*.

An iPhone only installs an app that's been signed with an Apple account:

- **Free Apple ID, for your own devices:** install the unsigned .ipa with a
  sideloading tool such as Sideloadly or AltStore on a computer. With a free
  Apple ID the app has to be re-signed every 7 days (AltStore can do this
  automatically). The saved shelf setup survives re-signing.
- **Apple Developer Program (US$99/year), to give it to other people:**
  distribute through TestFlight (up to 10,000 people, via a link) or the App
  Store. This needs the account's signing certificate added to the workflow.

To build on a Mac yourself: `brew install xcodegen`, then in `ios/` run
`./prepare-web.sh && xcodegen generate` and open `PickAndSort.xcodeproj` in Xcode.

## Website you host yourself (installable, works offline)

`web/build.sh` builds `web/dist/`: the same page plus what a phone needs to
install it to the home screen and keep working with no internet (a manifest,
icons and a service worker that stores the app on the device). Host `web/dist`
on any free static host: GitHub Pages, Render, Netlify...

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → menu → **Install app** / **Add to Home screen**.

Data (shelf setup, orders) stays in that phone's storage; the website only
delivers the app. On iPhone the home-screen app keeps its own storage, separate
from Safari, so set it up (or load a settings file) after adding it. PDFs open
the iPhone share menu (Save to Files, Print).

Render: New → Static Site → this repo, build command
`sh warehouse-picker/web/build.sh`, publish directory `warehouse-picker/web/dist`.

## Automatic builds: website, Android and iPhone together

Every change to `warehouse-picker/` runs **Pick & Sort apps**
(`.github/workflows/pick-and-sort-apps.yml`):

1. **iPhone/iPad:** built on a Mac and checked in the iPhone simulator.
2. **Android:** built and signed with your key, with a higher version number
   each time (so it installs as an update and keeps the saved shelf setup).
3. **Website:** rebuilt, with the newest `PickAndSort.apk` and
   `PickAndSort-unsigned.ipa` added for download (Settings → Get the app),
   then published to the `gh-pages` branch.

One-time setup on GitHub:

- **Settings → Pages →** Source *Deploy from a branch*, Branch **gh-pages** / **(root)** → Save.
  The site is then at `https://<owner>.github.io/<repo>/`.
- **Settings → Secrets and variables → Actions →** add `ANDROID_KEYSTORE_BASE64`
  (the .jks file, base64-encoded) and `ANDROID_KEYSTORE_PASSWORD`. Without
  them the Android app is still built, but not signed or published.
