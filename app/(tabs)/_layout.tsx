import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '@/stores/authStore';
import { usePantryStore } from '@/stores/pantryStore';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useThemeColors } from '@/stores/themeStore';
import { useMemo, useState, useCallback } from 'react';
import { RadialFAB, FABAction } from '@/components/ui/RadialFAB';
import { URLImportModal } from '@/components/import/URLImportModal';
import { CookbookScanner } from '@/components/import/CookbookScanner';

const TAB_BAR_HEIGHT = 80;
const NOTCH_WIDTH = 110;
const NOTCH_DEPTH = 38;
const BORDER_RADIUS = 30;

const styles = StyleSheet.create({
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  svgShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 40,
    height: 32,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)', // Will be overridden per-instance
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  badgePrimary: {
    backgroundColor: '#F97316',
  },
  badgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  fabPlaceholder: {
    top: -20,
  },
});

const TabBarBackground = ({ width, fill }: { width: number; fill: string }) => {
  const tabBarWidth = width - 40;

  const path = useMemo(() => {
    const center = tabBarWidth / 2;
    return `
      M ${BORDER_RADIUS} 0
      L ${center - NOTCH_WIDTH / 2 - 10} 0
      C ${center - NOTCH_WIDTH / 2 + 5} 0, ${center - NOTCH_WIDTH / 2 + 15} ${NOTCH_DEPTH * 0.5}, ${center - 20} ${NOTCH_DEPTH}
      Q ${center} ${NOTCH_DEPTH + 5}, ${center + 20} ${NOTCH_DEPTH}
      C ${center + NOTCH_WIDTH / 2 - 15} ${NOTCH_DEPTH * 0.5}, ${center + NOTCH_WIDTH / 2 - 5} 0, ${center + NOTCH_WIDTH / 2 + 10} 0
      L ${tabBarWidth - BORDER_RADIUS} 0
      Q ${tabBarWidth} 0, ${tabBarWidth} ${BORDER_RADIUS}
      L ${tabBarWidth} ${TAB_BAR_HEIGHT - BORDER_RADIUS}
      Q ${tabBarWidth} ${TAB_BAR_HEIGHT}, ${tabBarWidth - BORDER_RADIUS} ${TAB_BAR_HEIGHT}
      L ${BORDER_RADIUS} ${TAB_BAR_HEIGHT}
      Q 0 ${TAB_BAR_HEIGHT}, 0 ${TAB_BAR_HEIGHT - BORDER_RADIUS}
      L 0 ${BORDER_RADIUS}
      Q 0 0, ${BORDER_RADIUS} 0
      Z
    `;
  }, [tabBarWidth]);

  return (
    <View style={styles.tabBarBackground}>
      <Svg width={tabBarWidth} height={TAB_BAR_HEIGHT} style={styles.svgShadow}>
        <Path d={path} fill={fill} />
      </Svg>
    </View>
  );
};

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuthStore();
  const { getExpiringItems, getExpiredItems } = usePantryStore();
  const { shoppingList } = useWantToCookStore();
  const colors = useThemeColors();

  // Modal states for FAB actions
  const [showURLImport, setShowURLImport] = useState(false);
  const [showCookbookScanner, setShowCookbookScanner] = useState(false);

  const expiringCount = getExpiringItems().length + getExpiredItems().length;
  const shoppingCount = shoppingList.filter((i) => !i.checked).length;

  // FAB Actions
  const fabActions: FABAction[] = useMemo(() => [
    {
      id: 'import-url',
      icon: 'link',
      label: 'Import URL',
      color: '#6366F1',
      gradient: ['#6366F1', '#8B5CF6'] as [string, string],
      onPress: () => setShowURLImport(true),
    },
    {
      id: 'food-scanner',
      icon: 'nutrition',
      label: 'Food Scanner',
      color: '#10B981',
      gradient: ['#10B981', '#059669'] as [string, string],
      onPress: () => router.push('/(tabs)/scan'),
    },
    {
      id: 'cookbook-scan',
      icon: 'book',
      label: 'Scan Cookbook',
      color: '#F59E0B',
      gradient: ['#F59E0B', '#D97706'] as [string, string],
      onPress: () => setShowCookbookScanner(true),
    },
    {
      id: 'add-recipe',
      icon: 'create',
      label: 'Add Recipe',
      color: colors.accent,
      gradient: [colors.accent, colors.palette[400]] as [string, string],
      onPress: () => router.push('/(tabs)/upload'),
    },
  ], [router]);

  const handleImportSuccess = useCallback((title: string) => {
    // Could show a toast here
    console.log('Imported:', title);
  }, []);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarShowLabel: true,
          tabBarBackground: () => <TabBarBackground width={width} fill={colors.tabBarFill} />,
          tabBarStyle: {
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 28 : 16,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 20,
            height: TAB_BAR_HEIGHT,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowColor: 'transparent',
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 5,
            marginBottom: 6,
          },
          tabBarItemStyle: {
            flex: 1,
            marginTop: 8,
            justifyContent: 'center',
            alignItems: 'center',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
                <Ionicons
                  name={focused ? 'home' : 'home-outline'}
                  size={22}
                  color={color}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="pantry"
          options={{
            title: 'Pantry',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
                <Ionicons
                  name={focused ? 'basket' : 'basket-outline'}
                  size={22}
                  color={color}
                />
                {expiringCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {expiringCount > 9 ? '9+' : expiringCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: '',
            tabBarIcon: () => <View style={styles.fabPlaceholder} />,
          }}
          listeners={{
            tabPress: (e) => {
              // Prevent default navigation - the RadialFAB handles this
              e.preventDefault();
            },
          }}
        />
        <Tabs.Screen
          name="shopping"
          options={{
            title: 'Shopping',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
                <Ionicons
                  name={focused ? 'cart' : 'cart-outline'}
                  size={22}
                  color={color}
                />
                {shoppingCount > 0 && (
                  <View style={[styles.badge, styles.badgePrimary]}>
                    <Text style={styles.badgeText}>
                      {shoppingCount > 9 ? '9+' : shoppingCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
                <Ionicons
                  name={focused ? 'grid' : 'grid-outline'}
                  size={22}
                  color={color}
                />
              </View>
            ),
          }}
        />
        {/* Hidden tabs — accessible via navigation only */}
        <Tabs.Screen
          name="browse"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="mealplan"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Radial FAB Menu */}
      <RadialFAB actions={fabActions} />

      {/* Modals */}
      <URLImportModal
        visible={showURLImport}
        onClose={() => setShowURLImport(false)}
        onSuccess={handleImportSuccess}
      />
      <CookbookScanner
        visible={showCookbookScanner}
        onClose={() => setShowCookbookScanner(false)}
        onSuccess={handleImportSuccess}
      />
    </>
  );
}
