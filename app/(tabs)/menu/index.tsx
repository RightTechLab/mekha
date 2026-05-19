import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, FlatList } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import {
  getAllMenus,
  createMenu,
  deleteMenu,
  getMenuCategories,
} from '../../../src/db/repositories/menuRepo';
import type { Menu } from '../../../src/types';

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [showCatSuggest, setShowCatSuggest] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      setMenus(getAllMenus());
      setCategories(getMenuCategories());
    }, [refreshKey])
  );

  const handleAdd = useCallback(() => {
    if (!name.trim() || !price.trim()) return;

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) return;

    createMenu({
      id: Crypto.randomUUID(),
      name: name.trim(),
      price: priceNum,
      category: category.trim() || null,
      image_path: null,
      is_active: 1,
      sort_order: 0,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName('');
    setPrice('');
    setCategory('');
    setShowAdd(false);
    setRefreshKey((k) => k + 1);
  }, [name, price, category]);

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

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-mekha-text">จัดการเมนู</Text>
        <Pressable
          className="bg-purple-600 px-4 py-2 rounded-full"
          onPress={() => setShowAdd(!showAdd)}
        >
          <Text className="text-white font-medium text-sm">
            {showAdd ? 'ยกเลิก' : '+ เพิ่ม'}
          </Text>
        </Pressable>
      </View>

      {showAdd && (
        <View className="mx-4 mb-4 p-4 bg-mekha-surface border border-mekha-border rounded-2xl">
          <TextInput
            className="bg-white border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
            placeholder="ชื่อเมนู"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            className="bg-white border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
            placeholder="ราคา (฿)"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <View>
            <TextInput
              className="bg-white border border-mekha-border rounded-xl px-4 py-3 mb-1 text-mekha-text"
              placeholder="หมวดหมู่ (ไม่บังคับ)"
              value={category}
              onChangeText={(text) => {
                setCategory(text);
                setShowCatSuggest(text.length > 0);
              }}
              onFocus={() => setShowCatSuggest(true)}
              onBlur={() => setTimeout(() => setShowCatSuggest(false), 200)}
            />
            {showCatSuggest && categories.filter((c) => c.toLowerCase().includes(category.toLowerCase())).length > 0 && (
              <View className="bg-white border border-mekha-border rounded-xl mb-2 overflow-hidden">
                {categories
                  .filter((c) => c.toLowerCase().includes(category.toLowerCase()))
                  .map((c) => (
                    <Pressable
                      key={c}
                      className="px-4 py-2.5 border-b border-mekha-border active:bg-purple-50"
                      onPress={() => {
                        setCategory(c);
                        setShowCatSuggest(false);
                      }}
                    >
                      <Text className="text-sm text-mekha-text">{c}</Text>
                    </Pressable>
                  ))}
              </View>
            )}
          </View>
          <Pressable
            className="bg-purple-600 py-3 rounded-xl items-center"
            onPress={handleAdd}
          >
            <Text className="text-white font-semibold">บันทึก</Text>
          </Pressable>
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
              onPress={() => router.push(`/(tabs)/menu/${item.id}`)}
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
    </SafeAreaView>
  );
}
