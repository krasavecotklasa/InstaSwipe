import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function Header() {
    const theme = useTheme();

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return null;
    }

    return (
        <View style={styles.header}>
            <ThemedText style={styles.logoText}>
                InstaSwipe
            </ThemedText>
            <View style={styles.headerActions}>
                <SymbolView
                    name={{ ios: 'bell', android: 'notifications', web: 'notifications' } as any}
                    tintColor={theme.text}
                    size={24}
                />
            </View>
        </View>
    );
}
const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        borderBottomWidth: 0.5,
        borderBottomColor: '#6f0bda26',
    },
    logoText: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
        color: '#7157db',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
    },
});