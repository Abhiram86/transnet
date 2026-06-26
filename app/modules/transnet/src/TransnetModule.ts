import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { TransnetModuleEvents } from './Transnet.types';

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
}

const Transnet = Platform.OS === 'web'
  ? new TransnetModuleStub()
  : requireNativeModule('Transnet');

export default Transnet;
