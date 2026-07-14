export {};

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      send: (channel: string, ...args: unknown[]) => void;
      /** 监听主进程发出的窗口关闭事件，返回取消监听函数 */
      onWindowClosing: (callback: () => void) => () => void;
      /** 向主进程发送关闭行为选择 */
      closeAction: (action: 'quit' | 'minimize' | 'cancel', remember: boolean) => Promise<void>;
      /** 最小化窗口 */
      windowMinimize: () => Promise<{ success: boolean }>;
      /** 切换最大化/还原 */
      windowMaximize: () => Promise<{ success: boolean }>;
      /** 关闭窗口（触发确认流程） */
      windowClose: () => Promise<{ success: boolean }>;
      /** 查询当前是否最大化 */
      windowIsMaximized: () => Promise<boolean>;
      /** 监听最大化状态变化，返回取消监听函数 */
      onMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;
      /** 设置是否自动检查更新 */
      setAutoUpdate: (enabled: boolean) => Promise<{ success: boolean }>;
      /** v1.0.0: 数据访问 API */
      db: {
        query: <T = unknown>(table: string, method: string, args?: unknown[]) => Promise<T>;
        insert: (table: string, item: unknown) => Promise<string>;
        update: (table: string, id: string, changes: unknown) => Promise<void>;
        delete: (table: string, id: string) => Promise<void>;
        search: <T = unknown>(table: string, query: string) => Promise<T[]>;
        batch: (operations: unknown[]) => Promise<{ success: boolean }>;
      };
      /** v1.0.0: 数据迁移 API */
      migration: {
        check: () => Promise<{ needed: boolean; tableMapping: Array<{ dexie: string; sqlite: string }> }>;
        importTable: (table: string, rows: unknown[]) => Promise<{ success: boolean; rowsImported: number; error?: string }>;
        complete: () => Promise<{ success: boolean; integrity: string; error?: string }>;
      };
      /** v1.1.0: 存储路径管理 API */
      storage: {
        changePath: (newPath: string) => Promise<{
          success: boolean;
          previousPath?: string;
          newPath?: string;
          error?: string;
        }>;
        getActivePath: () => Promise<string>;
      };
    };
  }
}
