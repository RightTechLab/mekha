import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import {
  getMenuById,
  updateMenu,
  getOptionGroups,
  getOptionItems,
  createOptionGroup,
  createOptionItem,
  deleteOptionGroup,
  getAllCategories,
} from '../../../src/db/repositories/menuRepo';
import type { CategoryItem } from '../../../src/db/repositories/menuRepo';

export default function MenuDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const menu = getMenuById(id);
  const allCategories: CategoryItem[] = getAllCategories();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(menu?.name ?? '');
  const [price, setPrice] = useState(menu?.price.toString() ?? '');
  const [category, setCategory] = useState(menu?.category ?? '');
  const [imagePath, setImagePath] = useState<string | null>(menu?.image_path ?? null);

  // Option groups
  const optionGroups = menu ? getOptionGroups(menu.id) : [];

  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  if (!menu) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-mekha-muted">ไม่พบเมนู</Text>
      </SafeAreaView>
    );
  }

  const handleSave = () => {
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum)) return;

    updateMenu(id, {
      name: name.trim(),
      price: priceNum,
      category: category.trim() || null,
      image_path: imagePath,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const base64 = await getBase64(asset.uri);
        setImagePath(base64);
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถเลือกรูปได้');
    }
  };

  const getBase64 = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    createOptionGroup({
      id: Crypto.randomUUID(),
      menu_id: menu.id,
      name: newGroupName.trim(),
      required: 0,
      multiple: 0,
    });
    setNewGroupName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddItem = (groupId: string) => {
    if (!newItemName.trim()) return;
    createOptionItem({
      id: Crypto.randomUUID(),
      option_group_id: groupId,
      name: newItemName.trim(),
      price_delta: parseFloat(newItemPrice) || 0,
    });
    setNewItemName('');
    setNewItemPrice('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-xl font-bold text-mekha-text">แก้ไขเมนู</Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-mekha-muted">ปิด</Text>
          </Pressable>
        </View>

        <TextInput
          className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
          placeholder="ชื่อเมนู"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
          placeholder="ราคา (฿)"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />

        {/* Category dropdown */}
        <View className="mb-3">
          <Text className="text-sm text-mekha-muted mb-1.5">หมวดหมู่</Text>
          {allCategories.length > 0 ? (
            <View className="bg-mekha-surface border border-mekha-border rounded-xl overflow-hidden">
              <ScrollView horizontal={false} style={{ maxHeight: 150 }} nestedScrollEnabled>
                {allCategories.map((cat) => {
                  const isSelected = category === cat.name;
                  return (
                    <Pressable
                      key={cat.id}
                      className={`px-4 py-3 border-b border-mekha-border ${
                        isSelected ? 'bg-purple-50' : ''
                      }`}
                      onPress={() => setCategory(isSelected ? '' : cat.name)}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className={`text-sm ${isSelected ? 'text-purple-700 font-semibold' : 'text-mekha-text'}`}>
                          {cat.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Text className="text-amber-700 text-sm text-center">
                ยังไม่มีหมวดหมู่ — ไปสร้างที่หน้าจัดการเมนูก่อน
              </Text>
            </View>
          )}
          {category ? (
            <Text className="text-xs text-purple-600 mt-1">เลือก: {category}</Text>
          ) : null}
        </View>

        {/* Image Picker */}
        {imagePath && (
          <View className="mb-4 rounded-xl overflow-hidden">
            <Image
              source={{ uri: imagePath }}
              className="w-full h-48"
              resizeMode="cover"
            />
            <Pressable
              className="absolute top-2 right-2 bg-red-500 rounded-full p-2"
              onPress={() => setImagePath(null)}
            >
              <Text className="text-white text-xs font-bold">✕</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          className="bg-blue-500 py-3 rounded-xl items-center mb-4"
          onPress={handlePickImage}
        >
          <Text className="text-white font-semibold">
            {imagePath ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
          </Text>
        </Pressable>

        <Pressable
          className="bg-purple-600 py-3 rounded-xl items-center mb-8"
          onPress={handleSave}
        >
          <Text className="text-white font-semibold">บันทึก</Text>
        </Pressable>

        {/* Option Groups */}
        <Text className="text-lg font-bold text-mekha-text mb-3">ตัวเลือก (Options)</Text>

        {optionGroups.map((group) => {
          const items = getOptionItems(group.id);
          return (
            <View
              key={group.id}
              className="mb-4 p-4 bg-mekha-surface border border-mekha-border rounded-2xl"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-semibold text-mekha-text">{group.name}</Text>
                <Pressable onPress={() => deleteOptionGroup(group.id)}>
                  <Text className="text-red-700 text-xs">ลบกลุ่ม</Text>
                </Pressable>
              </View>
              {items.map((item) => (
                <View key={item.id} className="flex-row justify-between py-1">
                  <Text className="text-mekha-text text-sm">{item.name}</Text>
                  <Text className="text-mekha-muted text-sm">
                    {item.price_delta > 0 ? `+฿${item.price_delta}` : 'ฟรี'}
                  </Text>
                </View>
              ))}
              {activeGroupId === group.id ? (
                <View className="mt-2 flex-row gap-2">
                  <TextInput
                    className="flex-1 bg-white border border-mekha-border rounded-lg px-3 py-2 text-sm"
                    placeholder="ชื่อ"
                    value={newItemName}
                    onChangeText={setNewItemName}
                  />
                  <TextInput
                    className="w-20 bg-white border border-mekha-border rounded-lg px-3 py-2 text-sm"
                    placeholder="+฿"
                    value={newItemPrice}
                    onChangeText={setNewItemPrice}
                    keyboardType="decimal-pad"
                  />
                  <Pressable
                    className="bg-purple-600 px-3 py-2 rounded-lg"
                    onPress={() => handleAddItem(group.id)}
                  >
                    <Text className="text-white text-sm">+</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  className="mt-2"
                  onPress={() => setActiveGroupId(group.id)}
                >
                  <Text className="text-purple-600 text-sm">+ เพิ่มตัวเลือก</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Add new group */}
        <View className="flex-row gap-2 mb-8">
          <TextInput
            className="flex-1 bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3"
            placeholder="ชื่อกลุ่มตัวเลือกใหม่"
            value={newGroupName}
            onChangeText={setNewGroupName}
          />
          <Pressable
            className="bg-purple-50 px-4 rounded-xl items-center justify-center"
            onPress={handleAddGroup}
          >
            <Text className="text-purple-700 font-semibold">เพิ่ม</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
