import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCartStore } from '../../../src/features/cart/cartStore';
import { getAllMenus, getMenuCategories } from '../../../src/db/repositories/menuRepo';
import { getSetting } from '../../../src/db/repositories/transactionRepo';
import { getAllTables } from '../../../src/db/repositories/tableRepo';
import type { TableItem } from '../../../src/db/repositories/tableRepo';
import { isTablet } from '../../../src/constants/layout';
import AddToCartModal from '../../../src/components/AddToCartModal';
import type { Menu, CartItem } from '../../../src/types';

export default function PosScreen() {
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [tablesEnabled, setTablesEnabled] = useState(false);
  const [tables, setTables] = useState<TableItem[]>([]);
  const { items, addItem, removeItem, updateQty, getTotal, clear, tableId, tableName, switchTable, getTableItemCount } = useCartStore();

  useFocusEffect(
    useCallback(() => {
      setAllMenus(getAllMenus());
      setCategories(getMenuCategories());
      const enabled = getSetting('tables_enabled') === '1';
      setTablesEnabled(enabled);
      if (enabled) {
        setTables(getAllTables());
      }
    }, [])
  );

  const menus = selectedCategory
    ? allMenus.filter((m) => m.category === selectedCategory)
    : allMenus;

  const handleAddToCart = useCallback(
    (menu: Menu) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedMenu(menu);
    },
    []
  );

  const handleSwitchTable = useCallback(
    (table: TableItem | null) => {
      const newId = table?.id ?? null;
      const newName = table?.name ?? null;
      if (newId === tableId) {
        // Deselect → go to "no table"
        switchTable(null, null);
      } else {
        switchTable(newId, newName);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [tableId, switchTable]
  );

  const handleCheckout = useCallback(() => {
    if (items.length === 0) return;
    router.push('/(tabs)/pos/checkout');
  }, [items]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className={`flex-1 ${isTablet ? 'flex-row' : ''}`}>
        {/* Menu Grid */}
        <View className={`${isTablet ? 'flex-1' : 'flex-1'}`}>
          {/* Header */}
          <View className="px-4 pt-4 pb-2 flex-row items-center gap-3">
            <Image
              source={require('../../../assets/logo.jpg')}
              className="w-10 h-10 rounded-xl"
              resizeMode="contain"
            />
            <Text className="text-2xl font-bold text-mekha-text">Mekha</Text>
            {tablesEnabled && tableName && (
              <View className="bg-purple-100 px-3 py-1 rounded-full ml-auto">
                <View className="flex-row items-center gap-1">
                <Ionicons name="grid-outline" size={14} color="#7C3AED" />
                <Text className="text-purple-700 text-sm font-medium">
                  {tableName}
                </Text>
              </View>
              </View>
            )}
          </View>

          {/* Table selector */}
          {tablesEnabled && tables.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="px-4 pb-2 max-h-11"
              contentContainerStyle={{ gap: 8, alignItems: 'center' }}
            >
              <Pressable
                className={`px-3 py-1.5 rounded-full ${
                  tableId === null ? 'bg-gray-600' : 'bg-gray-100'
                }`}
                onPress={() => handleSwitchTable(null)}
              >
                <Text
                  className={`text-xs font-medium ${
                    tableId === null ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  ไม่ระบุโต๊ะ{getTableItemCount(null) > 0 ? ` (${getTableItemCount(null)})` : ''}
                </Text>
              </Pressable>
              {tables.map((table) => {
                const isSelected = tableId === table.id;
                const count = getTableItemCount(table.id);
                const isOccupied = table.status === 'occupied';
                return (
                  <Pressable
                    key={table.id}
                    className={`px-3 py-1.5 rounded-full ${
                      isSelected
                        ? 'bg-purple-600'
                        : count > 0
                          ? 'bg-orange-50'
                          : isOccupied
                            ? 'bg-orange-50'
                            : 'bg-green-50'
                    }`}
                    onPress={() => handleSwitchTable(table)}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isSelected
                          ? 'text-white'
                          : count > 0
                            ? 'text-orange-700'
                            : isOccupied
                              ? 'text-orange-700'
                              : 'text-green-700'
                      }`}
                    >
                      {table.name}{count > 0 ? ` (${count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Category filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 pb-3 max-h-12"
            contentContainerStyle={{ gap: 8, alignItems: 'center' }}
          >
            <Pressable
              className={`px-4 py-2 rounded-full ${
                selectedCategory === null ? 'bg-purple-600' : 'bg-purple-50'
              }`}
              onPress={() => setSelectedCategory(null)}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedCategory === null ? 'text-white' : 'text-purple-700'
                }`}
              >
                ทั้งหมด
              </Text>
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === cat ? 'bg-purple-600' : 'bg-purple-50'
                }`}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedCategory === cat ? 'text-white' : 'text-purple-700'
                  }`}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Menu items grid */}
          {menus.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-mekha-muted text-center">
                ยังไม่มีเมนู{'\n'}เพิ่มเมนูที่แท็บ "เมนู"
              </Text>
            </View>
          ) : (
            <FlashList
              data={menus}
              numColumns={isTablet ? 4 : 3}
              contentContainerStyle={{ padding: 8, paddingBottom: insets.bottom + 80 }}
              renderItem={({ item }) => (
                <Pressable
                  className="flex-1 m-1 bg-mekha-surface border border-mekha-border rounded-2xl p-3 items-center active:bg-purple-50"
                  onPress={() => handleAddToCart(item)}
                >
                  {item.image_path ? (
                    <Image
                      source={{ uri: item.image_path }}
                      className="w-full h-24 rounded-xl mb-2"
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={require('../../../assets/no_img.png')}
                      className="w-full h-24 rounded-xl mb-2"
                      resizeMode="cover"
                    />
                  )}
                  <Text className="text-sm font-medium text-mekha-text text-center" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="text-xs text-purple-600 font-semibold mt-1">
                    ฿{item.price.toFixed(0)}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>

        {/* Cart Panel (always visible on tablet, bottom sheet on phone) */}
        <View
          className={`${
            isTablet
              ? 'w-80 border-l border-mekha-border'
              : 'border-t border-mekha-border'
          } bg-white`}
        >
          {isTablet ? (
            <CartPanel
              items={items}
              total={getTotal()}
              onUpdateQty={updateQty}
              onRemove={removeItem}
              onCheckout={handleCheckout}
              onClear={clear}
            />
          ) : (
            <View className="px-4 py-3">
              <Pressable
                className={`w-full py-4 rounded-2xl items-center ${
                  items.length > 0 ? 'bg-purple-600' : 'bg-purple-200'
                }`}
                onPress={handleCheckout}
                disabled={items.length === 0}
              >
                <Text className="text-white font-semibold text-base">
                  ชำระเงิน · ฿{getTotal().toFixed(0)} ({items.length} รายการ)
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <AddToCartModal
        visible={!!selectedMenu}
        menu={selectedMenu}
        onClose={() => setSelectedMenu(null)}
        onAdd={addItem}
      />
    </SafeAreaView>
  );
}

function CartPanel({
  items,
  total,
  onUpdateQty,
  onRemove,
  onCheckout,
  onClear,
}: {
  items: CartItem[];
  total: number;
  onUpdateQty: (menuId: string, qty: number) => void;
  onRemove: (menuId: string) => void;
  onCheckout: () => void;
  onClear: () => void;
}) {
  return (
    <View className="flex-1 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-bold text-mekha-text">ตะกร้า</Text>
        {items.length > 0 && (
          <Pressable onPress={onClear}>
            <Text className="text-sm text-red-700">ล้าง</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-mekha-muted">ยังไม่มีรายการ</Text>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1">
            {items.map((item) => (
              <View
                key={item.menuId}
                className="flex-row items-center justify-between py-3 border-b border-mekha-border"
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-mekha-text">{item.name}</Text>
                  {item.selectedOptions.length > 0 && (
                    <Text className="text-xs text-purple-600">
                      {item.selectedOptions.map((o) => o.itemName).join(', ')}
                    </Text>
                  )}
                  {item.note ? (
                    <Text className="text-xs text-mekha-muted italic">"{item.note}"</Text>
                  ) : null}
                  <Text className="text-xs text-mekha-muted">฿{item.unitPrice}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    className="w-7 h-7 rounded-full bg-purple-50 items-center justify-center"
                    onPress={() => onUpdateQty(item.menuId, item.quantity - 1)}
                  >
                    <Text className="text-purple-700 font-bold">-</Text>
                  </Pressable>
                  <Text className="text-sm font-medium w-6 text-center">{item.quantity}</Text>
                  <Pressable
                    className="w-7 h-7 rounded-full bg-purple-50 items-center justify-center"
                    onPress={() => onUpdateQty(item.menuId, item.quantity + 1)}
                  >
                    <Text className="text-purple-700 font-bold">+</Text>
                  </Pressable>
                </View>
                <Text className="text-sm font-semibold text-mekha-text ml-3 w-16 text-right">
                  ฿{item.itemTotal.toFixed(0)}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View className="pt-4 border-t border-mekha-border mt-2">
            <View className="flex-row justify-between mb-3">
              <Text className="text-base font-bold text-mekha-text">รวม</Text>
              <Text className="text-base font-bold text-purple-600">฿{total.toFixed(0)}</Text>
            </View>
            <Pressable
              className="w-full py-4 rounded-2xl items-center bg-purple-600 active:bg-purple-700"
              onPress={onCheckout}
            >
              <Text className="text-white font-semibold text-base">ชำระเงิน</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
