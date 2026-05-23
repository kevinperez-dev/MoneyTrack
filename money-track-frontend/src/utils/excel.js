// Archivo: src/utils/excel.js
// Propósito: exportar filas visibles a un archivo compatible con Excel.

function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function exportRowsToExcelXml({ rows, sheetName, fileName, headers, headerColor }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const headerCells = headers
    .map(
      (title) =>
        `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(title)}</Data></Cell>`,
    )
    .join('');

  const bodyRows = safeRows
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell ss:StyleID="BodyStyle"><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`,
    )
    .join('');

  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="HeaderStyle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111111"/><Interior ss:Color="${headerColor}" ss:Pattern="Solid"/></Style>
    <Style ss:ID="BodyStyle"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#222222"/></Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${headers.map(() => '<Column ss:AutoFitWidth="1" ss:Width="120"/>').join('')}<Row>${headerCells}</Row>${bodyRows}</Table></Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${fileName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
