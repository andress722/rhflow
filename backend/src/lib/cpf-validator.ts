/**
 * Validates CPF check digits (digito verificador) using the official algorithm.
 * Sanitizes input before validating.
 */
export function isValidCpf(rawCpf: string | null | undefined): boolean {
  if (!rawCpf) return false;

  // Remove non-digits
  const cpf = String(rawCpf).replace(/\D/g, '');

  // Must be 11 digits
  if (cpf.length !== 11) return false;

  // Rejects known repetitive invalid sequences
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Validate first digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(9))) return false;

  // Validate second digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(10))) return false;

  return true;
}

/**
 * Strips all non-digit characters from the CPF.
 */
export function sanitizeCpf(rawCpf: string): string {
  return rawCpf.replace(/\D/g, '');
}
