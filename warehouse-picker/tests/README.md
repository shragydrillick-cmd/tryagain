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
