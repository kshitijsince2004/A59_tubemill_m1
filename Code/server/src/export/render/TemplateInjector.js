import ExcelJS from 'exceljs';


const fmt = (v) => v == null ? '' : v;

/**
 * @param {string | Buffer} templatePathOrBuffer
 */
export async function injectReport(
templatePathOrBuffer,
layout,
header,
rows,
analysisRows)
{
  const wb = new ExcelJS.Workbook();
  if (Buffer.isBuffer(templatePathOrBuffer)) {
    await wb.xlsx.load(templatePathOrBuffer);
  } else {
    await wb.xlsx.readFile(templatePathOrBuffer);
  }
  const ws = wb.getWorksheet(layout.sheet) ?? wb.worksheets[0];
  if (!ws) throw new Error(`Sheet ${layout.sheet} not found in template`);

  for (const [field, cell] of Object.entries(layout.titleBlock ?? {})) {
    ws.getCell(cell).value = fmt(header[field]);
  }

  let r = layout.table.dataStartRow;
  const cols = layout.table.columns;
  let lastBlock;
  for (const row of rows) {
    if (layout.table.repeatingGroups?.by) {
      const key = row[layout.table.repeatingGroups.by];
      if (key !== lastBlock) {
        const labelCell = `${layout.table.repeatingGroups.blockLabelCell}${r}`;
        ws.getCell(labelCell).value = String(key ?? '');
        lastBlock = key;
      }
    }
    for (const [field, col] of Object.entries(cols)) {
      const cell = ws.getCell(`${col}${r}`);
      cell.value = fmt(row[field]);
      const nf = layout.numberFormats?.[field];
      if (nf) cell.numFmt = nf;
    }
    r += layout.table.rowBlock ?? 1;
    if (layout.table.repeatingGroups?.breakdownRow && row.breakdown_remark) {
      const remarksCol = cols.remarks ?? 'W';
      ws.getCell(`${remarksCol}${r}`).value = fmt(row.breakdown_remark);
      r += 1;
    }
  }

  if (layout.analysisTable && analysisRows?.length) {
    let ar = layout.analysisTable.dataStartRow;
    for (const row of analysisRows) {
      for (const [field, col] of Object.entries(layout.analysisTable.columns)) {
        ws.getCell(`${col}${ar}`).value = fmt(row[field]);
      }
      ar += 1;
    }
  }

  for (const [field, cell] of Object.entries(layout.footer ?? {})) {
    ws.getCell(cell).value = fmt(header[field]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Build a blank workbook matching layout columns (stand-in until plant files arrive). */
export async function buildBlankTemplate(layout) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(layout.sheet);
  ws.getCell('A1').value = 'GOOD LUCK INDUSTRIES';
  ws.getCell('A2').value = layout.report;
  ws.getCell('A3').value = 'PROGRAMMATIC BLANK — replace with controlled plant template';

  const headerRow = Math.max(...(layout.table.headerRows ?? [4]));
  for (const field of Object.keys(layout.table.columns)) {
    const col = layout.table.columns[field];
    ws.getCell(`${col}${headerRow}`).value = field;
  }
  if (layout.analysisTable) {
    for (const field of Object.keys(layout.analysisTable.columns)) {
      const col = layout.analysisTable.columns[field];
      ws.getCell(`${col}${layout.analysisTable.dataStartRow - 1}`).value = field;
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
