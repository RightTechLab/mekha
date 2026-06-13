import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import {
  getAllCategories,
  getCategoryMenuCounts,
  createCategory,
  deleteCategory,
} from '../db/repositories/menuRepo';
import type { CategoryItem } from '../db/repositories/menuRepo';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type CategoryWithUsage = CategoryItem & { menuCount: number };

export default function CategoryFormModal({ visible, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const loadCategories = () => {
    const counts = getCategoryMenuCounts();
    setCategories(
      getAllCategories().map((cat) => ({
        ...cat,
        menuCount: counts[cat.name.trim().toLowerCase()] ?? 0,
      }))
    );
  };

  useEffect(() => {
    if (visible) {
      loadCategories();
      setNewCatName('');
      setIsEditing(false);
      setSelectedCategoryIds([]);
    }
  }, [visible]);

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

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    createCategory({
      id: Crypto.randomUUID(),
      name: newCatName.trim(),
      color: null,
      sort_order: categories.length,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNewCatName('');
    loadCategories();
    onSaved();
  };

  const toggleEditMode = () => {
    setIsEditing((current) => {
      if (current) {
        setSelectedCategoryIds([]);
      }
      return !current;
    });
  };

  const toggleSelected = (id: string) => {
    const category = categories.find((cat) => cat.id === id);
    if (!category || category.menuCount > 0) return;

    setSelectedCategoryIds((current) =>
      current.includes(id) ? current.filter((catId) => catId !== id) : [...current, id]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedCategoryIds.length === 0) return;

    Alert.alert('ลบหมวดหมู่', `ต้องการลบ ${selectedCategoryIds.length} หมวดหมู่ที่เลือกหรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () => {
          selectedCategoryIds.forEach((id) => deleteCategory(id));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          loadCategories();
          setSelectedCategoryIds([]);
          setIsEditing(false);
          onSaved();
        },
      },
    ]);
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
          <Animated.View className="bg-white rounded-t-3xl max-h-[90%]" style={sheetStyle}>
            {/* Header */}
            <View className="px-5 pt-5 pb-3 border-b border-mekha-border flex-row items-center justify-between">
              <Text className="text-xl font-bold text-mekha-text">จัดการหมวดหมู่</Text>
              <View className="flex-row items-center gap-2">
                {categories.length > 0 ? (
                  <Pressable onPress={toggleEditMode} className="px-3 py-2 rounded-lg bg-mekha-surface">
                    <Text className="text-purple-700 font-medium text-sm">{isEditing ? 'เสร็จ' : 'แก้ไข'}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={handleDismiss} className="p-2">
                  <Ionicons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>
            </View>

            <ScrollView
              className="px-5 py-4"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 + (keyboardHeight > 0 ? 120 : 0) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Add new category */}
              <Text className="text-sm text-mekha-muted mb-1.5">เพิ่มหมวดหมู่ใหม่</Text>
              <View className="flex-row gap-2 mb-4">
                <TextInput
                  className="flex-1 bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 text-mekha-text"
                  placeholder="ชื่อหมวดหมู่"
                  value={newCatName}
                  onChangeText={setNewCatName}
                  onSubmitEditing={handleAdd}
                  returnKeyType="done"
                />
                <Pressable
                  className="bg-purple-600 px-5 rounded-xl items-center justify-center"
                  onPress={handleAdd}
                >
                  <Text className="text-white font-semibold">เพิ่ม</Text>
                </Pressable>
              </View>

              {/* Existing categories */}
              {categories.length > 0 ? (
                <View className="bg-mekha-surface border border-mekha-border rounded-xl overflow-hidden">
                  {categories.map((cat, idx) => (
                    <Pressable
                      key={cat.id}
                      className={`flex-row items-center justify-between px-4 py-3.5 ${idx < categories.length - 1 ? 'border-b border-mekha-border' : ''} ${isEditing && cat.menuCount > 0 ? 'opacity-60' : ''}`}
                      onPress={() => {
                        if (isEditing) toggleSelected(cat.id);
                      }}
                      disabled={!isEditing || cat.menuCount > 0}
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        {isEditing ? (
                          <View
                            className={`w-6 h-6 rounded-full border items-center justify-center ${
                              selectedCategoryIds.includes(cat.id) ? 'bg-red-600 border-red-600' : 'border-mekha-border'
                            }`}
                          >
                            {selectedCategoryIds.includes(cat.id) ? (
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            ) : cat.menuCount > 0 ? (
                              <Ionicons name="lock-closed" size={13} color="#9CA3AF" />
                            ) : null}
                          </View>
                        ) : null}
                        <View className="flex-1">
                          <Text className="text-base font-medium text-mekha-text">{cat.name}</Text>
                          {isEditing && cat.menuCount > 0 ? (
                            <Text className="text-xs text-mekha-muted mt-0.5">
                              มีอาหาร {cat.menuCount} รายการ กรุณาลบหรือย้ายอาหารก่อน
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 items-center">
                  <Text className="text-amber-700 text-sm">ยังไม่มีหมวดหมู่</Text>
                </View>
              )}
            </ScrollView>

            {isEditing ? (
              <View className="px-5 pt-3 border-t border-mekha-border bg-white" style={{ paddingBottom: insets.bottom + 12 }}>
                <Pressable
                  className={`rounded-xl py-3.5 items-center ${selectedCategoryIds.length > 0 ? 'bg-red-600' : 'bg-gray-200'}`}
                  onPress={handleDeleteSelected}
                  disabled={selectedCategoryIds.length === 0}
                >
                  <Text className={`font-semibold ${selectedCategoryIds.length > 0 ? 'text-white' : 'text-gray-500'}`}>
                    ลบที่เลือก ({selectedCategoryIds.length})
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
