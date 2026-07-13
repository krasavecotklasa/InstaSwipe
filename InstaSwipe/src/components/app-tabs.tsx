import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { TabBarHeight } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton iconName={{ ios: 'house.fill', android: 'home', web: 'home' }} />
          </TabTrigger>
          <TabTrigger name="match" href="/match" asChild>
            <TabButton iconName={{ ios: 'heart.fill', android: 'favorite', web: 'heart' }} />
          </TabTrigger>
          <TabTrigger name="messages" href="/messages" asChild>
            <TabButton iconName={{ ios: 'paperplane', android: 'send', web: 'message' }} />
          </TabTrigger>
          <TabTrigger name="search" href="/search" asChild>
            <TabButton iconName={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton iconName={{ ios: 'person.fill', android: 'person', web: 'person' }} />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  iconName: { ios: string; android: string; web: string };
};

function TabButton({ isFocused, iconName, ...props }: TabButtonProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const tintColor = isFocused
    ? (isDark ? '#d1c3e6c9' : '#40194a')
    : (isDark ? '#d1c3e666' : '#40194a66');

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <SymbolView
        tintColor={tintColor}
        name={iconName as ComponentProps<typeof SymbolView>['name']}
        size={24}
      />
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const tabBgColor = isDark ? '#121212' : '#ffffff';
  const borderTopColor = isDark ? '#2a2a2a' : '#e0e0e0';

  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={[styles.tabBar, { backgroundColor: tabBgColor, borderTopColor: borderTopColor }]}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    borderTopWidth: 0.25,
    height: TabBarHeight,
    paddingTop: 10,
  },
  tabButton: {
    flex: 1,
    marginBottom: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
