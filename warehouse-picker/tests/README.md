# Tests

`slip-reading.test.js` draws 60 packing slips laid out like the real ones
(order number, picture, item name that wraps, SKU, barcode, Bin and Quantity
columns, "Total items") in five different layouts, reads them back with the
app, and compares every order number, name, colour/size, SKU, barcode, bin and
quantity with what was printed. It prints `mistakes: 0` when everything matches.

    cd warehouse-picker && python3 -m http.server 8765 &
    node tests/slip-reading.test.js   # needs Playwright (npm i playwright)
