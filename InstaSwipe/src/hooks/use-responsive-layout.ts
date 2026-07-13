import { Platform, useWindowDimensions } from 'react-native';

export const MOBILE_WEB_BREAKPOINT = 768;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isMobileWeb = Platform.OS === 'web' && width <= MOBILE_WEB_BREAKPOINT;

  return {
    width,
    height,
    isMobileWeb,
    isDesktopWeb: Platform.OS === 'web' && !isMobileWeb,
    usesBottomTabs: Platform.OS !== 'web' || isMobileWeb,
  };
}
