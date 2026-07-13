import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { InterestsSelect } from '@/components/form/interests-select';
import { SelectField } from '@/components/form/select-field';
import { ThemedText } from '@/components/themed-text';
import { COUNTRIES } from '@/constants/countries';
import { Spacing } from '@/constants/theme';
import {
  DISCOVERY_GENDER_LABELS,
  DISCOVERY_GENDERS,
  type Gender,
  getDiscoveryPreferences,
  setDiscoveryPreferences,
} from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';

interface DiscoveryPreferencesFormProps {
  onSaved: () => void;
  submitLabel?: string;
}

const GENDER_OPTIONS: (Gender | '')[] = ['', ...DISCOVERY_GENDERS];
const COUNTRY_ANY = 'Any country';
const COUNTRY_OPTIONS = [COUNTRY_ANY, ...COUNTRIES];
const MIN_ALLOWED_AGE = 18;
const MAX_ALLOWED_AGE = 100;

const genderOptionLabel = (option: Gender | '') => (
  option === '' ? 'Any' : DISCOVERY_GENDER_LABELS[option]
);

const sanitizeAge = (text: string) => text.replace(/[^0-9]/g, '').slice(0, 3);

export function DiscoveryPreferencesForm({
  onSaved,
  submitLabel = 'Save changes',
}: DiscoveryPreferencesFormProps) {
  const theme = useTheme();
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [country, setCountry] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getDiscoveryPreferences()
      .then((preferences) => {
        if (!active) {
          return;
        }
        setMinAge(preferences.minAge === '' ? '' : String(preferences.minAge));
        setMaxAge(preferences.maxAge === '' ? '' : String(preferences.maxAge));
        setGender(preferences.gender);
        setCountry(preferences.country);
        setInterests(preferences.interests);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    const parsedMin = minAge.trim() ? Number(minAge) : null;
    const parsedMax = maxAge.trim() ? Number(maxAge) : null;

    if (parsedMin !== null && (parsedMin < MIN_ALLOWED_AGE || parsedMin > MAX_ALLOWED_AGE)) {
      setError(`Minimum age must be between ${MIN_ALLOWED_AGE} and ${MAX_ALLOWED_AGE}.`);
      return;
    }
    if (parsedMax !== null && (parsedMax < MIN_ALLOWED_AGE || parsedMax > MAX_ALLOWED_AGE)) {
      setError(`Maximum age must be between ${MIN_ALLOWED_AGE} and ${MAX_ALLOWED_AGE}.`);
      return;
    }
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      setError('Minimum age cannot be greater than maximum age.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await setDiscoveryPreferences({
        minAge: parsedMin ?? '',
        maxAge: parsedMax ?? '',
        gender,
        country,
        interests,
      });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={theme.text} />
        <ThemedText type="small" themeColor="textSecondary">
          Loading preferences...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <View style={styles.field}>
          <ThemedText type="smallBold">Minimum age</ThemedText>
          <TextInput
            value={minAge}
            onChangeText={(text) => {
              setMinAge(sanitizeAge(text));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={3}
            placeholder='age'
            placeholderTextColor={theme.iconMuted}
            style={[styles.input, { borderColor: theme.tabActiveBorder, color: theme.text }]}
          />
        </View>
        <View style={styles.field}>
          <ThemedText type="smallBold">Maximum age</ThemedText>
          <TextInput
            value={maxAge}
            onChangeText={(text) => {
              setMaxAge(sanitizeAge(text));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={3}
            placeholder='age'
            placeholderTextColor={theme.iconMuted}
            style={[styles.input, { borderColor: theme.tabActiveBorder, color: theme.text }]}
          />
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <ThemedText type="smallBold">Gender</ThemedText>
        <View style={styles.segmented}>
          {GENDER_OPTIONS.map((option) => {
            const selected = option === gender;
            return (
              <TouchableOpacity
                key={option || 'any'}
                onPress={() => setGender(option)}
                style={[
                  styles.segment,
                  {
                    borderColor: theme.tabActiveBorder,
                    backgroundColor: selected ? theme.backgroundElement : 'transparent',
                  },
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={[styles.segmentText, selected && styles.segmentTextSelected]}
                >
                  {genderOptionLabel(option)}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.fieldBlock, styles.countryFieldBlock]}>
        <ThemedText type="smallBold">Country</ThemedText>
        <SelectField
          value={country || COUNTRY_ANY}
          options={COUNTRY_OPTIONS}
          onChange={(value) => setCountry(value === COUNTRY_ANY ? '' : value)}
          placeholder="Any country"
          title="Country"
          searchable
          inlineOnWeb
        />
      </View>

      <View style={styles.fieldBlock}>
        <ThemedText type="smallBold">Interests</ThemedText>
        <InterestsSelect value={interests} onChange={setInterests} requireMin={false} />
      </View>

      {error ? <ThemedText type="small" style={styles.errorText}>{error}</ThemedText> : null}

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={[styles.button, { borderColor: '#6249cabe' }]}
      >
        {saving ? (
          <ActivityIndicator color="#8769ff" />
        ) : (
          <SymbolView
            name={{ ios: 'save', android: 'save', web: 'save' } as any}
            tintColor="#8769ffbe"
            size={20}
          />
        )}
        <ThemedText type="smallBold">{submitLabel}</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
    width: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  field: {
    flex: 1,
    gap: Spacing.one,
  },
  fieldBlock: {
    gap: Spacing.one,
  },
  countryFieldBlock: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  segment: {
    flexGrow: 1,
    minWidth: '22%',
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  segmentText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: '#ffffff',
  },
  errorText: {
    color: '#ef4444',
  },
  button: {
    minHeight: 48,
    minWidth: 200,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: 1,
  },
});
