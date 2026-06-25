import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useCartStore } from '../../../src/features/cart/cartStore';
import { getAllMenus, getMenuCategories, getAllCategories } from '../../../src/db/repositories/menuRepo';
import { getSetting } from '../../../src/db/repositories/transactionRepo';
import { getAllTables } from '../../../src/db/repositories/tableRepo';
import type { TableItem } from '../../../src/db/repositories/tableRepo';
import { isTablet } from '../../../src/constants/layout';
import { DARK_PLACEHOLDER, LIGHT_PLACEHOLDER } from '../../../src/constants/theme';
import AddToCartModal from '../../../src/components/AddToCartModal';
import NumPad from '../../../src/components/NumPad';
import type { Menu, CartItem } from '../../../src/types';

export default function PosScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mutedIconColor = isDark ? '#9CA3AF' : '#6B7280';
  const placeholderColor = isDark ? DARK_PLACEHOLDER : LIGHT_PLACEHOLDER;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [tablesEnabled, setTablesEnabled] = useState(false);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [keypadDigits, setKeypadDigits] = useState('');
  const [keypadNote, setKeypadNote] = useState('');
  const { items, addItem, removeItem, updateQty, getTotal, clear, tableId, tableName, switchTable, getTableItemCount, hasActiveCheckoutSession } = useCartStore();
  const hasActivePaymentSession = hasActiveCheckoutSession();

  // Keypad amount (direct entry: "50" = ฿50, "12.5" = ฿12.50)
  const keypadAmount = parseFloat(keypadDigits || '0') || 0;

  const handleKeypadAdd = useCallback(() => {
    if (keypadAmount > 0) {
      if (hasActivePaymentSession) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addItem({
        menuId: `custom-${Crypto.randomUUID()}`,
        name: keypadNote.trim() || 'รายการกำหนดเอง',
        unitPrice: keypadAmount,
        quantity: 1,
        selectedOptions: [],
        note: '',
        itemTotal: keypadAmount,
      });
      setKeypadDigits('');
      setKeypadNote('');
    }
  }, [keypadDigits, keypadAmount, keypadNote, addItem, hasActivePaymentSession]);

  const handleKeypadCheckout = useCallback(() => {
    // Add current amount if any, then go to checkout
    if (keypadAmount > 0 && !hasActivePaymentSession) {
      addItem({
        menuId: `custom-${Crypto.randomUUID()}`,
        name: keypadNote.trim() || 'รายการกำหนดเอง',
        unitPrice: keypadAmount,
        quantity: 1,
        selectedOptions: [],
        note: '',
        itemTotal: keypadAmount,
      });
      setKeypadDigits('');
      setKeypadNote('');
    }
    // Navigate to checkout (need at least 1 item)
    if (items.length > 0 || keypadAmount > 0) {
      router.push('/(tabs)/pos/checkout');
    }
  }, [keypadAmount, keypadNote, addItem, items.length, hasActivePaymentSession]);

  useFocusEffect(
    useCallback(() => {
      setAllMenus(getAllMenus());
      // Merge user-defined categories with categories found in menus
      const menuCats = getMenuCategories();
      const userCats = getAllCategories().map((c) => c.name);
      const merged = [...new Set([...userCats, ...menuCats])];
      setCategories(merged);
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
      if (hasActivePaymentSession) return;
      setSelectedMenu(menu);
    },
    [hasActivePaymentSession]
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
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top']}>
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
            <Text className="text-2xl font-bold text-mekha-text dark:text-neutral-50">Mekha</Text>
            <View className="flex-row items-center gap-2 ml-auto">
              {tablesEnabled && tableName && (
                <View className="bg-purple-100 dark:bg-purple-950 px-3 py-1 rounded-full">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="grid-outline" size={14} color="#7C3AED" />
                    <Text className="text-purple-700 dark:text-purple-300 text-sm font-medium">
                      {tableName}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Mode tabs: KEYPAD / ITEMS */}
          <View className="flex-row px-4 mb-2">
            <Pressable
              className={`flex-1 py-2 items-center border-b-2 ${
                showCustomAmount ? 'border-purple-600' : 'border-transparent'
              }`}
              onPress={() => setShowCustomAmount(true)}
            >
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="keypad" size={16} color={showCustomAmount ? '#7C3AED' : mutedIconColor} />
                <Text className={`text-sm font-semibold ${showCustomAmount ? 'text-purple-600 dark:text-purple-300' : 'text-mekha-muted dark:text-neutral-400'}`}>
                  KEYPAD
                </Text>
              </View>
            </Pressable>
            <Pressable
              className={`flex-1 py-2 items-center border-b-2 ${
                !showCustomAmount ? 'border-purple-600' : 'border-transparent'
              }`}
              onPress={() => setShowCustomAmount(false)}
            >
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="list" size={16} color={!showCustomAmount ? '#7C3AED' : mutedIconColor} />
                <Text className={`text-sm font-semibold ${!showCustomAmount ? 'text-purple-600 dark:text-purple-300' : 'text-mekha-muted dark:text-neutral-400'}`}>
                  ITEMS
                </Text>
              </View>
            </Pressable>
          </View>

          {showCustomAmount ? (
            /* ===== KEYPAD MODE ===== */
            <View className="flex-1 bg-white dark:bg-neutral-950 px-4 pt-4">
              {/* Amount display */}
              <View className="items-center mb-4">
                <Text className="text-purple-600 text-5xl font-bold">
                  ฿{keypadAmount > 0 ? keypadDigits : '0'}
                </Text>
              </View>

              {/* Note field */}
              <View className="flex-row items-center justify-center mb-4">
                <Ionicons name="pencil" size={14} color="#7C3AED" />
                <TextInput
                  className="text-mekha-muted dark:text-neutral-400 text-sm ml-1.5"
                  placeholder="โน้ต (ไม่บังคับ)"
                  placeholderTextColor={placeholderColor}
                  value={keypadNote}
                  onChangeText={setKeypadNote}
                  style={{ minWidth: 120 }}
                />
              </View>

              {/* Numpad */}
              <View className="flex-1 justify-center pb-3">
                <NumPad value={keypadDigits} onChange={setKeypadDigits} />
              </View>

              {/* Add item button (+ above checkout) */}
              <Pressable
                className={`w-full py-3 rounded-2xl items-center mb-2 ${
                  keypadAmount > 0 && !hasActivePaymentSession ? 'bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900' : 'bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800'
                }`}
                onPress={handleKeypadAdd}
                disabled={keypadAmount <= 0 || hasActivePaymentSession}
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="add-circle" size={18} color={keypadAmount > 0 && !hasActivePaymentSession ? '#7C3AED' : '#9CA3AF'} />
                  <Text className={`font-semibold text-sm ${keypadAmount > 0 && !hasActivePaymentSession ? 'text-purple-700 dark:text-purple-300' : 'text-gray-400 dark:text-neutral-500'}`}>
                    {hasActivePaymentSession ? 'ล็อกระหว่างรับชำระ' : 'เพิ่มรายการ'}
                  </Text>
                </View>
              </Pressable>

              {/* Checkout button */}
              <Pressable
                className={`w-full py-4 rounded-2xl items-center mb-3 ${
                  keypadAmount > 0 || items.length > 0 ? 'bg-purple-600 active:bg-purple-700' : 'bg-purple-200'
                }`}
                onPress={handleKeypadCheckout}
                disabled={keypadAmount <= 0 && items.length === 0}
              >
                <Text className="text-white font-semibold text-base">
                  ชำระเงิน · ฿{(getTotal() + keypadAmount).toFixed(0)}
                </Text>
              </Pressable>
            </View>
          ) : (
            /* ===== ITEMS MODE ===== */
            <View className="flex-1">

          {tablesEnabled && tables.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="px-4 pb-2 max-h-11"
              contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 16 }}
            >
              <Pressable
                className={`px-3 py-1.5 rounded-full ${
                  tableId === null ? 'bg-gray-600' : 'bg-gray-100 dark:bg-neutral-900'
                }`}
                onPress={() => handleSwitchTable(null)}
              >
                <Text
                  className={`text-xs font-medium ${
                    tableId === null ? 'text-white' : 'text-gray-700 dark:text-neutral-200'
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
                          ? 'bg-orange-50 dark:bg-orange-950'
                          : isOccupied
                            ? 'bg-orange-50 dark:bg-orange-950'
                            : 'bg-green-50 dark:bg-green-950'
                    }`}
                    onPress={() => handleSwitchTable(table)}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isSelected
                          ? 'text-white'
                          : count > 0
                            ? 'text-orange-700 dark:text-orange-300'
                            : isOccupied
                              ? 'text-orange-700 dark:text-orange-300'
                              : 'text-green-700 dark:text-green-300'
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
            contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 16 }}
          >
            <Pressable
              className={`px-4 py-2 rounded-full ${
                selectedCategory === null ? 'bg-purple-600' : 'bg-purple-50 dark:bg-purple-950'
              }`}
              onPress={() => setSelectedCategory(null)}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedCategory === null ? 'text-white' : 'text-purple-700 dark:text-purple-300'
                }`}
              >
                ทั้งหมด
              </Text>
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === cat ? 'bg-purple-600' : 'bg-purple-50 dark:bg-purple-950'
                }`}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedCategory === cat ? 'text-white' : 'text-purple-700 dark:text-purple-300'
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
              <Text className="text-mekha-muted dark:text-neutral-400 text-center">
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
                  className={`flex-1 m-1 border border-mekha-border dark:border-neutral-800 rounded-2xl p-3 items-center ${hasActivePaymentSession ? 'bg-gray-50 dark:bg-neutral-900 opacity-60' : 'bg-mekha-surface dark:bg-neutral-900 active:bg-purple-50 dark:active:bg-purple-950'}`}
                  onPress={() => handleAddToCart(item)}
                  disabled={hasActivePaymentSession}
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
                  <Text className="text-sm font-medium text-mekha-text dark:text-neutral-50 text-center" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="text-xs text-purple-600 dark:text-purple-300 font-semibold mt-1">
                    ฿{item.price.toFixed(0)}
                  </Text>
                </Pressable>
              )}
            />
          )}
            </View>
          )}
        </View>

        {/* Cart Panel (always visible on tablet, bottom sheet on phone) */}
        {(isTablet || !showCustomAmount) && (
        <View
          className={`${
            isTablet
              ? 'w-80 border-l border-mekha-border dark:border-neutral-800'
              : 'border-t border-mekha-border dark:border-neutral-800'
          } bg-white dark:bg-neutral-950`}
        >
          {isTablet ? (
            <CartPanel
              items={items}
              total={getTotal()}
              onUpdateQty={updateQty}
              onRemove={removeItem}
              onCheckout={handleCheckout}
              onClear={clear}
              locked={hasActivePaymentSession}
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
        )}
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
  locked,
}: {
  items: CartItem[];
  total: number;
  onUpdateQty: (menuId: string, qty: number) => void;
  onRemove: (menuId: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  locked: boolean;
}) {
  return (
    <View className="flex-1 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-bold text-mekha-text dark:text-neutral-50">ตะกร้า</Text>
        {items.length > 0 && (
          <Pressable onPress={onClear} disabled={locked}>
            <Text className={`text-sm ${locked ? 'text-gray-400 dark:text-neutral-500' : 'text-red-700 dark:text-red-400'}`}>ล้าง</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-mekha-muted dark:text-neutral-400">ยังไม่มีรายการ</Text>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1">
            {items.map((item) => (
              <View
                key={item.menuId}
                className="flex-row items-center justify-between py-3 border-b border-mekha-border dark:border-neutral-800"
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-mekha-text dark:text-neutral-50">{item.name}</Text>
                  {item.selectedOptions.length > 0 && (
                    <Text className="text-xs text-purple-600 dark:text-purple-300">
                      {item.selectedOptions.map((o) => o.itemName).join(', ')}
                    </Text>
                  )}
                  {item.note ? (
                    <Text className="text-xs text-mekha-muted dark:text-neutral-400 italic">"{item.note}"</Text>
                  ) : null}
                  <Text className="text-xs text-mekha-muted dark:text-neutral-400">฿{item.unitPrice}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    className={`w-7 h-7 rounded-full items-center justify-center ${locked ? 'bg-gray-100 dark:bg-neutral-900' : 'bg-purple-50 dark:bg-purple-950'}`}
                    onPress={() => onUpdateQty(item.menuId, item.quantity - 1)}
                    disabled={locked}
                  >
                    <Text className={`${locked ? 'text-gray-400 dark:text-neutral-500' : 'text-purple-700 dark:text-purple-300'} font-bold`}>-</Text>
                  </Pressable>
                  <Text className="text-sm font-medium w-6 text-center text-mekha-text dark:text-neutral-50">{item.quantity}</Text>
                  <Pressable
                    className={`w-7 h-7 rounded-full items-center justify-center ${locked ? 'bg-gray-100 dark:bg-neutral-900' : 'bg-purple-50 dark:bg-purple-950'}`}
                    onPress={() => onUpdateQty(item.menuId, item.quantity + 1)}
                    disabled={locked}
                  >
                    <Text className={`${locked ? 'text-gray-400 dark:text-neutral-500' : 'text-purple-700 dark:text-purple-300'} font-bold`}>+</Text>
                  </Pressable>
                </View>
                <Text className="text-sm font-semibold text-mekha-text dark:text-neutral-50 ml-3 w-16 text-right">
                  ฿{item.itemTotal.toFixed(0)}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View className="pt-4 border-t border-mekha-border dark:border-neutral-800 mt-2">
            {locked && (
              <View className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2 mb-3">
                <Text className="text-xs text-amber-700 dark:text-amber-200 text-center">
                  เริ่มรับชำระเงินแล้ว แก้ไขรายการอาหารไม่ได้
                </Text>
              </View>
            )}
            <View className="flex-row justify-between mb-3">
              <Text className="text-base font-bold text-mekha-text dark:text-neutral-50">รวม</Text>
              <Text className="text-base font-bold text-purple-600 dark:text-purple-300">฿{total.toFixed(0)}</Text>
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
