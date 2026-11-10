import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { renderReport } from '../src/reports/pdf.js';
import { reportContentSchema, type ReportData } from '../src/reports/model.js';

const dir = new URL('../../demo-data/engine-issue/', import.meta.url);
const output = new URL('ai-analysis-report-template.pdf', dir);

const content = reportContentSchema.parse({
  manufacturer: '6L20 type diesel',
  serialNumber: 'Not provided',
  runningHours: 'Inj. cyl 4: 2,950 h',
  remarks: [
    { heading: 'Finding analysis', paragraphs: [
      'Auxiliary Engine No. 2 showed an exhaust gas temperature of 468 °C after cylinder 4 at ~75 % load (900 kW), 83–92 °C above the other cylinders, with black smoke above 70 % load. Lube oil pressure (4.6 bar) and HT water outlet (88 °C) were normal.',
      'Compression pressure on cylinder 4 (119 bar) matched the other units (118–121 bar), while Pmax was low (149 bar vs 167–170 bar). Equal fuel rack positions (31 mm) ruled out a fuel pump setting fault. This pattern indicates poor atomisation and late combustion rather than a mechanical sealing problem.',
    ] },
    { heading: 'Root cause', paragraphs: [
      'The cylinder 4 fuel injector was ~950 h overdue for overhaul (2,950 h vs 2,000 h interval; missed in the PMS round). The removed nozzle showed a heavy carbon trumpet with 2 of 9 spray holes partly blocked. Bench test: opening pressure 385 bar (spec 450 ±10 bar), streaky spray with dribbling, and leakage after closing.',
    ] },
    { heading: 'Key observations', paragraphs: [
      '- Exhaust valve head and seat area carry combustion deposits with slight edge discolouration; no cracks or burn-through observed via the injector bore.',
      '- Piston crown appeared normal; no fuel wash marks on the liner.',
      '- No other cylinder showed abnormal readings before or after the repair.',
    ] },
    { heading: 'Actions taken', paragraphs: [
      '- Cylinder 4 injector replaced with an overhauled spare from ship store, bench-tested at 452 bar with a fine, even spray and no drip.',
      '- Injector nuts torqued to manual value and paint-marked; HP fuel pipe reconnected and leak-checked; engine turned on air with indicator cocks open.',
      '- Stepped trial run at 25 / 50 / 75 % load, followed by a 4 h endurance run at 75–80 % load.',
      '- PMS counter for cylinder 4 injector reset to 0 h; remaining AE2 injectors verified at 1,400–1,650 h (within interval).',
    ] },
    { heading: 'Combined media overview', paragraphs: [
      'Six photographs document the engine, the elevated cylinder 4 pyrometer reading, the carbon-fouled nozzle, the defective spray pattern on the test bench, exhaust valve deposits and the newly fitted injector.',
    ] },
  ],
  measurements: [
    { title: 'EXHAUST GAS TEMPERATURE AFTER CYLINDERS – BEFORE REPAIR (75 % LOAD, 900 kW)', columns: ['Cyl. no.', '1', '2', '3', '4', '5', '6'], rows: [
      ['Exhaust temp. (°C)', '382', '376', '385', '468', '379', '381'],
      ['Pmax (bar)', '168', '170', '167', '149', '169', '168'],
      ['Compression (bar)', '120', '121', '118', '119', '120', '119'],
      ['Fuel rack (mm)', '31', '31', '31', '31', '31', '31'],
    ], notes: 'TC inlet 512 °C, TC outlet 348 °C. Lube oil pressure 4.6 bar, HT water out 88 °C. Measured by: P. Hoffmann / T. Berger, 02.10.2026. Compression values for cylinders other than 4 are reported as the 118–121 bar range.' },
    { title: 'FUEL INJECTOR CYL. 4 – BENCH TEST', columns: ['Parameter', 'Removed injector', 'Spare injector', 'Specification'], rows: [
      ['Opening pressure', '385 bar', '452 bar', '450 ±10 bar'],
      ['Spray pattern', 'Single jet + dribbling', 'Fine, even cone', 'Even atomisation'],
      ['Tightness after closing', 'Drips within 5 s', 'No drip', 'No drip'],
      ['Spray holes', '2 of 9 partly blocked', 'All clear', 'All clear'],
      ['Running hours', '2,950 h', 'Overhauled', 'Overhaul at 2,000 h'],
    ], notes: 'Tested on manual injector test pump. Removed injector sent ashore for overhaul.' },
  ],
  graphs: [{
    title: 'Exhaust gas temperature per cylinder – before vs after injector replacement (75 % load)',
    unit: '°C',
    labels: ['1', '2', '3', '4', '5', '6'],
    series: [
      { name: 'Before repair (02.10.2026)', values: [382, 376, 385, 468, 379, 381] },
      { name: 'After repair (03.10.2026)', values: [380, 377, 386, 384, 376, 381] },
    ],
  }],
  trials: [
    { title: 'STEPPED LOAD TRIAL AFTER INJECTOR REPLACEMENT', columns: ['Load', 'Power (kW)', 'Exhaust range (°C)', 'Cyl. 4 exhaust (°C)', 'Cyl. 4 Pmax (bar)', 'Others Pmax (bar)'], rows: [
      ['25 %', '300', '270–282', '276', '-', '-'],
      ['50 %', '600', '325–336', '331', '132', '130–134'],
      ['75 %', '900', '376–386', '384', '167', '167–170'],
    ], notes: 'TC inlet at 75 % load: 489 °C (before repair: 512 °C). No visible smoke. Cylinder spread within 10 °C. Cylinder 4 after-repair value in the graph is from this trial; other cylinders are representative of the reported 376–386 °C range.' },
    { title: 'ENDURANCE RUN (4 h)', columns: ['Parameter', 'Reading'], rows: [
      ['Load', '75–80 %'],
      ['Cyl. 4 exhaust temperature', '381–388 °C'],
      ['Cylinder spread', 'Within 12 °C'],
      ['Smoke / leaks', 'None'],
    ], notes: 'Completed 03.10.2026, 15:55. AE2 released to normal service.' },
  ],
  recommendations: [
    'Re-inspect the cylinder 4 exhaust valve and seat at the next 500 running hours.',
    'Audit injector running hours on all auxiliary engines against the 2,000 h PMS interval.',
    'Replenish spare injector stock / order one injector overhaul kit.',
    'Trend exhaust temperature deviation per cylinder; raise an alarm when deviation exceeds 50 °C from the mean.',
  ],
});

const photos = [
  ['01-ae2-engine-overview.jpg', 'Auxiliary Engine No. 2 general view, engine room lower platform. No visible leaks or external damage.'],
  ['02-cyl4-exhaust-temperature.jpg', 'Cylinder 4 exhaust pyrometer reading ~470 °C, well above the other cylinders (376–385 °C).'],
  ['03-cyl4-injector-carbon.jpg', 'Removed cylinder 4 injector with heavy carbon trumpet on the nozzle tip; spray holes partly blocked.'],
  ['04-cyl4-injector-spray-test.jpg', 'Bench pop test of removed injector: uneven single jet and dribbling instead of a fine atomised cone.'],
  ['05-cyl4-exhaust-valve-deposits.jpg', 'Combustion deposits on exhaust valve head and seat area; slight edge discolouration, no cracks.'],
  ['06-cyl4-new-injector-fitted.jpg', 'Overhauled spare injector fitted, HP pipe reconnected and nut paint-marked.'],
] as const;

const data: ReportData = {
  company: { name: 'Ship Maintenance', address: 'Technical Department\nHamburg, Germany', contact: 'E-mail: technical@ship.local' },
  vessel: 'MV NORDIC STAR', workNumber: 'PRJ-DEMO-AE2', datePlace: '02–03.10.2026 / Rotterdam',
  machinery: 'AE2 (Aux. Engine No. 2)', equipmentType: '6L20 genset, 1,200 kW',
  title: 'AE2 – High exhaust temperature on cylinder 4', preparedBy: 'Emma Weber',
  client: 'Nordic Star Shipping GmbH', analysisDate: '2026-10-03', analysisId: 'TEMPLATE', sample: true,
  content,
  evidence: await Promise.all(photos.map(async ([file, summary], index) => ({
    label: `R${index + 1}`, name: file, type: 'IMAGE', summary,
    image: await sharp(await readFile(new URL(`images/${file}`, dir))).resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
  }))),
};

await writeFile(output, await renderReport(data));
console.log(`Created ${output.pathname}`);
