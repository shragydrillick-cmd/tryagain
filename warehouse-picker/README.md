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

## The orders file

One line per item works best:

| Order | Box | Item             | Details | Qty |
|-------|-----|------------------|---------|-----|
| 10452 | 1A  | Blue ceramic mug | 12 oz   | 1   |
| 10452 | 3B  | Notebook         | Lined   | 2   |
| 10452 | 1A  | Mug coaster      | Cork    | 1   |

- **Box** is the number on the shelf box (like 1A). It decides the walking order.
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

## The shelf map

Each shelving unit can have its own number of shelves. For each shelf, type its
boxes from left to right: a run like `1A-10A` or `1-25`, or a list like
`1A, 2A, 5A`.

## Ways to walk a shelving unit

- **Shelf by shelf, top shelf first** (or bottom shelf first)
- **Up and down:** first spot on every shelf top to bottom, then the next spot
- **Sections:** e.g. 5 spots on the top shelf, the same 5 on the shelf below,
  and so on down, then move along. Empty sections are just skipped.

Each unit can also go left→right or right→left, and the units can be visited
in any order.

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
