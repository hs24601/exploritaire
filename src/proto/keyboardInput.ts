/** Only an editable text/data field takes letter keys away from the camera. */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const element = target instanceof HTMLElement ? target : target.parentElement;
  if (element?.isContentEditable) return true;
  const control = target.closest('input, textarea');
  if (control instanceof HTMLTextAreaElement) return !control.disabled && !control.readOnly;
  if (!(control instanceof HTMLInputElement) || control.disabled || control.readOnly) return false;
  return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(control.type);
}
