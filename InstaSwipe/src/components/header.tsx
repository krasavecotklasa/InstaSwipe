import { Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface HeaderProps {
    title?: string;
}

export default function Header({ title = 'InstaSwipe' }: HeaderProps) {

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return null;
    }

    return (
        <View style={styles.header}>
            <ThemedText style={styles.logoText}>
                {title}
            </ThemedText>
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
