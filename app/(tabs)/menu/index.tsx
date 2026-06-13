import { useState, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import {
  getAllMenus,
  deleteMenu,
  getMenuCategories,
} from '../../../src/db/repositories/menuRepo';
import MenuFormModal from '../../../src/components/MenuFormModal';
import CategoryFormModal from '../../../src/components/CategoryFormModal';
import type { Menu } from '../../../src/types';

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editMenuId, setEditMenuId] = useState<string | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      setMenus(getAllMenus());
      setCategories(getMenuCategories());
    }, [refreshKey])
  );

  const handleOpenAddMenu = useCallback(() => {
    setEditMenuId(null);
    setShowMenuModal(true);
  }, []);

  const handleOpenEditMenu = useCallback((id: string) => {
    setEditMenuId(id);
    setShowMenuModal(true);
  }, []);

  const handleMenuSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDelete = useCallback((id: string, menuName: string) => {
    Alert.alert('ปิดใช้งานเมนู', `ต้องการปิดใช้งาน "${menuName}" หรือไม่?\nเมนูจะหายจากหน้าขาย แต่ประวัติการขายเดิมจะยังอยู่`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ปิดใช้งาน',
        style: 'destructive',
        onPress: () => {
          deleteMenu(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setRefreshKey((k) => k + 1);
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-mekha-text">จัดการเมนู</Text>
        <View className="flex-row gap-2">
          <Pressable
            className="px-3 py-2 rounded-full bg-purple-50"
            onPress={() => setShowCatModal(true)}
          >
            <Text className="text-purple-700 font-medium text-sm">หมวดหมู่</Text>
          </Pressable>
          <Pressable
            className="bg-purple-600 px-4 py-2 rounded-full"
            onPress={handleOpenAddMenu}
          >
            <Text className="text-white font-medium text-sm">+ เพิ่ม</Text>
          </Pressable>
        </View>
      </View>

      {menus.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-mekha-muted">ยังไม่มีเมนู</Text>
        </View>
      ) : (
        <FlashList
          key={refreshKey}
          data={menus}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <Pressable
              className="flex-row items-center justify-between py-4 px-4 mb-2 bg-mekha-surface border border-mekha-border rounded-2xl"
              onPress={() => handleOpenEditMenu(item.id)}
              onLongPress={() => handleDelete(item.id, item.name)}
            >
              <View className="flex-1">
                <Text className="text-base font-medium text-mekha-text">{item.name}</Text>
                {item.category && (
                  <Text className="text-xs text-mekha-muted mt-0.5">{item.category}</Text>
                )}
              </View>
              <Text className="text-base font-semibold text-purple-600">
                ฿{item.price.toFixed(0)}
              </Text>
            </Pressable>
          )}
        />
      )}

      {/* Unified Menu Form Modal — for both add and edit */}
      <MenuFormModal
        visible={showMenuModal}
        menuId={editMenuId}
        onClose={() => setShowMenuModal(false)}
        onSaved={handleMenuSaved}
      />

      {/* Category Management Modal */}
      <CategoryFormModal
        visible={showCatModal}
        onClose={() => setShowCatModal(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </SafeAreaView>
  );
}
