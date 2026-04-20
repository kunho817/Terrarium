declare module 'sql.js' {
  export type SqlValue = string | number | Uint8Array | null;

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export class Database {
    constructor(data?: Uint8Array);
    run(sql: string, params?: unknown[] | Record<string, unknown>): Database;
    exec(sql: string, params?: unknown[] | Record<string, unknown>): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
}
