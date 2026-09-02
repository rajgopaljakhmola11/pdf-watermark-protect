export function generateOwnerPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export type StrengthLevel = "weak" | "fair" | "good" | "strong";

export interface StrengthResult {
  score: number;
  label: StrengthLevel;
}

export function passwordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { score, label: "weak" };
  if (score <= 3) return { score, label: "fair" };
  if (score <= 4) return { score, label: "good" };
  return { score, label: "strong" };
}
