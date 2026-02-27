import { EventEmitter } from 'events';
import { CommandInfo } from '../types/debugTypes';
import { serialize } from '../protocol/CommandInfo';

export type DebugTransportKind = 'pipe' | 'network' | 'fifo' | 'native';

export interface IDebugTransport extends EventEmitter {
  readonly kind: DebugTransportKind;
  readonly isConnected: boolean;
  listen(): Promise<void>;
  send(info: Parameters<typeof serialize>[0]): void;
  close(): void;
  getCommunicationString(): string;
  on(event: 'message', listener: (msg: CommandInfo) => void): this;
  on(event: 'connected' | 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'log', listener: (msg: string) => void): this;
  on(event: 'traceLog', listener: (msg: string) => void): this; // // for payload-sensitive data → only process.stderr
  
  /**
   * Optional: Connect after listen (used for FIFO transport)
   */
  connect?(): Promise<void>;
}

