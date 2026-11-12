// Draws packing slips laid out like the photo (Letter page, points). Runs in the browser with jsPDF.
window.makeSlips = function (orders, opts = {}) {
  const doc = new jspdf.jsPDF({ unit: 'pt', format: opts.a4 ? 'a4' : 'letter' });
  const X = { name: 112, thumb: 80, bin: 392, binHead: 395, qty: 497, qtyHead: 470 }, NAME_W = opts.nameW || 262, LH = opts.lh || 14, BOTTOM = 740, FS = opts.fs || 10.5;
  let first = true;
  const head = (o, cont) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); if (!o.noNumber) doc.text(`Order #${o.number}`, 446, 52);
    for (let i = 0; i < 40; i += 2) doc.rect(446 + i * 1.8, 58, i % 3 ? 1.2 : 2.2, 26, 'F'); // barcode picture
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('November 11, 2026', 436, 100);
    if (cont) return 130;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('MOONLIGHT', 52, 95);
    doc.setFontSize(10); doc.text('Delivery method:', 58, 140);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize('Brooklyn Next Day Delivery - Monday to Thursday cut off 12 PM. No deliveries Friday, Saturday, & Sunday', 470), 142, 140);
    doc.setFont('helvetica', 'bold'); doc.text('Ship to', 62, 190); doc.text('Bill to', 222, 182); doc.text('Warehouse from', 380, 176);
    doc.setFont('helvetica', 'normal');
    ['Test Customer', '100 Sample Street', 'Brooklyn', 'New York, 11200', 'United States', '+10000000000'].forEach((t, i) => { doc.text(t, 64, 205 + i * 14); doc.text(t, 224, 198 + i * 14); });
    doc.text('Moonlight Layette', 382, 191);
    doc.line(72, 300, 545, 288);
    return 310;
  };
  const tableHead = y => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Bin', X.binHead, y); doc.text(opts.qtyWord || 'Quantity', X.qtyHead, opts.sameLineHeader ? y : y - 4);
    doc.text('Items', opts.sameLineHeader ? 50 : 76, opts.sameLineHeader ? y : y + 22);
    return y + (opts.sameLineHeader ? 26 : 48);
  };
  orders.forEach(o => {
    if (!first) doc.addPage(); first = false;
    let y = tableHead(head(o, false));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(FS);
    o.items.forEach(it => {
      const nameLines = doc.splitTextToSize(it.variant ? `${it.title} - ${it.variant}` : it.title, NAME_W);
      const lines = [...nameLines, ...(it.sku ? [it.sku] : []), ...(it.barcode ? [it.barcode] : [])];
      const h = lines.length * LH;
      if (y + h > BOTTOM) { // carries on onto the next page
        doc.addPage();
        y = o.repeatHeader ? tableHead(head(o, true)) : (o.repeatTable ? tableHead(60) : 60);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(FS);
      }
      doc.setFillColor(150); doc.rect(X.thumb, y + 2, 22, 22, 'F'); doc.setDrawColor(255); doc.line(X.thumb, y + 24, X.thumb + 22, y + 2); doc.setDrawColor(0); // picture
      lines.forEach((t, i) => doc.text(t, X.name, y + i * LH));
      if (it.bin) doc.text(it.bin, X.bin, y + LH * (opts.binDy ?? 0.55));
      if (it.qty != null) doc.text(String(it.qty), X.qty, y + LH * (opts.qtyDy ?? 0.15));
      y += h + (opts.itemGap ?? 12);
    });
    if (y + 40 > BOTTOM) { doc.addPage(); y = 80; }
    doc.line(92, y, 560, y - 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    if (!o.noTotal) doc.text(`Total items: ${o.total ?? o.items.reduce((a, i) => a + (i.qty ?? 1), 0)}`, 482, y + 14);
    doc.line(92, y + 40, 565, y + 32);
  });
  return doc.output('arraybuffer');
};
