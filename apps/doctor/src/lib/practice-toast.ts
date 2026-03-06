type ToastType = 'error' | 'success' | 'warning';
type ToastHandler = (message: string, type: ToastType) => void;

let handler: ToastHandler | null = null;

export function registerToastHandler(fn: ToastHandler) {
  handler = fn;
}

export const toast = {
  error: (message: string) => handler?.(message, 'error'),
  success: (message: string) => handler?.(message, 'success'),
  warning: (message: string) => handler?.(message, 'warning'),
};
