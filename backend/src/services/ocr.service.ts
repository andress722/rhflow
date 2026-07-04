export interface OcrResult {
  employeeName?: string;
  crm?: string;
  cid?: string;
  daysSuggested?: number;
  issueDate?: string; // YYYY-MM-DD
  notes?: string;
}

export class OcrService {
  static async processCertificate(filename: string): Promise<OcrResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const nameLower = filename.toLowerCase();

    // Default mock data
    const result: OcrResult = {
      employeeName: 'João da Silva',
      crm: '123456/SP',
      cid: 'M54.5', // Low back pain
      daysSuggested: 3,
      issueDate: new Date().toISOString().split('T')[0],
      notes: 'Extraído automaticamente via IA OCR (PresençaFlow Intelligent Vision). Colaborador necessita repouso domiciliar.',
    };

    // Tweak output based on common filenames to make it feel real
    if (nameLower.includes('maria') || nameLower.includes('atestado2')) {
      result.employeeName = 'Maria Oliveira';
      result.crm = '987654/RJ';
      result.cid = 'J06.9'; // Acute upper respiratory infection
      result.daysSuggested = 5;
      result.notes = 'Atestado médico da clínica respiratória. Recomendado isolamento e repouso por 5 dias.';
    } else if (nameLower.includes('carlos') || nameLower.includes('atestado3')) {
      result.employeeName = 'Carlos Souza';
      result.crm = '456789/MG';
      result.cid = 'S00.0'; // Superficial injury of scalp
      result.daysSuggested = 1;
      result.notes = 'Atestado de atendimento de urgência ortopédica. Afastamento sugerido de 1 dia.';
    }

    return result;
  }
}
