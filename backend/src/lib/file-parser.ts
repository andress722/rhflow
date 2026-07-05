import * as XLSX from 'xlsx';

export interface ParsedFileResult {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

/**
 * Strips UTF-8 BOM if present.
 */
function stripBom(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

/**
 * Custom robust CSV parsing that handles quotes and multiple delimiters.
 */
export function parseCsvBuffer(
  buffer: Buffer,
  options: { delimiter?: string; maxRows?: number; maxCols?: number } = {}
): ParsedFileResult {
  const content = stripBom(buffer.toString('utf-8'));
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // Detect delimiter if not forced
  let delimiter = options.delimiter;
  if (!delimiter) {
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = '\t';
    } else {
      delimiter = ',';
    }
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    // Remove surrounding quotes and clean
    return result.map(val => val.replace(/^"|"$/g, '').trim());
  };

  const rawHeaders = parseLine(lines[0]);
  const maxCols = options.maxCols || 100;
  const headers = rawHeaders.slice(0, maxCols).map((h, i) => h || `Coluna_${i + 1}`);

  const maxRows = options.maxRows || 5000;
  const dataLines = lines.slice(1, maxRows + 1);
  const rows: Record<string, any>[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const values = parseLine(dataLines[i]);
    const rowObj: Record<string, any> = { __rowNum: i + 2 };
    
    headers.forEach((header, colIdx) => {
      rowObj[header] = values[colIdx] || '';
    });
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    totalRows: lines.length - 1,
  };
}

/**
 * List all worksheet names inside an XLSX file.
 */
export function listXlsxSheets(buffer: Buffer): string[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames;
  } catch (err) {
    throw new Error('Falha ao processar arquivo Excel. Certifique-se de que é um .xlsx válido.');
  }
}

/**
 * Parse an XLSX worksheet using SheetJS.
 * Formula values are extracted as calculated text/value, not executed.
 */
export function parseXlsxBuffer(
  buffer: Buffer,
  options: { sheetName?: string; maxRows?: number; maxCols?: number } = {}
): ParsedFileResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellHTML: false });
    const sheetName = options.sheetName || workbook.SheetNames[0];

    if (!sheetName || !workbook.Sheets[sheetName]) {
      throw new Error(`Planilha "${sheetName}" não encontrada no arquivo.`);
    }

    const worksheet = workbook.Sheets[sheetName];
    // Convert to JSON array of objects representing rows
    const jsonOpts = {
      header: 1, // raw array of arrays
      raw: false, // get formatted text representation
      defval: '',
    };
    const data = XLSX.utils.sheet_to_json(worksheet, jsonOpts) as any[][];

    if (data.length === 0) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    const rawHeaders = (data[0] || []).map(val => String(val).trim());
    const maxCols = options.maxCols || 100;
    const headers = rawHeaders.slice(0, maxCols).map((h, i) => h || `Coluna_${i + 1}`);

    const maxRows = options.maxRows || 5000;
    const dataLines = data.slice(1, maxRows + 1);
    const rows: Record<string, any>[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const values = dataLines[i] || [];
      const rowObj: Record<string, any> = { __rowNum: i + 2 };

      headers.forEach((header, colIdx) => {
        rowObj[header] = values[colIdx] !== undefined ? String(values[colIdx]).trim() : '';
      });
      rows.push(rowObj);
    }

    return {
      headers,
      rows,
      totalRows: data.length - 1,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Falha ao processar arquivo Excel XLSX.');
  }
}
