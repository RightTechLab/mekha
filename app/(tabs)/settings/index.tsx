import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system/next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { format, subDays } from 'date-fns';
import { router } from 'expo-router';
import { useSessionStore } from '../../../src/features/auth/sessionStore';
import { getSetting, setSetting, getTransactions } from '../../../src/db/repositories/transactionRepo';
import { getAllMenus, createMenu, getMenuById } from '../../../src/db/repositories/menuRepo';
import { getAllTables, createTable, deleteTable } from '../../../src/db/repositories/tableRepo';
import { generateLightningReport } from '../../../src/lib/exportPdf';
import type { TableItem } from '../../../src/db/repositories/tableRepo';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useSessionStore();

  const [shopName, setShopName] = useState(getSetting('shop_name') ?? 'Mekha');
  const [vatRate, setVatRate] = useState(getSetting('vat_rate') ?? '7');
  const [promptpayId, setPromptpayId] = useState('');
  const [lnAddress, setLnAddress] = useState('');
  const [cashierPin, setCashierPin] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [pinEnabled, setPinEnabled] = useState(getSetting('pin_enabled') === '1');

  // Table management
  const [tablesEnabled, setTablesEnabled] = useState(getSetting('tables_enabled') === '1');
  const [tables, setTables] = useState<TableItem[]>(getAllTables());
  const [newTableName, setNewTableName] = useState('');

  // Load secure values
  useState(() => {
    SecureStore.getItemAsync('mekha.promptpay_id').then((v) => {
      if (v) setPromptpayId(v);
    });
    SecureStore.getItemAsync('mekha.ln_address').then((v) => {
      if (v) setLnAddress(v);
    });
  });

  const handleSaveGeneral = () => {
    setSetting('shop_name', shopName.trim());
    setSetting('vat_rate', vatRate);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggleTables = (value: boolean) => {
    setTablesEnabled(value);
    setSetting('tables_enabled', value ? '1' : '0');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddTable = () => {
    if (!newTableName.trim()) return;
    createTable({
      id: Crypto.randomUUID(),
      name: newTableName.trim(),
      sort_order: tables.length,
    });
    setTables(getAllTables());
    setNewTableName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteTable = (id: string, name: string) => {
    Alert.alert('ลบโต๊ะ', `ต้องการลบ "${name}" ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () => {
          deleteTable(id);
          setTables(getAllTables());
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
    ]);
  };

  const handleSavePayment = async () => {
    if (promptpayId.trim()) {
      await SecureStore.setItemAsync('mekha.promptpay_id', promptpayId.trim());
    }
    if (lnAddress.trim()) {
      await SecureStore.setItemAsync('mekha.ln_address', lnAddress.trim());
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSetCashierPin = async () => {
    if (cashierPin.length !== 6) {
      Alert.alert('Error', 'PIN ต้อง 6 หลัก');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const hash = await hashPin(cashierPin);
    await SecureStore.setItemAsync('mekha.cashier_pin_hash', hash);
    setCashierPin('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('สำเร็จ', 'ตั้ง PIN แคชเชียร์แล้ว');
  };

  const handleTogglePin = async (value: boolean) => {
    if (value) {
      // Enabling PIN — require setting owner PIN first
      if (ownerPin.length !== 6) {
        Alert.alert('ตั้ง PIN ก่อน', 'กรุณาใส่ PIN เจ้าของร้าน 6 หลักก่อนเปิดใช้งาน');
        return;
      }
      const hash = await hashPin(ownerPin);
      await SecureStore.setItemAsync('mekha.owner_pin_hash', hash);
      setOwnerPin('');
      setSetting('pin_enabled', '1');
      setPinEnabled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('สำเร็จ', 'เปิดระบบ PIN แล้ว');
    } else {
      Alert.alert('ปิดระบบ PIN', 'ปิดระบบ PIN จะทำให้ทุกคนเข้าใช้แอปได้โดยไม่ต้องใส่ PIN', [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ปิด',
          style: 'destructive',
          onPress: async () => {
            setSetting('pin_enabled', '0');
            setPinEnabled(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ]);
    }
  };

  const handleExportMenu = async () => {
    const menus = getAllMenus();
    const data = JSON.stringify({ menus, exported_at: new Date().toISOString() }, null, 2);
    const file = new File(Paths.document, 'mekha-menu-export.json');
    if (!file.exists) file.create();
    file.write(data);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  };

  const handleBackup = async () => {
    const dbPath = `${FileSystem.documentDirectory}SQLite/mekha.db`;
    const backupPath = `${FileSystem.documentDirectory}mekha-backup-${Date.now()}.db`;
    await FileSystem.copyAsync({ from: dbPath, to: backupPath });
    await Sharing.shareAsync(backupPath);
    setSetting('last_backup_at', new Date().toISOString());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleImportMenu = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const picked = result.assets[0];
      const response = await fetch(picked.uri);
      const content = await response.text();
      const data = JSON.parse(content);
      if (!data.menus || !Array.isArray(data.menus)) {
        Alert.alert('ผิดพลาด', 'ไฟล์ไม่ถูกต้อง ต้องเป็น JSON ที่ส่งออกจาก Mekha');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      let imported = 0;
      let skipped = 0;
      for (const menu of data.menus) {
        if (getMenuById(menu.id)) {
          skipped++;
          continue;
        }
        createMenu({
          id: menu.id,
          name: menu.name,
          price: menu.price,
          category: menu.category ?? null,
          image_path: menu.image_path ?? null,
          is_active: menu.is_active ?? 1,
          sort_order: menu.sort_order ?? 0,
        });
        imported++;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('สำเร็จ', `นำเข้า ${imported} เมนู (ข้าม ${skipped} รายการที่มีอยู่แล้ว)`);
    } catch (e: any) {
      Alert.alert('ผิดพลาด', e?.message ?? 'ไม่สามารถนำเข้าไฟล์ได้');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/pin');
  };

  const handleLightningReport = async (days: number) => {
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    const shopName = getSetting('shop_name') ?? 'Mekha';

    const txns = getTransactions({ method: 'lightning', limit: 10000 }).filter((t) => {
      const d = t.created_at.substring(0, 10);
      return d >= startDate && d <= endDate && t.status === 'completed';
    });

    if (txns.length === 0) {
      Alert.alert('ไม่มีข้อมูล', `ไม่พบรายการ Lightning ในช่วง ${days} วันที่ผ่านมา`);
      return;
    }

    await generateLightningReport(txns, startDate, endDate, shopName);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <Text className="text-2xl font-bold text-mekha-text mb-6">ตั้งค่า</Text>

        {/* General */}
        <SectionHeader title="ทั่วไป" />
        <Text className="text-sm text-mekha-muted mb-1">ชื่อร้าน</Text>
        <TextInput
          className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
          placeholder="ชื่อร้าน"
          value={shopName}
          onChangeText={setShopName}
        />
        <Text className="text-sm text-mekha-muted mb-1">VAT (%)</Text>
        <TextInput
          className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
          placeholder="อัตรา VAT (%)"
          value={vatRate}
          onChangeText={setVatRate}
          keyboardType="decimal-pad"
        />
        <Pressable
          className="bg-purple-600 py-3 rounded-xl items-center mb-6"
          onPress={handleSaveGeneral}
        >
          <Text className="text-white font-semibold">บันทึก</Text>
        </Pressable>

        {/* Payment */}
        <SectionHeader title="การชำระเงิน" />
        <Text className="text-sm text-mekha-muted mb-1">PromptPay ID</Text>
        <TextInput
          className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
          placeholder="เบอร์โทร หรือ เลขบัตรประชาชน"
          value={promptpayId}
          onChangeText={setPromptpayId}
          keyboardType="phone-pad"
        />
        <Text className="text-sm text-mekha-muted mb-1">Lightning Address</Text>
        <TextInput
          className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
          placeholder="user@domain.com"
          value={lnAddress}
          onChangeText={setLnAddress}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Pressable
          className="bg-purple-600 py-3 rounded-xl items-center mb-6"
          onPress={handleSavePayment}
        >
          <Text className="text-white font-semibold">บันทึกการชำระเงิน</Text>
        </Pressable>

        {/* Roles & PIN */}
        <SectionHeader title="ระบบ PIN" />
        <View className="flex-row items-center justify-between bg-mekha-surface border border-mekha-border rounded-xl px-4 py-2.5 mb-3">
          <Text className="text-mekha-text font-medium">เปิดใช้ระบบ PIN</Text>
          <Switch
            value={pinEnabled}
            onValueChange={handleTogglePin}
            trackColor={{ false: '#D1D5DB', true: '#A78BFA' }}
            thumbColor={pinEnabled ? '#7C3AED' : '#F3F4F6'}
          />
        </View>

        {!pinEnabled && (
          <View className="mb-3">
            <Text className="text-sm text-mekha-muted mb-1">PIN เจ้าของร้าน</Text>
            <TextInput
              className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-2 text-mekha-text"
              placeholder="6 หลัก"
              value={ownerPin}
              onChangeText={setOwnerPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
            />
            <Text className="text-xs text-mekha-muted mb-3">ใส่ PIN แล้วเปิด Switch ด้านบนเพื่อเปิดใช้ระบบ PIN</Text>
          </View>
        )}

        {pinEnabled && (
          <>
            <Text className="text-sm text-mekha-muted mb-1">PIN แคชเชียร์</Text>
            <TextInput
              className="bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 mb-3 text-mekha-text"
              placeholder="6 หลัก"
              value={cashierPin}
              onChangeText={setCashierPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
            />
            <Pressable
              className="bg-purple-50 border border-purple-200 py-3 rounded-xl items-center mb-6"
              onPress={handleSetCashierPin}
            >
              <Text className="text-purple-700 font-semibold">ตั้ง PIN แคชเชียร์</Text>
            </Pressable>
          </>
        )}

        {!pinEnabled && <View className="mb-6" />}

        {/* Table Management */}
        <SectionHeader title="ระบบโต๊ะ" />
        <View className="flex-row items-center justify-between bg-mekha-surface border border-mekha-border rounded-xl px-4 py-2.5 mb-3">
          <Text className="text-mekha-text font-medium">เปิดใช้ระบบโต๊ะ</Text>
          <Switch
            value={tablesEnabled}
            onValueChange={handleToggleTables}
            trackColor={{ false: '#D1D5DB', true: '#A78BFA' }}
            thumbColor={tablesEnabled ? '#7C3AED' : '#F3F4F6'}
          />
        </View>

        {tablesEnabled && (
          <>
            <View className="flex-row gap-2 mb-3">
              <TextInput
                className="flex-1 bg-mekha-surface border border-mekha-border rounded-xl px-4 py-3 text-mekha-text"
                placeholder="ชื่อโต๊ะ เช่น โต๊ะ 1, A1, VIP"
                value={newTableName}
                onChangeText={setNewTableName}
              />
              <Pressable
                className="bg-purple-600 px-4 rounded-xl items-center justify-center"
                onPress={handleAddTable}
              >
                <Text className="text-white font-semibold">เพิ่ม</Text>
              </Pressable>
            </View>

            {tables.length > 0 && (
              <View className="bg-mekha-surface border border-mekha-border rounded-xl p-3 mb-6">
                {tables.map((table) => (
                  <View
                    key={table.id}
                    className="flex-row items-center justify-between py-2 border-b border-mekha-border"
                  >
                    <View className="flex-row items-center gap-2">
                      <View className={`w-3 h-3 rounded-full ${
                        table.status === 'occupied' ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                      <Text className="font-medium text-mekha-text">{table.name}</Text>
                    </View>
                    <Pressable
                      className="bg-red-50 px-3 py-1 rounded-lg"
                      onPress={() => handleDeleteTable(table.id, table.name)}
                    >
                      <Text className="text-red-700 text-sm font-medium">ลบ</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {tables.length === 0 && (
              <Text className="text-mekha-muted text-sm mb-6">ยังไม่มีโต๊ะ เพิ่มโต๊ะด้านบน</Text>
            )}
          </>
        )}

        {/* Lightning Report */}
        <SectionHeader title="รายงาน Lightning" />
        <Text className="text-sm text-mekha-muted mb-3">สร้างรายงานสรุปยอดจ่าย Lightning เพื่อเป็นหลักฐานเรียกเก็บเงิน</Text>
        <View className="flex-row gap-2 mb-6">
          <Pressable
            className="flex-1 bg-amber-50 border border-amber-200 py-3 rounded-xl items-center"
            onPress={() => handleLightningReport(7)}
          >
            <Text className="text-amber-700 font-semibold">7 วัน</Text>
          </Pressable>
          <Pressable
            className="flex-1 bg-amber-50 border border-amber-200 py-3 rounded-xl items-center"
            onPress={() => handleLightningReport(30)}
          >
            <Text className="text-amber-700 font-semibold">30 วัน</Text>
          </Pressable>
          <Pressable
            className="flex-1 bg-amber-50 border border-amber-200 py-3 rounded-xl items-center"
            onPress={() => handleLightningReport(90)}
          >
            <Text className="text-amber-700 font-semibold">90 วัน</Text>
          </Pressable>
        </View>

        {/* Data */}
        <SectionHeader title="ข้อมูล" />
        <Pressable
          className="bg-mekha-surface border border-mekha-border py-3 rounded-xl items-center mb-3"
          onPress={handleExportMenu}
        >
          <Text className="text-mekha-text font-medium">ส่งออกเมนู (JSON)</Text>
        </Pressable>
        <Pressable
          className="bg-mekha-surface border border-mekha-border py-3 rounded-xl items-center mb-3"
          onPress={handleImportMenu}
        >
          <Text className="text-mekha-text font-medium">นำเข้าเมนู (JSON)</Text>
        </Pressable>
        <Pressable
          className="bg-mekha-surface border border-mekha-border py-3 rounded-xl items-center mb-6"
          onPress={handleBackup}
        >
          <Text className="text-mekha-text font-medium">สำรองข้อมูล</Text>
        </Pressable>

        {/* Logout */}
        {pinEnabled && (
          <Pressable
            className="bg-red-50 border border-red-700 py-3 rounded-xl items-center mb-12"
            onPress={handleLogout}
          >
            <Text className="text-red-700 font-semibold">ออกจากระบบ</Text>
          </Pressable>
        )}
        {!pinEnabled && <View className="mb-12" />}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-base font-semibold text-mekha-text mb-3">{title}</Text>
  );
}

async function hashPin(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + 'mekha_salt'
  );
}
