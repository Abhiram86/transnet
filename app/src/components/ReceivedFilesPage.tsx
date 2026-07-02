import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Transnet, { parseReceivedFilesStr, ReceivedFile } from '../../modules/transnet/src/TransnetModule';
import { Colors } from '../constants/theme';

const FILE_ICONS: Record<string, string> = {
  pdf: 'file-pdf-box',
  doc: 'file-word-box', docx: 'file-word-box',
  xls: 'file-excel-box', xlsx: 'file-excel-box',
  ppt: 'file-powerpoint-box', pptx: 'file-powerpoint-box',
  zip: 'zip-box', rar: 'zip-box', '7z': 'zip-box', tar: 'zip-box', gz: 'zip-box',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image',
  mp4: 'movie-open-outline', mkv: 'movie-open-outline', avi: 'movie-open-outline', mov: 'movie-open-outline', webm: 'movie-open-outline',
  mp3: 'file-music', wav: 'file-music', flac: 'file-music', ogg: 'file-music', aac: 'file-music',
  txt: 'file-document-outline', md: 'file-document-outline', csv: 'file-document-outline',
  js: 'language-javascript', ts: 'language-typescript', py: 'language-python',
  apk: 'android',
};

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || 'file-outline';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const ReceivedFilesPage = ({ visible, onClose }: Props) => {
  const translateX = useSharedValue(-400);
  const [files, setFiles] = useState<ReceivedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    translateX.value = withTiming(visible ? 0 : -400, {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });

    if (visible) {
      checkAndLoad();
    }
  }, [visible]);

  const checkAndLoad = useCallback(async () => {
    try {
      const granted = await Transnet.isExternalStorageManager();
      setHasPermission(granted);
      if (granted) {
        await loadFiles();
      }
    } catch {
      setHasPermission(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await Transnet.listReceivedFiles();
      setFiles(parseReceivedFilesStr(raw));
    } catch (e: any) {
      setFiles([]);
      Alert.alert('Error', e?.message || 'Failed to list files');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = async (fileName: string) => {
    try {
      await Transnet.openFile(fileName);
    } catch (e: any) {
      Alert.alert('Could not open file', e?.message || 'Unknown error');
    }
  };

  const handleGrantPermission = async () => {
    try {
      await Transnet.requestExternalStorageManager();
    } catch {}
  };

  useEffect(() => {
    if (visible && hasPermission === true) {
      loadFiles();
    }
  }, [hasPermission, visible]);

  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Received files</Text>
          <TouchableOpacity onPress={loadFiles} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="refresh" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {hasPermission === false && (
          <View style={styles.permissionCard}>
            <MaterialCommunityIcons name="shield-alert-outline" size={32} color={Colors.accent} />
            <Text style={styles.permissionTitle}>Storage access needed</Text>
            <Text style={styles.permissionText}>
              TransNet needs access to files in your Downloads folder. Tap below to enable it in system settings.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={handleGrantPermission} activeOpacity={0.7}>
              <MaterialCommunityIcons name="cog-outline" size={18} color={Colors.background} />
              <Text style={styles.permissionButtonText}>Open settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasPermission === true && files.length > 0 && (
          <View style={styles.statsBar}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{files.length}</Text>
              <Text style={styles.statLabel}>files</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatSize(totalSize)}</Text>
              <Text style={styles.statLabel}>total</Text>
            </View>
          </View>
        )}

        {hasPermission === true && loading && files.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        )}

        {hasPermission === true && !loading && files.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="folder-open-outline" size={64} color={Colors.surfaceLight} />
            <Text style={styles.emptyText}>No received files yet</Text>
            <Text style={styles.emptySubtext}>Files you receive will appear here</Text>
          </View>
        )}

        {hasPermission === true && files.length > 0 && (
          <FlatList
            data={files}
            keyExtractor={item => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.fileItem} onPress={() => handleOpen(item.name)} activeOpacity={0.6}>
                <MaterialCommunityIcons name={getFileIcon(item.name) as any} size={28} color={Colors.accent} />
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.fileSize}>{formatSize(item.size)}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    zIndex: 110,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: 16,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 13,
    opacity: 0.6,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  permissionCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    alignItems: 'center',
    gap: 10,
  },
  permissionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: 'bold',
  },
  permissionText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  permissionButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
