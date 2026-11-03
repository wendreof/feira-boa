const DEPARTMENT_KEY = "feira-boa-active-department";

export function readSavedDepartment(): string {
  try {
    return sessionStorage.getItem(DEPARTMENT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveActiveDepartment(departmentId: string): void {
  try {
    if (departmentId) sessionStorage.setItem(DEPARTMENT_KEY, departmentId);
    else sessionStorage.removeItem(DEPARTMENT_KEY);
  } catch {
    // ignore storage failures
  }
}
