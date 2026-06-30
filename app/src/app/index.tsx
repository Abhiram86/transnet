import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, FlatList, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Transnet, { parseProgressStr, TransferProgress } from '../../modules/transnet/src/TransnetModule';
import { Colors } from '../constants/theme';
import { StepIndicator } from '../components/StepIndicator';

type Step = 'pick' | 'find' | 'send';

const FileRow = ({ item, onRemove }: {
  item: DocumentPicker.DocumentPickerAsset;
  onRemove: (item: DocumentPicker.DocumentPickerAsset) => void;
}) => (
  <View style={styles.fileRow}>
    <MaterialCommunityIcons name="file-outline" size={20} color={Colors.textMuted} />
    <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
    <Text style={styles.fileSize}>{item.size ? `${(item.size / 1024 / 1024).toFixed(1)} MB` : '—'}</Text>
    <TouchableOpacity onPress={() => onRemove(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <MaterialCommunityIcons name="close" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  </View>
);

export default function SendScreen() {
  const [step, setStep] = useState<Step>('pick');
  const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [targetIP, setTargetIP] = useState('');
  const [targetName, setTargetName] = useState('');
  const [manualIP, setManualIP] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSending) return;

    pollingRef.current = setInterval(async () => {
      try {
        const [rawProgress, rawStatus] = await Promise.all([
          Transnet.getClientProgress(),
          Transnet.getClientStatus(),
        ]);
        setProgress(parseProgressStr(rawProgress));

        if (rawStatus === 'done') {
          setIsSending(false);
          setProgress(prev => prev ? { ...prev, percentDone: 100 } : null);
          Alert.alert('Done', 'File(s) sent successfully!');
          resetAll();
        } else if (rawStatus.startsWith('error:')) {
          setIsSending(false);
          setProgress(null);
          Alert.alert('Error', rawStatus.slice(7));
        }
      } catch {}
    }, 200);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isSending]);

  const stepIndex = step === 'pick' ? 0 : step === 'find' ? 1 : 2;

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: false });
      if (!result.canceled) {
        setSelectedFiles(prev => [...prev, ...result.assets]);
      }
    } catch {
      Alert.alert('Error', 'Could not select files.');
    }
  };

  const removeFile = (file: DocumentPicker.DocumentPickerAsset) => {
    setSelectedFiles(prev => prev.filter(f => f.uri !== file.uri));
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const info = await Transnet.initiateFileTransfer();
      const [name, ip] = info.split('<|sep|>');
      setTargetIP(ip);
      setTargetName(name);
    } catch {
      Alert.alert('Nobody found', 'Make sure the receiver is ready and on the same network.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSend = async () => {
    if (!targetIP || selectedFiles.length === 0) return;
    setIsSending(true);
    setProgress(null);
    try {
      const uris = selectedFiles.map(f => f.uri).join('<|sep|>');
      Transnet.sendFile(targetIP, '8080', uris);
    } catch (e: any) {
      setIsSending(false);
      Alert.alert('Error', e.message);
    }
  };

  const resetAll = () => {
    setSelectedFiles([]);
    setTargetIP('');
    setTargetName('');
    setManualIP('');
    setStep('pick');
    setProgress(null);
  };

  const goBack = () => {
    if (step === 'find') setStep('pick');
    else if (step === 'send') setStep('find');
  };

  const useManualIP = () => {
    if (!manualIP.trim()) {
      Alert.alert('Enter an address', 'Type the IP address of the receiver.');
      return;
    }
    setTargetIP(manualIP.trim());
    setTargetName(manualIP.trim());
    setStep('send');
  };

  // ── Step: Pick files ──────────────────────────────────

  const renderPickStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>Choose what you want to share</Text>

      <TouchableOpacity style={styles.pickButton} onPress={pickFiles} activeOpacity={0.7}>
        <MaterialCommunityIcons name="plus" size={20} color={Colors.background} />
        <Text style={styles.pickButtonText}>Pick files</Text>
      </TouchableOpacity>

      {selectedFiles.length > 0 && (
        <View style={styles.fileList}>
          <FlatList
            data={selectedFiles}
            keyExtractor={item => item.uri}
            renderItem={({ item }) => <FileRow item={item} onRemove={removeFile} />}
            style={{ maxHeight: 300 }}
          />
          <TouchableOpacity style={styles.addMore} onPress={pickFiles}>
            <MaterialCommunityIcons name="plus" size={14} color={Colors.accent} />
            <Text style={styles.addMoreText}>Add more</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.nextButton, selectedFiles.length === 0 && styles.disabled]}
        onPress={() => setStep('find')}
        disabled={selectedFiles.length === 0}
      >
        <Text style={styles.nextButtonText}>Next</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color={Colors.background} />
      </TouchableOpacity>
    </View>
  );

  // ── Step: Find receiver ───────────────────────────────

  const renderFindStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>Find the receiver on your network</Text>

      <TouchableOpacity
        style={[styles.primaryButton, isScanning && styles.disabled]}
        onPress={handleScan}
        disabled={isScanning}
        activeOpacity={0.7}
      >
        {isScanning ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <>
            <MaterialCommunityIcons name="radar" size={20} color={Colors.background} />
            <Text style={styles.primaryButtonText}>Search nearby</Text>
          </>
        )}
      </TouchableOpacity>

      {targetIP ? (
        <View style={styles.foundBanner}>
          <MaterialCommunityIcons name="check-circle" size={18} color={Colors.accent} />
          <Text style={styles.foundName}>{targetName || targetIP}</Text>
          <TouchableOpacity onPress={() => { setTargetIP(''); setTargetName(''); }}>
            <MaterialCommunityIcons name="close" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={styles.manualToggle} onPress={() => setShowManual(!showManual)}>
        <Text style={styles.manualToggleText}>
          {showManual ? 'Hide manual entry' : 'Or enter address manually'}
        </Text>
      </TouchableOpacity>

      {showManual && (
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manualIP}
            onChangeText={setManualIP}
            placeholder="192.168.1.5"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            editable={!isScanning}
          />
          <TouchableOpacity
            style={[styles.goButton, (!manualIP.trim() || isScanning) && styles.disabled]}
            onPress={useManualIP}
            disabled={!manualIP.trim() || isScanning}
          >
            <Text style={styles.goButtonText}>Go</Text>
          </TouchableOpacity>
        </View>
      )}

      {targetIP ? (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => setStep('send')}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={Colors.background} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // ── Step: Send ────────────────────────────────────────

  const renderSendStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>Ready to send to {targetName}</Text>

      <View style={styles.summaryCard}>
        <MaterialCommunityIcons name="account-outline" size={24} color={Colors.accent} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.summaryLabel}>Receiver</Text>
          <Text style={styles.summaryValue}>{targetName}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <MaterialCommunityIcons name="file-multiple-outline" size={24} color={Colors.accent} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.summaryLabel}>Files</Text>
          <Text style={styles.summaryValue}>{selectedFiles.length} file(s)</Text>
        </View>
      </View>

      {isSending && progress && (
        <View style={styles.progressCard}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress.percentDone}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressIdx}>({progress.currentFileIdx + 1}/{progress.totalFiles})</Text>
            <Text style={styles.progressName} numberOfLines={1}>{progress.currentFileName}</Text>
            <Text style={styles.progressPct}>{progress.percentDone.toFixed(0)}%</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, isSending && styles.disabled]}
        onPress={handleSend}
        disabled={isSending}
        activeOpacity={0.7}
      >
        {isSending ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <>
            <MaterialCommunityIcons name="send" size={20} color={Colors.background} />
            <Text style={styles.primaryButtonText}>Send now</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StepIndicator totalSteps={3} currentStep={stepIndex} />

      {step !== 'pick' && (
        <TouchableOpacity style={styles.backRow} onPress={goBack}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.textMuted} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}

      {step === 'pick' && renderPickStep()}
      {step === 'find' && renderFindStep()}
      {step === 'send' && renderSendStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 6,
    top: 85,
    position: 'absolute',
  },
  backText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 16,
    justifyContent: 'center',
  },
  stepDescription: {
    color: Colors.textMuted,
    fontSize: 16,
    marginBottom: 4,
  },

  // Pick step
  pickButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  fileList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  fileName: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
  },
  fileSize: {
    color: Colors.textMuted,
    fontSize: 12,
    marginRight: 4,
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
  },
  addMoreText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  // Find step
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  foundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  foundName: {
    flex: 1,
    color: Colors.text,
    fontWeight: '600',
  },
  manualToggle: {
    alignSelf: 'center',
    padding: 6,
  },
  manualToggleText: {
    color: Colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goButton: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  goButtonText: {
    color: Colors.text,
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Send step
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },

  // Shared
  nextButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'auto',
  },
  nextButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.4,
  },

  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressIdx: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  progressName: {
    color: Colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  progressPct: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
