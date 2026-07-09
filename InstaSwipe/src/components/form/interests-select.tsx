import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { INTEREST_OPTIONS, MAX_INTERESTS, MIN_INTERESTS } from '@/constants/interests';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface InterestsSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  /**
   * When true (default) the hint reminds the user to pick at least MIN_INTERESTS,
   * matching the profile form's requirement. Set false when used as an optional
   * discovery filter, where selecting none simply means "any".
   */
  requireMin?: boolean;
}

/** Multi-select interest chips capped at the backend's 20-selection maximum. */
export function InterestsSelect({ value, onChange, requireMin = true }: InterestsSelectProps) {
  const theme = useTheme();
  const atMax = value.length >= MAX_INTERESTS;

  const toggle = (interest: string) => {
    if (value.includes(interest)) {
      onChange(value.filter((item) => item !== interest));
    } else if (!atMax) {
      onChange([...value, interest]);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {value.length}/{MAX_INTERESTS} selected
        {requireMin ? ` · pick at least ${MIN_INTERESTS}` : ''}
      </ThemedText>
      <View style={styles.chips}>
        {INTEREST_OPTIONS.map((interest) => {
          const selected = value.includes(interest);
          const disabled = !selected && atMax;
          return (
            <TouchableOpacity
              key={interest}
              onPress={() => toggle(interest)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              style={[
                styles.chip,
                { borderColor: theme.tabActiveBorder },
                selected && { backgroundColor: '#6249ca', borderColor: '#6249ca' },
                disabled && styles.chipDisabled,
              ]}
            >
              <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                {interest}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
    columnGap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
