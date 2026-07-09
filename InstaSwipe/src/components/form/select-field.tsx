import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
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
}: SelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

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

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.trigger, { borderColor: theme.tabActiveBorder }, style]}
        accessibilityRole="button"
        accessibilityLabel={title ?? placeholder}
      >
        <ThemedText type="small" themeColor={value ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.triggerText}>
          {value || placeholder}
        </ThemedText>
        <SymbolView
          name={{ ios: 'chevron.down', android: 'expand-more', web: 'expand-more' } as any}
          tintColor="#8769ffbe"
          size={16}
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.tabActiveBorder }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">{title ?? placeholder}</ThemedText>
              <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Close">
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                  tintColor="#8769ffbe"
                  size={18}
                />
              </TouchableOpacity>
            </View>

            {searchable && (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                placeholderTextColor={theme.iconMuted}
                autoCapitalize="words"
                style={[styles.search, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              />
            )}

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
                      { borderColor: theme.tabActiveBorder },
                      selected && { backgroundColor: theme.backgroundElement },
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
