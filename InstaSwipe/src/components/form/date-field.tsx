import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectField } from '@/components/form/select-field';
import { Spacing } from '@/constants/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DateFieldProps {
  value: string | null; // 'YYYY-MM-DD' or empty
  onChange: (value: string) => void;
  minAge?: number;
  maxAge?: number;
}

const pad = (part: string) => String(Number(part)).padStart(2, '0');
const daysInMonth = (year: number, monthIndex1: number) => new Date(year, monthIndex1, 0).getDate();

interface Parts {
  year: string | null;
  month: string | null; // month NAME, matching the dropdown options
  day: string | null;
}

const parseDate = (value: string | null): Parts => {
  if (!value) {
    return { year: null, month: null, day: null };
  }
  const [y, m, d] = value.split('-');
  const monthIndex = Number(m) - 1;
  return {
    year: y || null,
    month: monthIndex >= 0 && monthIndex < 12 ? MONTHS[monthIndex] : null,
    day: d ? String(Number(d)) : null,
  };
};

/**
 * Birth-date picker built from three bounded dropdowns. The year list only spans
 * [thisYear - maxAge, thisYear - minAge], so out-of-range years (e.g. 1 or 1000)
 * and under-18 years simply cannot be selected. Emits an ISO 'YYYY-MM-DD' string.
 */
export function DateField({ value, onChange, minAge = 18, maxAge = 100 }: DateFieldProps) {
  const initial = parseDate(value);
  const [year, setYear] = useState<string | null>(initial.year);
  const [month, setMonth] = useState<string | null>(initial.month);
  const [day, setDay] = useState<string | null>(initial.day);
  const [activeField, setActiveField] = useState<'month' | 'day' | 'year' | null>(null);
  const [syncedValue, setSyncedValue] = useState(value);

  // Re-sync when the parent value changes externally (e.g. profile hydration in
  // update mode). Our own emits set value to the same parts, so this is idempotent;
  // partial selections don't change value, so they are never clobbered. Done during
  // render (React's documented alternative to an Effect for this) rather than in an
  // Effect, since there's no external system involved - just local state.
  if (value !== syncedValue) {
    setSyncedValue(value);
    const parts = parseDate(value);
    setYear(parts.year);
    setMonth(parts.month);
    setDay(parts.day);
  }

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const result: string[] = [];
    for (let y = currentYear - minAge; y >= currentYear - maxAge; y--) {
      result.push(String(y));
    }
    return result;
  }, [currentYear, minAge, maxAge]);

  const days = useMemo(() => {
    const monthIndex1 = month ? MONTHS.indexOf(month) + 1 : 0;
    const count = year && monthIndex1 ? daysInMonth(Number(year), monthIndex1) : 31;
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }, [year, month]);

  const applyChange = (nextYear: string | null, nextMonth: string | null, nextDay: string | null) => {
    let d = nextDay;
    if (nextYear && nextMonth && nextDay) {
      const maxDay = daysInMonth(Number(nextYear), MONTHS.indexOf(nextMonth) + 1);
      if (Number(nextDay) > maxDay) {
        d = String(maxDay);
      }
    }
    setYear(nextYear);
    setMonth(nextMonth);
    setDay(d);

    if (nextYear && nextMonth && d) {
      const iso = `${nextYear}-${pad(String(MONTHS.indexOf(nextMonth) + 1))}-${pad(d)}`;
      if (iso !== value) {
        onChange(iso);
      }
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.monthField}>
        <SelectField
          value={month}
          options={MONTHS}
          onChange={(m) => applyChange(year, m, day)}
          placeholder="Month"
          title="Month"
          inlineOnWeb
          open={activeField === 'month'}
          onOpenChange={(open) => setActiveField(open ? 'month' : null)}
        />
      </View>
      <View style={styles.dayField}>
        <SelectField
          value={day}
          options={days}
          onChange={(d) => applyChange(year, month, d)}
          placeholder="Day"
          title="Day"
          inlineOnWeb
          open={activeField === 'day'}
          onOpenChange={(open) => setActiveField(open ? 'day' : null)}
        />
      </View>
      <View style={styles.yearField}>
        <SelectField
          value={year}
          options={years}
          onChange={(y) => applyChange(y, month, day)}
          placeholder="Year"
          title="Year"
          inlineOnWeb
          open={activeField === 'year'}
          onOpenChange={(open) => setActiveField(open ? 'year' : null)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    position: 'relative',
    zIndex: 10,
  },
  monthField: {
    flex: 1.5,
  },
  dayField: {
    flex: 1,
  },
  yearField: {
    flex: 1.2,
  },
});
