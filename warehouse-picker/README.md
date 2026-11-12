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
- The **pick list** shows box + item. The **unpack list** shows only the item
  and which order it goes to.
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
