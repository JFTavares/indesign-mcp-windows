import { WindowsBridge } from '../lib/windows-bridge.js';
try {
  console.log(`Node ${process.version}; platform ${process.platform}; ProgID ${process.env.INDESIGN_PROGID || 'InDesign.Application'}`);
  const result = await new WindowsBridge().execute('"InDesign " + app.version + "; documents open: " + app.documents.length;');
  console.log(result);
  console.log('Windows COM + ExtendScript + UTF-8: OK');
  console.log('PDF presets: ' + await new WindowsBridge().execute('app.pdfExportPresets.everyItem().name.join("; ");'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
