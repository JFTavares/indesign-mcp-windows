import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { InDesignMCPServer } from '../index.js';

// Documents, parent pages and pages have independent margin preferences.
// Native inheritance/mirroring is also checked by test:indesign:margins.
function fixture() {
  const app = { documents: [], scriptPreferences: { measurementUnit: 'points' } };
  function margins(initial = [12.7, 12.7, 12.7, 12.7]) {
    const result = {};
    ['top', 'bottom', 'left', 'right'].forEach((key, i) => {
      let mm = initial[i];
      Object.defineProperty(result, key, {
        get: () => app.scriptPreferences.measurementUnit === 'mm' ? mm : mm * 72 / 25.4,
        set: value => { mm = typeof value === 'string' ? parseFloat(value) : value; },
        configurable: true,
      });
    });
    Object.defineProperty(result, 'properties', { set: values => Object.assign(result, values) });
    return result;
  }
  function page(side, name) {
    return { side, name, marginPreferences: margins(), textFrames: [], rectangles: [], ovals: [], polygons: [] };
  }
  app.documents.add = () => {
    const pages = [page('right', '1')];
    const prefs = { facingPages: false };
    for (const key of ['pageWidth', 'pageHeight']) {
      let value = 0;
      Object.defineProperty(prefs, key, { get: () => value, set: input => { value = parseFloat(input); } });
    }
    Object.defineProperty(prefs, 'pagesPerDocument', { set: count => {
      while (pages.length < count) pages.push(page(prefs.facingPages && pages.length % 2 ? 'left' : 'right', String(pages.length + 1)));
    } });
    const doc = { name: 'Test', pages, documentPreferences: prefs, viewPreferences: {}, marginPreferences: margins(),
      masterSpreads: [{ pages: [page('left', 'A'), page('right', 'A')] }], modified: false, saved: false, layers: [], swatches: [] };
    app.documents.push(doc);
    app.activeDocument = doc;
    return doc;
  };
  const context = vm.createContext({ app, MeasurementUnits: { MILLIMETERS: 'mm' }, PageSideOptions: { LEFT_HAND: 'left', RIGHT_HAND: 'right' } });
  const server = new InDesignMCPServer({ bridge: { execute: async script => vm.runInContext(script, context) } });
  function actual(prefs) {
    const before = app.scriptPreferences.measurementUnit;
    app.scriptPreferences.measurementUnit = 'mm';
    try { return ['top', 'bottom', 'left', 'right'].map(key => prefs[key]); }
    finally { app.scriptPreferences.measurementUnit = before; }
  }
  return { server, app, actual };
}

for (const facingPages of [false, true]) {
  test(`create_document sets actual page and parent margins (facingPages=${facingPages})`, async () => {
    const { server, app, actual } = fixture();
    try {
      await server.createDocument({ pages: 3, facingPages, marginTop: 50, marginBottom: 17, marginLeft: 30, marginRight: 11 });
      const d = app.activeDocument;
      assert.deepEqual(actual(d.marginPreferences), [50, 17, 30, 11]);
      for (const p of [...d.pages, ...d.masterSpreads.flatMap(m => m.pages)])
        assert.deepEqual(actual(p.marginPreferences), [50, 17, 30, 11]);
    } finally { await server.server.close(); }
  });
}

test('get_document_info distinguishes defaults, page overrides and physical facing-page margins in mm', async () => {
  const { server, app } = fixture();
  try {
    await server.createDocument({ pages: 3, facingPages: true, marginTop: 50, marginBottom: 17, marginLeft: 30, marginRight: 11 });
    app.activeDocument.pages[1].marginPreferences.top = '43mm';
    const info = (await server.getDocumentInfo()).content[0].text;
    assert.match(info, /DOCUMENT DEFAULT MARGINS \(mm\)/);
    assert.match(info, /Top: 50 mm/);
    assert.match(info, /Page 1[^\n]*Left=30 mm; Right=11 mm; Inside=30 mm; Outside=11 mm/);
    assert.match(info, /Page 2[^\n]*Top=43 mm[^\n]*Left=11 mm; Right=30 mm; Inside=30 mm; Outside=11 mm[^\n]*differs from document defaults/);
    assert.equal(app.scriptPreferences.measurementUnit, 'points');
    Object.defineProperty(app.activeDocument.pages[0].marginPreferences, 'top', { get() { throw Error('read failed'); } });
    await assert.rejects(server.getDocumentInfo(), /read failed/);
    assert.equal(app.scriptPreferences.measurementUnit, 'points');
  } finally { await server.server.close(); }
});

test('default and zero margins are applied to existing pages', async () => {
  const { server, app, actual } = fixture();
  try {
    await server.createDocument({});
    assert.deepEqual(actual(app.activeDocument.pages[0].marginPreferences), [20, 20, 20, 20]);
    await server.createDocument({ marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    assert.deepEqual(actual(app.activeDocument.pages[0].marginPreferences), [0, 0, 0, 0]);
  } finally { await server.server.close(); }
});
