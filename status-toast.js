export function showTransientStatus(element, message, timeoutMs = 2500) {
  if (!element || typeof element !== 'object') return;

  const timerKey = '__feiraStatusTimer';
  if (element[timerKey]) {
    clearTimeout(element[timerKey]);
  }

  element.textContent = message;
  if (typeof element.classList?.add === 'function') {
    element.classList.add('show');
  }

  element[timerKey] = setTimeout(() => {
    element.textContent = '';
    if (typeof element.classList?.remove === 'function') {
      element.classList.remove('show');
    }
  }, timeoutMs);
}
