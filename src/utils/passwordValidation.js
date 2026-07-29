const RULES = [
  { test: (pw) => pw.length >= 6, label: 'At least 6 characters' },
  { test: (pw) => /[A-Z]/.test(pw), label: 'At least one uppercase letter' },
  { test: (pw) => /[a-z]/.test(pw), label: 'At least one lowercase letter' },
  { test: (pw) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw), label: 'At least one special character (e.g. @, #, $)' },
];

export function validatePassword(password) {
  return RULES.filter((r) => !r.test(password)).map((r) => r.label);
}

export function getPasswordRules(password) {
  return RULES.map((r) => ({ met: r.test(password), label: r.label }));
}
