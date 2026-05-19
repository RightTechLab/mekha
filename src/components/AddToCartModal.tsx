import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { getOptionGroups, getOptionItems } from '../db/repositories/menuRepo';
import type { Menu, OptionGroup, OptionItem, SelectedOption, CartItem } from '../types';

interface Props {
  visible: boolean;
  menu: Menu | null;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}

export default function AddToCartModal({ visible, menu, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [groups, setGroups] = useState<(OptionGroup & { items: OptionItem[] })[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({}); // groupId -> itemId[]

  useEffect(() => {
    if (menu) {
      setQuantity(1);
      setNote('');
      setSelected({});
      const optGroups = getOptionGroups(menu.id);
      const withItems = optGroups.map((g) => ({
        ...g,
        items: getOptionItems(g.id),
      }));
      setGroups(withItems);
    }
  }, [menu]);

  const toggleOption = (groupId: string, itemId: string, multiple: boolean) => {
    setSelected((prev) => {
      const current = prev[groupId] || [];
      if (multiple) {
        return {
          ...prev,
          [groupId]: current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId],
        };
      }
      // single select — toggle off or set
      return {
        ...prev,
        [groupId]: current.includes(itemId) ? [] : [itemId],
      };
    });
  };

  const getSelectedOptions = (): SelectedOption[] => {
    const result: SelectedOption[] = [];
    for (const group of groups) {
      const ids = selected[group.id] || [];
      const items = group.items ?? [];
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (item) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            itemId: item.id,
            itemName: item.name,
            priceDelta: item.price_delta,
          });
        }
      }
    }
    return result;
  };

  const optionsDelta = getSelectedOptions().reduce((sum, o) => sum + o.priceDelta, 0);
  const itemTotal = quantity * ((menu?.price ?? 0) + optionsDelta);

  const handleConfirm = () => {
    if (!menu) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd({
      menuId: menu.id,
      name: menu.name,
      unitPrice: menu.price,
      quantity,
      selectedOptions: getSelectedOptions(),
      note: note.trim(),
      itemTotal,
    });
    onClose();
  };

  const translateY = useSharedValue(300);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      overlayOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(300, { duration: 250 });
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
    translateY.value = withTiming(300, { duration: 250 });
    overlayOpacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  if (!menu) return null;

  return (
    <Modal visible={visible} animationType="none" transparent>
      <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 justify-end">
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View className="absolute inset-0 bg-black/40" style={overlayStyle} />
        </TouchableWithoutFeedback>
        <Animated.View className="bg-white rounded-t-3xl max-h-[80%]" style={sheetStyle}>
          {/* Header */}
          <View className="px-5 pt-5 pb-3 border-b border-mekha-border">
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-mekha-text">{menu.name}</Text>
              <Pressable onPress={onClose} className="p-2">
                <Text className="text-mekha-muted text-lg">✕</Text>
              </Pressable>
            </View>
            <Text className="text-purple-600 font-semibold mt-1">฿{menu.price.toFixed(0)}</Text>
          </View>

          <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Option Groups */}
            {groups.map((group) => (
              <View key={group.id} className="mb-5">
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-base font-semibold text-mekha-text">{group.name}</Text>
                  {group.required ? (
                    <View className="bg-red-50 px-2 py-0.5 rounded">
                      <Text className="text-xs text-red-700">จำเป็น</Text>
                    </View>
                  ) : null}
                  {group.multiple ? (
                    <View className="bg-purple-50 px-2 py-0.5 rounded">
                      <Text className="text-xs text-purple-700">เลือกหลายได้</Text>
                    </View>
                  ) : null}
                </View>
                {group.items.map((item) => {
                  const isSelected = (selected[group.id] || []).includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      className={`flex-row items-center justify-between py-3 px-4 mb-1 rounded-xl border ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-mekha-border bg-white'
                      }`}
                      onPress={() => toggleOption(group.id, item.id, !!group.multiple)}
                    >
                      <Text
                        className={`text-sm ${
                          isSelected ? 'text-purple-700 font-medium' : 'text-mekha-text'
                        }`}
                      >
                        {item.name}
                      </Text>
                      {item.price_delta !== 0 && (
                        <Text className="text-xs text-mekha-muted">
                          +฿{item.price_delta.toFixed(0)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {/* Note */}
            <View className="mb-5">
              <Text className="text-base font-semibold text-mekha-text mb-2">หมายเหตุ</Text>
              <TextInput
                className="border border-mekha-border rounded-xl px-4 py-3 text-sm text-mekha-text"
                placeholder="เช่น ไม่ใส่ผัก, เพิ่มข้าว..."
                placeholderTextColor="#9CA3AF"
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>
          </ScrollView>

          {/* Quantity + Add button */}
          <View className="px-5 pt-3 border-t border-mekha-border" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            {/* Qty control */}
            <View className="flex-row items-center justify-center gap-6 mb-4">
              <Pressable
                className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center"
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Text className="text-purple-700 text-xl font-bold">−</Text>
              </Pressable>
              <Text className="text-2xl font-bold text-mekha-text w-10 text-center">
                {quantity}
              </Text>
              <Pressable
                className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center"
                onPress={() => setQuantity((q) => q + 1)}
              >
                <Text className="text-purple-700 text-xl font-bold">+</Text>
              </Pressable>
            </View>

            <Pressable
              className="w-full py-4 rounded-2xl items-center bg-purple-600 active:bg-purple-700"
              onPress={handleConfirm}
            >
              <Text className="text-white font-semibold text-base">
                เพิ่ม · ฿{itemTotal.toFixed(0)}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
