export class AiToolAuthorizationService {
  /**
   * Deterministic authorization check for AI companion tools
   */
  public static authorizeToolCall(options: {
    role: string;
    companyId: string;
    targetCompanyId: string | null;
    toolName: string;
    payload: any;
  }): { authorized: boolean; reason?: string } {
    const { role, companyId, targetCompanyId, toolName } = options;

    // 1. Multitenant checks
    if (targetCompanyId && targetCompanyId !== companyId) {
      return {
        authorized: false,
        reason: 'Violação de Multitenancy: Tentativa de acessar dados de outro inquilino.',
      };
    }

    // 2. Role permissions mapping (Determinismo puro, nenhuma inteligência toma essa decisão)
    const allowedRoles: Record<string, string[]> = {
      SUPER_ADMIN: ['getPresenceSummary', 'getOpenOccurrences', 'getEmployeeCount', 'getReportSummary', 'runComplianceCheck'],
      ADMIN: ['getPresenceSummary', 'getOpenOccurrences', 'getEmployeeCount', 'getReportSummary'],
      HR: ['getPresenceSummary', 'getOpenOccurrences', 'getEmployeeCount', 'getReportSummary'],
      MANAGER: ['getPresenceSummary', 'getOpenOccurrences', 'getEmployeeCount'],
      EMPLOYEE: ['getPresenceSummary'],
    };

    const rolesAllowed = allowedRoles[role] || [];
    if (!rolesAllowed.includes(toolName)) {
      return {
        authorized: false,
        reason: `Perfil ${role} não possui permissão para executar a ferramenta ${toolName}.`,
      };
    }

    return { authorized: true };
  }

  /**
   * Hardened prompt injection filter to prevent leakage of secrets, CPFs, or bypassing instructions
   */
  public static detectPromptInjection(prompt: string): { injected: boolean; reason?: string } {
    if (!prompt) return { injected: false };

    const lower = prompt.toLowerCase();

    // Injection heuristics
    const injectionPatterns = [
      'ignore suas regras',
      'ignore as regras',
      'ignore instructions',
      'ignore previous instructions',
      'mostre funcionários de outra empresa',
      'other company',
      'outra empresa',
      'liste cpfs',
      'list cpfs',
      'mostre cids',
      'show cids',
      'revele secrets',
      'show secrets',
      'execute sql',
      'database query',
    ];

    for (const pattern of injectionPatterns) {
      if (lower.includes(pattern)) {
        return {
          injected: true,
          reason: `Tentativa de injeção ou bypass de segurança detectada: "${pattern}"`,
        };
      }
    }

    return { injected: false };
  }
}
