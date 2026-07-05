/**
 * Centralized PII Redactor for PresençaFlow RH logs and diagnostics.
 * Masking sensitive keys and irreversibly redactions of PII (CPF, PIS).
 */
export function redactPII(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Check for raw CPF or PIS (11 digits) and mask it irreversibly
    const cpfRegex = /\b\d{11}\b/g;
    if (cpfRegex.test(obj)) {
      return obj.replace(cpfRegex, (m) => `***.***.***-${m.slice(-2)}`);
    }
    const formattedCpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
    if (formattedCpfRegex.test(obj)) {
      return obj.replace(formattedCpfRegex, (m) => `***.***.***-${m.slice(-2)}`);
    }
    
    // Check for Bearer token prefix and mask it
    if (obj.toLowerCase().startsWith('bearer ')) {
      return 'Bearer **********';
    }
    
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPII(item));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      const sensitiveKeys = [
        'authorization', 'cookie', 'set-cookie', 'apikey', 'token', 'password', 'secret',
        'clientsecret', 'cpf', 'pis', 'cid', 'medicaldata', 'diagnosis',
        'biometrictemplate', 'embedding', 'selfie', 'faceimage', 'selfieurl',
        'rawbody', 'payload', 'body', 'tempPassword', 'confirmPassword'
      ];

      if (sensitiveKeys.some(k => lowerKey.includes(k))) {
        if (typeof obj[key] === 'string' && (lowerKey.includes('cpf') || lowerKey.includes('pis'))) {
          redacted[key] = redactPII(obj[key]);
        } else {
          redacted[key] = '[REDACTED]';
        }
      } else {
        redacted[key] = redactPII(obj[key]);
      }
    }
    return redacted;
  }

  return obj;
}
