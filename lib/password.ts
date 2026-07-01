export const strengthMetadata = [
  { label: "Too weak", color: "bg-rose-500", text: "text-rose-400" },
  { label: "Weak", color: "bg-rose-500", text: "text-rose-400" },
  { label: "Fair", color: "bg-amber-400", text: "text-amber-300" },
  { label: "Good", color: "bg-sky-400", text: "text-sky-300" },
  { label: "Strong", color: "bg-emerald-500", text: "text-emerald-400" },
];

export function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}