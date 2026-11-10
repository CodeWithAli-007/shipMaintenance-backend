import { mkdir, writeFile } from 'node:fs/promises';
import { renderReport } from '../src/reports/pdf.js';
import { sampleReport } from '../src/samples/report-data.js';

const output = new URL('../../output/pdf/report-template-sample.pdf', import.meta.url);
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, await renderReport(await sampleReport()));
console.log(`Created ${output.pathname}`);
