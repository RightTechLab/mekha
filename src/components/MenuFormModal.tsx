import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image, Alert, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import {
  getMenuById,
  updateMenu,
  createMenu,
  getOptionGroups,
  getOptionItems,
  createOptionGroup,
  createOptionItem,
  deleteOptionGroup,
  getAllCategories,
} from '../db/repositories/menuRepo';
import type { CategoryItem } from '../db/repositories/menuRepo';
import type { Menu, OptionGroup, OptionItem } from '../types';
import { DARK_PLACEHOLDER, LIGHT_PLACEHOLDER } from '../constants/theme';

interface Props {
  visible: boolean;
  menuId: string | null; // null = create mode, string = edit mode
  onClose: () => void;
  onSaved: () => void;
}

export default function MenuFormModal({ visible, menuId, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const placeholderColor = isDark ? DARK_PLACEHOLDER : LIGHT_PLACEHOLDER;
  const mutedIconColor = isDark ? '#A1A1AA' : '#6B7280';
  const isEditMode = menuId !== null;
  const menu = menuId ? getMenuById(menuId) : null;
  const allCategories: CategoryItem[] = getAllCategories();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [optionGroups, setOptionGroups] = useState<(OptionGroup & { items: OptionItem[] })[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      if (menu) {
        setName(menu.name);
        setPrice(menu.price.toString());
        setCategory(menu.category ?? '');
        setImagePath(menu.image_path ?? null);
        const groups = getOptionGroups(menu.id);
        setOptionGroups(groups.map(g => ({ ...g, items: getOptionItems(g.id) })));
      } else {
        setName('');
        setPrice('');
        setCategory('');
        setImagePath(null);
        setOptionGroups([]);
      }
      setNewGroupName('');
      setNewItemName('');
      setNewItemPrice('');
      setActiveGroupId(null);
    }
  }, [visible, menuId]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSave = () => {
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('กรุณากรอกข้อมูล', 'ต้องมีชื่อและราคา');
      return;
    }

    if (isEditMode && menuId) {
      updateMenu(menuId, {
        name: name.trim(),
        price: priceNum,
        category: category.trim() || null,
        image_path: imagePath,
      });
    } else {
      createMenu({
        id: Crypto.randomUUID(),
        name: name.trim(),
        price: priceNum,
        category: category.trim() || null,
        image_path: imagePath,
        is_active: 1,
        sort_order: 0,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved();
    handleDismiss();
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
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const base64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setImagePath(base64);
      }
    } catch {
      Alert.alert('ผิดพลาด', 'ไม่สามารถเลือกรูปได้');
    }
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim() || !menuId) return;
    const newGroup: OptionGroup = {
      id: Crypto.randomUUID(),
      menu_id: menuId,
      name: newGroupName.trim(),
      required: 0,
      multiple: 0,
    };
    createOptionGroup(newGroup);
    setOptionGroups([...optionGroups, { ...newGroup, items: [] }]);
    setNewGroupName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddItem = (groupId: string) => {
    if (!newItemName.trim()) return;
    const newItem: OptionItem = {
      id: Crypto.randomUUID(),
      option_group_id: groupId,
      name: newItemName.trim(),
      price_delta: parseFloat(newItemPrice) || 0,
    };
    createOptionItem(newItem);
    setOptionGroups(optionGroups.map(g =>
      g.id === groupId ? { ...g, items: [...g.items, newItem] } : g
    ));
    setNewItemName('');
    setNewItemPrice('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteGroup = (groupId: string) => {
    deleteOptionGroup(groupId);
    setOptionGroups(optionGroups.filter(g => g.id !== groupId));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const translateY = useSharedValue(600);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      overlayOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(600, { duration: 250 });
      overlayOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handleDismiss = () => {
    translateY.value = withTiming(600, { duration: 250 });
    overlayOpacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  return (
    <Modal visible={visible} animationType="none" transparent>
      <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-1 justify-end">
          <TouchableWithoutFeedback onPress={handleDismiss}>
            <Animated.View className="absolute inset-0 bg-black/50" style={overlayStyle} />
          </TouchableWithoutFeedback>
          <Animated.View
            className="bg-white dark:bg-neutral-950 rounded-t-3xl max-h-[90%]"
            style={[sheetStyle, keyboardHeight > 0 ? { height: '90%' } : undefined]}
          >
            {/* Header */}
            <View className="px-5 pt-5 pb-3 border-b border-mekha-border dark:border-neutral-800 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-mekha-text dark:text-neutral-50">
                {isEditMode ? 'แก้ไขเมนู' : 'เพิ่มเมนู'}
              </Text>
              <Pressable onPress={handleDismiss} className="p-2">
                <Ionicons name="close" size={22} color={mutedIconColor} />
              </Pressable>
            </View>

            <ScrollView
              className="px-5 py-4"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <TextInput
                className="bg-mekha-surface dark:bg-neutral-900 border border-mekha-border dark:border-neutral-800 rounded-xl px-4 py-3 mb-3 text-mekha-text dark:text-neutral-50"
                placeholder="ชื่อเมนู"
                placeholderTextColor={placeholderColor}
                value={name}
                onChangeText={setName}
              />
              <TextInput
                className="bg-mekha-surface dark:bg-neutral-900 border border-mekha-border dark:border-neutral-800 rounded-xl px-4 py-3 mb-3 text-mekha-text dark:text-neutral-50"
                placeholder="ราคา (฿)"
                placeholderTextColor={placeholderColor}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />

              {/* Category dropdown */}
              <View className="mb-3">
                <Text className="text-sm text-mekha-muted dark:text-neutral-400 mb-1.5">หมวดหมู่</Text>
                {allCategories.length > 0 ? (
                  <View className="bg-mekha-surface dark:bg-neutral-900 border border-mekha-border dark:border-neutral-800 rounded-xl overflow-hidden">
                    <ScrollView horizontal={false} style={{ maxHeight: 150 }} nestedScrollEnabled>
                      {allCategories.map((cat) => {
                        const isSelected = category === cat.name;
                        return (
                          <Pressable
                            key={cat.id}
                            className={`px-4 py-3 border-b border-mekha-border dark:border-neutral-800 ${isSelected ? 'bg-purple-50 dark:bg-purple-950' : ''}`}
                            onPress={() => setCategory(isSelected ? '' : cat.name)}
                          >
                            <View className="flex-row items-center justify-between">
                              <Text className={`text-sm ${isSelected ? 'text-purple-700 dark:text-purple-300 font-semibold' : 'text-mekha-text dark:text-neutral-50'}`}>
                                {cat.name}
                              </Text>
                              {isSelected && <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />}
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <View className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
                    <Text className="text-amber-700 dark:text-amber-200 text-sm text-center">ยังไม่มีหมวดหมู่</Text>
                  </View>
                )}
                {category ? <Text className="text-xs text-purple-600 dark:text-purple-300 mt-1">เลือก: {category}</Text> : null}
              </View>

              {/* Image */}
              {imagePath && (
                <View className="mb-3 rounded-xl overflow-hidden">
                  <Image source={{ uri: imagePath }} className="w-full h-40" resizeMode="cover" />
                  <Pressable
                    className="absolute top-2 right-2 bg-red-500 rounded-full p-2"
                    onPress={() => setImagePath(null)}
                  >
                    <Text className="text-white text-xs font-bold">✕</Text>
                  </Pressable>
                </View>
              )}
              <Pressable className="bg-blue-500 py-3 rounded-xl items-center mb-4" onPress={handlePickImage}>
                <Text className="text-white font-semibold">{imagePath ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}</Text>
              </Pressable>

              {/* Option Groups — only in edit mode */}
              {isEditMode && (
                <>
                  <Text className="text-base font-bold text-mekha-text dark:text-neutral-50 mb-3">ตัวเลือก (Options)</Text>
                  {optionGroups.map((group) => (
                    <View key={group.id} className="mb-3 p-3 bg-mekha-surface dark:bg-neutral-900 border border-mekha-border dark:border-neutral-800 rounded-xl">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-semibold text-mekha-text dark:text-neutral-50 text-sm">{group.name}</Text>
                        <Pressable onPress={() => handleDeleteGroup(group.id)}>
                          <Text className="text-red-700 dark:text-red-400 text-xs">ลบกลุ่ม</Text>
                        </Pressable>
                      </View>
                      {group.items.map((item) => (
                        <View key={item.id} className="flex-row justify-between py-1">
                          <Text className="text-mekha-text dark:text-neutral-50 text-sm">{item.name}</Text>
                          <Text className="text-mekha-muted dark:text-neutral-400 text-sm">
                            {item.price_delta > 0 ? `+฿${item.price_delta}` : 'ฟรี'}
                          </Text>
                        </View>
                      ))}
                      {activeGroupId === group.id ? (
                        <View className="mt-2 flex-row gap-2">
                          <TextInput
                            className="flex-1 bg-white dark:bg-neutral-950 border border-mekha-border dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-mekha-text dark:text-neutral-50"
                            placeholder="ชื่อ"
                            placeholderTextColor={placeholderColor}
                            value={newItemName}
                            onChangeText={setNewItemName}
                          />
                          <TextInput
                            className="w-20 bg-white dark:bg-neutral-950 border border-mekha-border dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-mekha-text dark:text-neutral-50"
                            placeholder="+฿"
                            placeholderTextColor={placeholderColor}
                            value={newItemPrice}
                            onChangeText={setNewItemPrice}
                            keyboardType="decimal-pad"
                          />
                          <Pressable className="bg-purple-600 px-3 py-2 rounded-lg" onPress={() => handleAddItem(group.id)}>
                            <Text className="text-white text-sm">+</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable className="mt-2" onPress={() => setActiveGroupId(group.id)}>
                          <Text className="text-purple-600 dark:text-purple-300 text-sm">+ เพิ่มตัวเลือก</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                  <View className="flex-row gap-2 mb-4">
                    <TextInput
                      className="flex-1 bg-mekha-surface dark:bg-neutral-900 border border-mekha-border dark:border-neutral-800 rounded-xl px-4 py-3 text-mekha-text dark:text-neutral-50"
                      placeholder="ชื่อกลุ่มตัวเลือกใหม่"
                      placeholderTextColor={placeholderColor}
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                    />
                    <Pressable className="bg-purple-50 dark:bg-purple-950 px-4 rounded-xl items-center justify-center" onPress={handleAddGroup}>
                      <Text className="text-purple-700 dark:text-purple-300 font-semibold">เพิ่ม</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Save button */}
            <View className="px-5 pt-3 border-t border-mekha-border dark:border-neutral-800 bg-white dark:bg-neutral-950" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <Pressable className="w-full py-4 rounded-2xl items-center bg-purple-600 active:bg-purple-700" onPress={handleSave}>
                <Text className="text-white font-semibold text-base">
                  {isEditMode ? 'บันทึก' : 'เพิ่มเมนู'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
