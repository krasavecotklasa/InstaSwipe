import { Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

interface HeaderProps {
    title?: string;
}

export default function Header({ title = 'InstaSwipe' }: HeaderProps) {
    const { isMobileWeb } = useResponsiveLayout();

    if (Platform.OS === 'web' && !isMobileWeb) {
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
