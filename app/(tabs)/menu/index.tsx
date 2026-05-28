import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import {
  getAllMenus,
  deleteMenu,
  getMenuCategories,
  getAllCategories,
  createCategory,
  deleteCategory,
} from '../../../src/db/repositories/menuRepo';
import MenuFormModal from '../../../src/components/MenuFormModal';
import type { CategoryItem } from '../../../src/db/repositories/menuRepo';
import type { Menu } from '../../../src/types';

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editMenuId, setEditMenuId] = useState<string | null>(null);
  const [showCatManage, setShowCatManage] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [userCategories, setUserCategories] = useState<CategoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setMenus(getAllMenus());
      setCategories(getMenuCategories());
      setUserCategories(getAllCategories());
    }, [refreshKey])
  );

  const handleOpenAddMenu = useCallback(() => {
    setEditMenuId(null);
    setShowMenuModal(true);
    setShowCatManage(false);
  }, []);

  const handleOpenEditMenu = useCallback((id: string) => {
    setEditMenuId(id);
    setShowMenuModal(true);
    setShowCatManage(false);
  }, []);

  const handleMenuSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDelete = useCallback((id: string, menuName: string) => {
    Alert.alert('ลบเมนู', `ต้องการลบ "${menuName}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () => {
          deleteMenu(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setRefreshKey((k) => k + 1);
        },
      },
    ]);
  }, []);

  const handleAddCategory = useCallback(() => {
    if (!newCatName.trim()) return;
    createCategory({
      id: Crypto.randomUUID(),
      name: newCatName.trim(),
      color: null,
      sort_order: userCategories.length,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewCatName('');
    setRefreshKey((k) => k + 1);
  }, [newCatName, userCategories.length]);

  const handleDeleteCategory = useCallback((id: string, catName: string) => {
    Alert.alert('ลบหมวดหมู่', `ต้องการลบ "${catName}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () => {
          deleteCategory(id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            className={`px-3 py-2 rounded-full ${showCatManage ? 'bg-purple-100' : 'bg-purple-50'}`}
            onPress={() => { setShowCatManage(!showCatManage); }}
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

      {/* Category Management */}
      {showCatManage && (
        <View className="mx-4 mb-4 p-4 bg-mekha-surface border border-mekha-border rounded-2xl">
          <Text className="text-base font-semibold text-mekha-text mb-3">จัดการหมวดหมู่</Text>
          <View className="flex-row gap-2 mb-3">
            <TextInput
              className="flex-1 bg-white border border-mekha-border rounded-xl px-4 py-3 text-mekha-text"
              placeholder="ชื่อหมวดหมู่ใหม่"
              value={newCatName}
              onChangeText={setNewCatName}
            />
            <Pressable
              className="bg-purple-600 px-4 rounded-xl items-center justify-center"
              onPress={handleAddCategory}
            >
              <Text className="text-white font-semibold">เพิ่ม</Text>
            </Pressable>
          </View>
          {userCategories.length > 0 ? (
            <View className="bg-white border border-mekha-border rounded-xl">
              {userCategories.map((cat) => (
                <View
                  key={cat.id}
                  className="flex-row items-center justify-between px-4 py-3 border-b border-mekha-border"
                >
                  <Text className="text-sm font-medium text-mekha-text">{cat.name}</Text>
                  <Pressable
                    className="bg-red-50 px-3 py-1 rounded-lg"
                    onPress={() => handleDeleteCategory(cat.id, cat.name)}
                  >
                    <Text className="text-red-700 text-xs font-medium">ลบ</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-mekha-muted">ยังไม่มีหมวดหมู่ เพิ่มด้านบน</Text>
          )}
        </View>
      )}

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
    </SafeAreaView>
  );
}
