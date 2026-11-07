export interface PasswordCheck {
  minLength: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
  /** Every required rule is met. */
  valid: boolean;
  /** 0 (empty) to 4. */
  score: 0 | 1 | 2 | 3 | 4;
}

export const MIN_PASSWORD_LENGTH = 8;

export function checkPassword(password: string): PasswordCheck {
  const minLength = password.length >= MIN_PASSWORD_LENGTH;
  const hasLetter = /\p{L}/u.test(password);
  const hasDigit = /\d/.test(password);
  const valid = minLength && hasLetter && hasDigit;
  if (password.length === 0) return { minLength, hasLetter, hasDigit, valid, score: 0 };
  const bonus = password.length >= 12 && /[^\p{L}\d]/u.test(password) ? 1 : 0;
  const base = Number(minLength) + Number(hasLetter) + Number(hasDigit);
  const raw = valid ? 3 + bonus : Math.min(base, 2);
  return { minLength, hasLetter, hasDigit, valid, score: Math.max(1, raw) as PasswordCheck["score"] };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
