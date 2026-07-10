import { type ReactNode, useRef } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SHEET_CLOSE_THRESHOLD = 80;

interface ResponsiveModalSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  closeAccessibilityLabel?: string;
  closeDisabled?: boolean;
  surfaceStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

interface ModalSheetPanelProps {
  children: ReactNode;
  title?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ModalSheetPanel({ children, title, trailing, style }: ModalSheetPanelProps) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { borderColor: theme.tabActiveBorder }, style]}>
      {title || trailing ? (
        <View style={styles.panelHeader}>
          {title ? (
            <ThemedText style={styles.panelHeaderText} type="smallBold">
              {title}
            </ThemedText>
          ) : (
            <View />
          )}
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export default function ResponsiveModalSheet({
  visible,
  onClose,
  children,
  title,
  closeAccessibilityLabel = 'Close',
  closeDisabled = false,
  surfaceStyle,
  contentStyle,
}: ResponsiveModalSheetProps) {
  const theme = useTheme();
  const isWeb = Platform.OS === 'web';
  const sheetDragStartYRef = useRef<number | null>(null);

  const requestClose = () => {
    if (!closeDisabled) {
      onClose();
    }
  };

  const handleSheetTouchStart = (event: GestureResponderEvent) => {
    sheetDragStartYRef.current = event.nativeEvent.pageY;
  };

  const handleSheetTouchEnd = (event: GestureResponderEvent) => {
    const startY = sheetDragStartYRef.current;
    sheetDragStartYRef.current = null;

    if (!isWeb && !closeDisabled && startY != null && event.nativeEvent.pageY - startY > SHEET_CLOSE_THRESHOLD) {
      onClose();
    }
  };

  const handleBackdropResponderStart = (event: GestureResponderEvent) => {
    return event.target === event.currentTarget;
  };

  const handleBackdropResponderRelease = () => {
    requestClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={requestClose}
    >
      <View
        style={[styles.backdrop, isWeb ? styles.webBackdrop : styles.mobileBackdrop]}
        onStartShouldSetResponder={handleBackdropResponderStart}
        onResponderRelease={handleBackdropResponderRelease}
      >
        <View
          style={[
            styles.surface,
            isWeb ? styles.webSurface : styles.mobileSurface,
            {
              backgroundColor: theme.background,
              borderColor: theme.tabActiveBorder,
            },
            surfaceStyle,
          ]}
        >
          <SafeAreaView
            edges={isWeb ? ['left', 'right'] : ['left', 'right', 'bottom']}
            style={[styles.surfaceContent, contentStyle]}
          >
            <View
              onTouchStart={handleSheetTouchStart}
              onTouchEnd={handleSheetTouchEnd}
              style={[styles.surfaceHeader, { borderBottomColor: theme.tabActiveBorder }]}
            >
              {title ? (
                <ThemedText type="smallBold" style={styles.surfaceHeaderTitle}>
                  {title}
                </ThemedText>
              ) : null}
              <TouchableOpacity
                onPress={requestClose}
                disabled={closeDisabled}
                accessibilityRole="button"
                accessibilityLabel={closeAccessibilityLabel}
                style={[
                  styles.headerCloseButton,
                  {
                    borderColor: theme.tabActiveBorder,
                    opacity: closeDisabled ? 0.5 : 1,
                  },
                ]}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                  tintColor="#8769ffbe"
                  size={20}
                />
              </TouchableOpacity>
            </View>

            {children}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  webBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  mobileBackdrop: {
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  surface: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  surfaceContent: {
    flex: 1,
  },
  webSurface: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '88%',
    borderRadius: 8,
  },
  mobileSurface: {
    height: '75%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  surfaceHeader: {
    minHeight: 56,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  surfaceHeaderTitle: {
    maxWidth: '70%',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  headerCloseButton: {
    position: 'absolute',
    right: Spacing.three,
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  panelHeaderText: {
    bottom: 1,
  },
});
