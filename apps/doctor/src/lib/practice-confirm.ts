type ConfirmCallback = (result: boolean) => void;
type ConfirmHandler = (message: string, title: string | undefined, callback: ConfirmCallback) => void;

let handler: ConfirmHandler | null = null;

export function registerConfirmHandler(fn: ConfirmHandler) {
  handler = fn;
}

export function practiceConfirm(message: string, title?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (handler) {
      handler(message, title, resolve);
    } else {
      // Fallback if provider is not mounted
      resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
    }
  });
}
