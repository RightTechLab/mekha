import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import {
  getAllCategories,
  createCategory,
  deleteCategory,
} from '../db/repositories/menuRepo';
import type { CategoryItem } from '../db/repositories/menuRepo';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function CategoryFormModal({ visible, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setCategories(getAllCategories());
      setNewCatName('');
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
    setCategories(getAllCategories());
    onSaved();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('ลบหมวดหมู่', `ต้องการลบ "${name}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () => {
          deleteCategory(id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setCategories(getAllCategories());
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
    transform: [{ translateY: translateY.value - (Platform.OS === 'android' ? keyboardHeight : 0) }],
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
              <Pressable onPress={handleDismiss} className="p-2">
                <Text className="text-mekha-muted text-lg">✕</Text>
              </Pressable>
            </View>

            <ScrollView
              className="px-5 py-4"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 + (Platform.OS === 'android' ? keyboardHeight : 0) }}
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
                    <View
                      key={cat.id}
                      className={`flex-row items-center justify-between px-4 py-3.5 ${idx < categories.length - 1 ? 'border-b border-mekha-border' : ''}`}
                    >
                      <Text className="text-base font-medium text-mekha-text">{cat.name}</Text>
                      <Pressable
                        className="bg-red-50 px-3 py-1.5 rounded-lg"
                        onPress={() => handleDelete(cat.id, cat.name)}
                      >
                        <Text className="text-red-700 text-xs font-medium">ลบ</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 items-center">
                  <Text className="text-amber-700 text-sm">ยังไม่มีหมวดหมู่</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
