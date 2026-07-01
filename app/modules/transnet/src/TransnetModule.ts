import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { TransnetModuleEvents } from './Transnet.types';

export type TransferProgress = {
  totalFiles: number;
  currentFileIdx: number;
  currentFileName: string;
  totalBytes: number;
  currentBytes: number;
  percentDone: number;
};

export function parseProgressStr(raw: string): TransferProgress {
  const parts = raw.split('<|sep|>');
  return {
    totalFiles: parseInt(parts[0], 10) || 0,
    currentFileIdx: parseInt(parts[1], 10) || 0,
    currentFileName: parts[2] || '',
    totalBytes: parseInt(parts[3], 10) || 0,
    currentBytes: parseInt(parts[4], 10) || 0,
    percentDone: parseFloat(parts[5]) || 0,
  };
}

class TransnetModuleStub {
  testBridge = async (_value: string): Promise<string> => 'stub';
  initCore = async (): Promise<string> => 'stub';
  getLocalIP = async (): Promise<string> => '127.0.0.1';
  initiateFileTransfer = async (): Promise<string> => 'stub';
  listenFileTransfer = async (): Promise<string> => 'stub';
  stopDiscoveryService = async (): Promise<string> => 'stub';
  acceptFileTransfer = async (_senderAddr: string): Promise<string> => 'stub';
  startServer = async (_port: string): Promise<string> => 'stub';
  stopServer = async (): Promise<string> => 'stub';
  sendFile = async (_ip: string, _port: string, _filePathsStr: string): Promise<string> => 'stub';
  getClientProgress = async (): Promise<string> => '0<|sep|>0<|sep|><|sep|>0<|sep|>0<|sep|>0';
  getServerProgress = async (): Promise<string> => '0<|sep|>0<|sep|><|sep|>0<|sep|>0<|sep|>0';
  getClientStatus = async (): Promise<string> => '';
  getServerStatus = async (): Promise<string> => '';
  cancelClientTransfer = async (): Promise<string> => 'stub';
  cancelServerTransfer = async (): Promise<string> => 'stub';
  signalSkipCurrentFile = async (): Promise<string> => 'stub';
}

const Transnet = Platform.OS === 'web'
  ? new TransnetModuleStub()
  : requireNativeModule('Transnet');

export default Transnet;
