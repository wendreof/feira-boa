// Helpers de formulário compartilhados entre as páginas de conta e alertas.

export function makeOption(label: string, value: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

export function renderCheckboxes(container: HTMLFieldSetElement | null, values: string[], selected: string[]): void {
  if (!container) return;
  container.replaceChildren();
  for (const value of values) {
    const label = document.createElement("label");
    label.className = "preference-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.checked = selected.includes(value);
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    container.append(label);
  }
}

export function checkedValues(container: HTMLFieldSetElement | null): string[] {
  return container ? Array.from(container.querySelectorAll<HTMLInputElement>("input:checked"), (input) => input.value) : [];
}
