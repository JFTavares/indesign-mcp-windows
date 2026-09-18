import assert from 'node:assert/strict';
import { InDesignMCPServer } from '../index.js';
import { WindowsBridge } from '../lib/windows-bridge.js';

// Real InDesign regression: only temporary documents created here are closed.
const bridge = new WindowsBridge();
const server = new InDesignMCPServer({ bridge });
const previousId = Number(await bridge.execute('app.documents.length ? app.activeDocument.id : -1;'));
let ownedId;
const expected = [50, 17, 30, 11];
async function inspect() {
  return JSON.parse(await bridge.execute(`(function () {
    var d = app.documents.itemByID(${ownedId});
    var previous = app.scriptPreferences.measurementUnit;
    app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
    try {
      var rows = [];
      function row(p) {
        var m = p.marginPreferences;
        rows.push('[' + [m.top, m.bottom, m.left, m.right].join(',') + ']');
      }
      for (var i = 0; i < d.pages.length; i++) row(d.pages[i]);
      for (var j = 0; j < d.masterSpreads.length; j++)
        for (i = 0; i < d.masterSpreads[j].pages.length; i++) row(d.masterSpreads[j].pages[i]);
      return '[' + rows.join(',') + ']';
    } finally { app.scriptPreferences.measurementUnit = previous; }
  }());`));
}
try {
  for (const facingPages of [false, true]) {
    const result = await server.createDocument({ pages: 3, facingPages,
      marginTop: 50, marginBottom: 17, marginLeft: 30, marginRight: 11 });
    assert.equal(result.isError, false, JSON.stringify(result));
    ownedId = Number(await bridge.execute('app.activeDocument.id;'));
    let rows = await inspect();
    console.log(`facingPages=${facingPages}: actual page/parent margins (mm) ${JSON.stringify(rows)}`);
    console.log((await server.getDocumentInfo()).content[0].text);
    for (const row of rows) row.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 0.001,
      `Expected ${expected} mm, got ${row} mm (facingPages=${facingPages})`));
    if (facingPages) {
      // Ask InDesign itself to fit guides to margins: this detects double mirroring.
      const guides = JSON.parse(await bridge.execute(`(function () {
        var d = app.documents.itemByID(${ownedId}), previous = app.scriptPreferences.measurementUnit;
        app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
        try {
          d.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
          d.zeroPoint = [0, 0];
          for (var i = 0; i < d.spreads.length; i++) d.spreads[i].createGuides(1, 2, 0, 0, UIColors.CYAN, true, true);
          var rows = [];
          for (i = 0; i < d.pages.length; i++) {
            var values = [], p = d.pages[i];
            for (var j = 0; j < p.guides.length; j++)
              if (p.guides[j].orientation == HorizontalOrVertical.VERTICAL) values.push(p.guides[j].location);
            values.sort(function (a, b) { return a - b; });
            rows.push('[' + values.join(',') + ']');
          }
          return '[' + rows.join(',') + ']';
        } finally { app.scriptPreferences.measurementUnit = previous; }
      }());`));
      for (let p = 0; p < guides.length; p++) {
        const expectedGuides = p % 2 === 0 ? [30, 114.5, 199] : [11, 95.5, 180];
        assert.equal(guides[p].length, expectedGuides.length);
        guides[p].forEach((value, i) => assert.ok(Math.abs(value - expectedGuides[i]) < 0.001, `Incorrect mirrored guide on page ${p + 1}: ${value}`));
      }
    }
    assert.equal((await server.addPage({})).isError, false);
    rows = await inspect();
    for (const row of rows) row.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 0.001,
      `New page/parent did not retain margins: ${row}`));
    await bridge.execute(`(function () {
      var d = app.documents.itemByID(${ownedId});
      d.pages[1].marginPreferences.top = '43mm';
      d.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
      d.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
    }());`);
    const info = (await server.getDocumentInfo()).content[0].text;
    assert.match(info, /DOCUMENT DEFAULT MARGINS \(mm\)/);
    assert.match(info, /PAGE MARGINS \(mm\)/);
    assert.match(info, /Page 2[^\n]*Top=43 mm[^\n]*differs from document defaults/);
    if (facingPages) assert.match(info, /Page 2[^\n]*Left=11 mm; Right=30 mm; Inside=30 mm; Outside=11 mm/);
    await bridge.execute(`app.documents.itemByID(${ownedId}).close(SaveOptions.NO);`);
    ownedId = undefined;
  }
  console.log('PASS: actual page/parent margins, newly added pages, facing-page reporting and per-page overrides.');
} finally {
  if (ownedId !== undefined) await bridge.execute(`var d = app.documents.itemByID(${ownedId}); if (d.isValid) d.close(SaveOptions.NO);`);
  if (previousId !== -1) await bridge.execute(`var d = app.documents.itemByID(${previousId}); if (d.isValid) app.activeDocument = d;`);
  await server.server.close();
}
