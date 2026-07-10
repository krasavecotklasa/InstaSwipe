import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SelectFieldProps {
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  /** Modal title; defaults to the placeholder. */
  title?: string;
  style?: StyleProp<ViewStyle>;
  /** On web, show an anchored dropdown instead of a page-level modal. */
  inlineOnWeb?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** A cross-platform dropdown: a tap target that opens a modal option list. */
export function SelectField({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchable = false,
  title,
  style,
  inlineOnWeb = false,
  open: controlledOpen,
  onOpenChange,
}: SelectFieldProps) {
  const theme = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const open = controlledOpen ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return options;
    }
    return options.filter((option) => option.toLowerCase().includes(trimmed));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const optionsList = (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item}
      keyboardShouldPersistTaps="handled"
      style={styles.list}
      renderItem={({ item }) => {
        const selected = item === value;
        return (
          <TouchableOpacity
            onPress={() => {
              onChange(item);
              close();
            }}
            style={[
              styles.option,
              { backgroundColor: theme.tabActiveBackground, borderColor: theme.tabActiveBorder },
              selected && { backgroundColor: theme.backgroundSelected },
              selected && styles.optionSelected,
            ]}
          >
            <ThemedText type="small">{item}</ThemedText>
            {selected && (
              <SymbolView
                name={{ ios: 'checkmark', android: 'check', web: 'check' } as any}
                tintColor="#8769ffbe"
                size={16}
              />
            )}
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          No matches
        </ThemedText>
      }
    />
  );

  const searchField = searchable ? (
    <TextInput
      value={query}
      onChangeText={setQuery}
      placeholder="Search…"
      placeholderTextColor={theme.iconMuted}
      autoCapitalize="words"
      style={[
        styles.search,
        { color: theme.text, borderColor: theme.tabActiveBorder, backgroundColor: theme.tabActiveBackground },
      ]}
    />
  ) : null;

  const useInlineDropdown = Platform.OS === 'web' && inlineOnWeb;

  return (
    <View style={[styles.fieldContainer, open && useInlineDropdown && styles.fieldContainerOpen]}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={[
          styles.trigger,
          { backgroundColor: theme.tabActiveBackground, borderColor: theme.tabActiveBorder },
          open && { borderColor: theme.backgroundElement },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={title ?? placeholder}
      >
        <ThemedText type="small" themeColor={value ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.triggerText}>
          {value || placeholder}
        </ThemedText>
        <SymbolView
          name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' } as any}
          tintColor="#8769ffbe"
          size={16}
        />
      </TouchableOpacity>

      {useInlineDropdown && open && (
        <View
          style={[
            styles.inlineDropdown,
            { backgroundColor: theme.tabActiveBackground, borderColor: theme.tabActiveBorder },
          ]}
        >
          {searchField}
          {optionsList}
        </View>
      )}

      <Modal visible={!useInlineDropdown && open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.tabActiveBorder }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">{title ?? placeholder}</ThemedText>
              <TouchableOpacity
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.closeButton, { borderColor: theme.tabActiveBorder }]}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                  tintColor="#8769ffbe"
                  size={18}
                />
              </TouchableOpacity>
            </View>

            {searchField}
            {optionsList}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    position: 'relative',
  },
  fieldContainerOpen: {
    zIndex: 20,
  },
  trigger: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  inlineDropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    maxHeight: 280,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    gap: Spacing.two,
    overflow: 'hidden',
    zIndex: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    maxHeight: '70%',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionSelected: {
    borderRadius: 8,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
