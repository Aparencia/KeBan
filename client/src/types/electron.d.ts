export {};

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}
