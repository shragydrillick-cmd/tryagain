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

## The shelf map

Each shelving unit can have its own number of shelves. For each shelf, type its
boxes from left to right: a run like `A1-A10`, or a list like `A1, A2, A5`.
Quick setup can build an aisle-style map (A1, A2… B1, B2…) in one go.

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
