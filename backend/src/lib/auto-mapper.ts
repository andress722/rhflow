/**
 * Normalizes a header string by trimming, converting to lowercase, 
 * stripping accents, and replacing spaces or special characters with underscores/empty space.
 */
export function normalizeHeader(header: string): string {
  if (!header) return '';
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s_-]/g, '')   // remove special chars
    .replace(/[\s-]+/g, '_');        // spaces and hyphens to underscore
}

// Aliases mapping structure
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['nome', 'name', 'full_name', 'nome_completo', 'complete_name', 'colaborador', 'funcionario'],
  cpf: ['cpf', 'document', 'tax_id', 'documento', 'cadastro_pessoa_fisica'],
  whatsapp: ['whatsapp', 'celular', 'telefone', 'phone', 'mobile', 'contato', 'tel', 'whatsapp_celular'],
  email: ['email', 'e_mail', 'mail', 'correio_eletronico'],
  sector: ['setor', 'sector', 'departamento', 'area', 'unidade', 'depto'],
  jobTitle: ['cargo', 'job_title', 'title', 'funcao', 'ocupacao'],
  registrationNumber: ['matricula', 'registry', 'registration_number', 'registration', 'matricula_id', 'registro'],
  workModel: ['modelo', 'modelo_trabalho', 'work_model', 'model', 'modelo_de_trabalho'],
  managerUserId: ['gestor', 'manager', 'supervisor', 'gestor_id', 'manager_id', 'responsavel'],
  workScheduleId: ['escala', 'escala_trabalho', 'schedule', 'work_schedule', 'escala_id', 'escala_de_trabalho'],
};

/**
 * Returns best guess target fields for a list of raw headers.
 */
export function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => ({
    raw: h,
    norm: normalizeHeader(h)
  }));

  for (const [targetField, aliases] of Object.entries(FIELD_ALIASES)) {
    // Look for exact match or suffix match
    const found = normalizedHeaders.find(nh => 
      aliases.includes(nh.norm) || 
      aliases.some(alias => nh.norm.includes(alias))
    );

    if (found) {
      mapping[targetField] = found.raw;
    }
  }

  return mapping;
}
