export interface SharedOptions {
  log(...loggable: any[]): void;
  error(...loggable: any[]): void;
}
