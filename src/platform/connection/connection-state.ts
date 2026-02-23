import { BehaviorSubject } from 'rxjs';

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface ConnectionInfo {
  status: ConnectionStatus;
  port?: number;
  token?: string;
  error?: string;
}

export const connectionState$ = new BehaviorSubject<ConnectionInfo>({
  status: ConnectionStatus.DISCONNECTED,
});
