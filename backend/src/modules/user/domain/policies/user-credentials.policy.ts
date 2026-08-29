export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function normalizeEmail(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value.trim().normalize('NFKC');
}

export function usernameIdentity(value: string): string {
  return normalizeUsername(value).toLowerCase();
}

export function assertPasswordPolicy(value: string): void {
  if (
    value.length < PASSWORD_MIN_LENGTH ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `Le mot de passe doit contenir entre ${PASSWORD_MIN_LENGTH} et ${PASSWORD_MAX_LENGTH} caractères`,
    );
  }
}
