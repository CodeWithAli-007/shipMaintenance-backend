import { readFile } from 'node:fs/promises';
import { reportContentSchema, type ReportData } from '../reports/model.js';

/** Reusable template fixture. Readings below are transcribed from the supplied sample, not live analysis. */
export async function sampleReport(): Promise<ReportData> {
  const content = reportContentSchema.parse({
    manufacturer: 'MAK', serialNumber: '38236', runningHours: '89090',
    remarks: [
      { heading: 'ME no. 2 SB side MAK 8M32C', paragraphs: ['Reference-layout demonstration using the supplied MOROCCO STAR overhaul report. This sample is not a new inspection or an engineering approval.'] },
      { heading: 'Apply to cylinder heads:', paragraphs: [
        'Eight cylinder heads were removed from the engine and transported from the vessel to the shipyard workshop for overhaul and inspection. All cylinder heads were completely disassembled and thoroughly cleaned.',
        'The following work was carried out on all cylinder heads:',
        '- O-rings on the injector sleeves were renewed.\n- Inlet and exhaust valve seats were machined and lapped to restore proper sealing conditions.\n- Starting valves were internally cleaned, inspected and fitted with new gaskets.',
        'Cylinder head no. 4 was found with an internal crack and was replaced with another unit sourced from vessel spare parts.',
        'The cylinder heads were subjected to pressure testing at 10 bar. Testing was reported as satisfactory in the supplied reference. Valve clearances were adjusted as required.',
        'Rocker arm bushes were renewed. Wear ridges on rocker arm pins were removed using a stone; final polishing was completed to restore smooth bearing surfaces.',
        'The rocker arms were assembled on the engine, aligned and secured. The cylinder heads were assembled and installed on the engine.',
      ] },
      { heading: 'Apply to cylinder liners:', paragraphs: [
        'All eight cylinder liners were removed and transported to the shipyard workshop for overhaul and inspection. The liners were cleaned, inspected and honed.',
        'Liners nos. 2, 4, 5, 6, 7 and 8 were calibrated. Liners nos. 1 and 3 were replaced. After workshop overhaul the liners were reinstalled on new seals, with positioning and seating verified.',
      ] },
      { heading: 'Apply to engine block and cooling jackets:', paragraphs: [
        'The engine block was cleaned. Cylinder liner landing surfaces were hand-lapped to improve surface finish and seating conditions.',
        'Cooling jackets were dismantled and transported to the workshop. Scale, corrosion products and deposits were removed before reassembly.',
      ] },
      { heading: 'Apply to pistons:', paragraphs: ['Eight pistons were dismantled and transported to the workshop for overhaul and inspection. All pistons were measured.'] },
    ],
    measurements: [
      { title: 'MEASUREMENTS OF CRANKSHAFT DEFLECTION REPORT', columns: ['Cyl. no.', '1', '2', '3', '4', '5', '6', '7', '8'], rows: [
        ['Bottom start X', '0', '0', '0', '0', '0', '0', '0', '0'],
        ['Port side P', '-3', '-1', '1', '1', '1', '1', '-1', '0'],
        ['Top T', '-7', '-2', '3', '4', '2', '2', '1', '1'],
        ['Starboard S', '-4', '-2', '2', '3', '1', '2', '1', '1'],
        ['Bottom stop Y', '0', '0', '0', '2', '0', '1', '0', '0'],
        ['Bottom total B', '0', '0', '0', '1', '0', '0.5', '0', '0'],
        ['Vertical T-B', '-7', '-2', '3', '3', '2', '1.5', '1', '1'],
        ['Horizontal P-S', '1', '1', '-1', '-2', '0', '-1', '-2', '-1'],
      ], notes: 'Unit: 1/100 mm (0.01 mm). Reference page 8. Before overhaul; cold engine; flywheel side. Recorded limits: all cylinders +6 / -8. Measured by: Kraczkowski D. Instrument: vessel dial deflection gauge.' },
      { title: 'MEASUREMENT REPORT OF THE LINERS', columns: ['Position', 'Direction', '1', '2', '3', '4', '5', '6', '7', '8'], rows: [
        ['A', 'fore-aft', 'X', '320.14', 'X', '320.15', '320.10', '320.15', '320.30', '320.15'],
        ['A', 'stb-port', 'X', '320.04', 'X', '320.15', '320.10', '320.15', '320.30', '320.15'],
        ['B', 'fore-aft', 'X', '320.07', 'X', '320.10', '320.05', '320.02', '320.15', '320.07'],
        ['B', 'stb-port', 'X', '320.07', 'X', '320.10', '320.05', '320.02', '320.15', '320.07'],
        ['C', 'fore-aft', 'X', '320.05', 'X', '320.05', '320.00', '320.00', '320.10', '320.01'],
        ['C', 'stb-port', 'X', '320.05', 'X', '320.05', '320.00', '320.00', '320.10', '320.01'],
        ['D', 'fore-aft', 'X', '320.02', 'X', '320.02', '320.00', '320.00', '320.01', '320.01'],
        ['D', 'stb-port', 'X', '320.02', 'X', '320.02', '320.00', '320.00', '320.02', '320.01'],
      ], notes: 'Dimensions in mm. Reference page 14. Nominal diameter: 320 mm. Wear limit: 1.00 mm. Maximum ovality: 0.30 mm. After honing / after overhaul. X denotes a replaced liner. Instrument: inside micrometer MTS/A/072.' },
    ],
    graphs: [{ title: 'Crankshaft deflection - GRAPH', unit: '0.01 mm; reference page 8', labels: ['1', '2', '3', '4', '5', '6', '7', '8'], series: [
      { name: 'Vertical deflection T-B', values: [-7, -2, 3, 3, 2, 1.5, 1, 1] },
      { name: 'Horizontal deflection P-S', values: [1, 1, -1, -2, 0, -1, -2, -1] },
    ] }],
    trials: [{ title: 'Recorded operating conditions', columns: ['Parameter', 'Reading', 'Unit'], rows: [
      ['Revolution', '500', 'RPM'], ['Oil pressure', '6', 'bar'], ['Oil temperature', '52', 'C'],
      ['Fresh water pressure', '3.5', 'bar'], ['Fresh water temperature', '42', 'C'],
      ['Charging pressure', '0', 'bar'], ['Fuel pressure', '4.5', 'bar'],
    ], notes: 'Reference page 25. Values reproduced to demonstrate the trials layout; no new operational conclusion is implied.' }],
    recommendations: ['Verify the original measurement sheets and maintenance records before using any sample data for engineering decisions.'],
  });
  const names = ['Engine nameplate', 'Cylinder head assemblies', 'Cylinder head surface', 'Engine assembly', 'Installed cylinder head'];
  return {
    company: { name: 'Marine Technical Services Ltd', address: 'Lubieszynska 5\n72-006 Mierzyn, Poland', contact: 'Ph: +48 91 852 48 18\nFax: +48 91 886 59 42\nE-mail: office@mts.szczecin.pl\nwww.mts.szczecin.pl' },
    vessel: 'MV MOROCCO STAR', workNumber: 'MTS/2026/083', datePlace: '31.03 - 16.06.2026',
    machinery: 'ME 2 SB', equipmentType: '8M32C', title: 'ME no. 2 SB OVERHAUL',
    preparedBy: 'Szczecin, Poland', client: 'MOROCCO STAR', analysisDate: '16.06.2026', analysisId: 'SAMPLE', sample: true,
    content, evidence: await Promise.all(names.map(async (name, index) => ({
      label: `R${index + 1}`, name, type: 'IMAGE', summary: `Photograph reproduced from page 28 of the supplied reference: ${name.toLowerCase()}.`,
      image: await readFile(new URL(`./report-assets/photo-${index + 1}.jpg`, import.meta.url)),
    }))),
  };
}
