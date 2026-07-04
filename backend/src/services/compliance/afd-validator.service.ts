export interface AfdValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  layoutVersion: string;
  recordsCount: number;
}

export class AfdValidatorService {
  /**
   * Technical validation of an AFD file structure
   */
  public static validateGeneratedAfd(content: string): AfdValidationReport {
    const report: AfdValidationReport = {
      valid: true,
      errors: [],
      warnings: [],
      layoutVersion: 'Portaria 671 MTE',
      recordsCount: 0,
    };

    if (!content) {
      report.valid = false;
      report.errors.push('O conteúdo do arquivo AFD está vazio.');
      return report;
    }

    // Check line terminators: Portaria 671 layout requires CRLF line endings
    if (!content.includes('\r\n')) {
      report.warnings.push('Os terminadores de linha não utilizam padrão Windows CRLF (\\r\\n).');
    }

    const lines = content.split(/\r?\n/).filter(line => line.length > 0);
    report.recordsCount = lines.length;

    if (lines.length === 0) {
      report.valid = false;
      report.errors.push('Nenhum registro estrutural localizado.');
      return report;
    }

    // Check header record (Type 1)
    const header = lines[0];
    if (header.substring(9, 10) !== '1') {
      report.valid = false;
      report.errors.push('Primeira linha do arquivo não é um cabeçalho (Registro Tipo 1) válido.');
    }

    // Check trailer record (Type 9)
    const trailer = lines[lines.length - 1];
    if (trailer.substring(9, 10) !== '9') {
      report.valid = false;
      report.errors.push('Última linha do arquivo não é um trailer (Registro Tipo 9) válido.');
    }

    let sequenceIndex = 1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Portaria 671 records standard size is usually 132 or 232 or similar depending on registry type
      if (line.length < 50) {
        report.valid = false;
        report.errors.push(`Linha ${i + 1} possui tamanho insuficiente (${line.length} caracteres).`);
      }

      // Read sequence number (usually first 9 chars)
      const seqStr = line.substring(0, 9);
      const seqNum = parseInt(seqStr, 10);
      if (isNaN(seqNum)) {
        report.valid = false;
        report.errors.push(`Linha ${i + 1} possui número de sequência não numérico: ${seqStr}`);
      } else {
        if (seqNum !== sequenceIndex) {
          report.valid = false;
          report.errors.push(`Sequenciamento corrompido na linha ${i + 1}. Esperado: ${sequenceIndex}, obtido: ${seqNum}`);
        }
        sequenceIndex++;
      }

      // Check record type
      const recordType = line.substring(9, 10);
      if (!['1', '2', '3', '4', '5', '7', '9'].includes(recordType)) {
        report.warnings.push(`Linha ${i + 1} possui tipo de registro desconhecido: ${recordType}`);
      }
    }

    return report;
  }
}
