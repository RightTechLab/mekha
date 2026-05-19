import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { format, subDays } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import { getTransactions, getTransactionsByOrderId } from '../../../src/db/repositories/transactionRepo';
import { getOrderItems } from '../../../src/db/repositories/orderRepo';
import { useSessionStore } from '../../../src/features/auth/sessionStore';
import { generatePromptPayQR } from '../../../src/lib/promptpay';
import type { Transaction, OrderItem } from '../../../src/types';

const METHOD_LABELS: Record<string, string> = {
  cash: 'เงินสด',
  promptpay: 'PromptPay',
  lightning: 'Lightning',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  voided: 'bg-red-50 text-red-700',
  refunded: 'bg-yellow-50 text-yellow-700',
};

const DATE_RANGES = [
  { label: 'วันนี้', days: 0 },
  { label: '7 วัน', days: 7 },
  { label: '30 วัน', days: 30 },
  { label: '90 วัน', days: 90 },
];

const PAYMENT_FILTERS: { label: string; value: string | null }[] = [
  { label: 'ทั้งหมด', value: null },
  { label: 'เงินสด', value: 'cash' },
  { label: 'PromptPay', value: 'promptpay' },
  { label: 'Lightning', value: 'lightning' },
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const role = useSessionStore((s) => s.role);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedRange, setSelectedRange] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const loadData = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const startDate = selectedRange === 0
      ? today
      : format(subDays(new Date(), selectedRange), 'yyyy-MM-dd');

    const allTxns = getTransactions({
      method: selectedMethod ?? undefined,
      limit: 500,
    }).filter((t) => {
      const txnDate = t.created_at.substring(0, 10);
      return txnDate >= startDate && txnDate <= today;
    });

    // Deduplicate: keep only first txn per order_id
    const seen = new Set<string>();
    const deduped = allTxns.filter((t) => {
      if (seen.has(t.order_id)) return false;
      seen.add(t.order_id);
      return true;
    });
    setTransactions(deduped);
  }, [selectedRange, selectedMethod]);

  useFocusEffect(loadData);

  const totalFiltered = transactions.reduce((sum, t) => sum + t.amount_thb, 0);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-mekha-text">ธุรกรรม</Text>
      </View>

      {/* Filters */}
      <View className="px-4 pb-3">
        {/* Date Range Filter */}
        <View className="flex-row gap-2 mb-2">
          {DATE_RANGES.map((range) => (
            <Pressable
              key={range.days}
              className={`px-3 py-1.5 rounded-full ${
                selectedRange === range.days
                  ? 'bg-purple-600'
                  : 'bg-purple-50'
              }`}
              onPress={() => setSelectedRange(range.days)}
            >
              <Text
                className={`text-xs font-medium ${
                  selectedRange === range.days ? 'text-white' : 'text-purple-700'
                }`}
              >
                {range.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Payment Method Filter */}
        <View className="flex-row gap-2 mb-2">
          {PAYMENT_FILTERS.map((filter) => (
            <Pressable
              key={filter.value ?? 'all'}
              className={`px-3 py-1.5 rounded-full ${
                selectedMethod === filter.value
                  ? 'bg-purple-600'
                  : 'bg-purple-50'
              }`}
              onPress={() => setSelectedMethod(filter.value)}
            >
              <Text
                className={`text-xs font-medium ${
                  selectedMethod === filter.value ? 'text-white' : 'text-purple-700'
                }`}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary bar */}
        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-mekha-muted">{transactions.length} รายการ</Text>
          <Text className="text-sm font-bold text-purple-600">รวม ฿{totalFiltered.toLocaleString()}</Text>
        </View>
      </View>

      {transactions.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-mekha-muted">ยังไม่มีธุรกรรม</Text>
        </View>
      ) : (
        <FlashList
          data={transactions}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => <TransactionCard txn={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function TransactionCard({ txn }: { txn: Transaction }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [splitTxns, setSplitTxns] = useState<Transaction[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState('');

  // Load split info immediately on mount/recycle
  useEffect(() => {
    setExpanded(false);
    setItems([]);
    const related = getTransactionsByOrderId(txn.order_id);
    setSplitTxns(related.length > 1 ? related : []);
  }, [txn.id, txn.order_id]);

  const toggleExpand = useCallback(() => {
    if (!expanded) {
      setItems(getOrderItems(txn.order_id));
    }
    setExpanded((e) => !e);
  }, [expanded, txn.order_id]);

  const isSplitGroup = splitTxns.length > 1;
  const orderTotal = isSplitGroup
    ? splitTxns.reduce((sum, t) => sum + t.amount_thb, 0)
    : txn.amount_thb;

  // Check if split uses multiple different payment methods
  const uniqueMethods = isSplitGroup
    ? [...new Set(splitTxns.map((t) => t.payment_method))]
    : [txn.payment_method];
  const isMultiMethod = uniqueMethods.length > 1;

  const displayMethod = isMultiMethod
    ? 'หลายรูปแบบ'
    : (METHOD_LABELS[uniqueMethods[0]] ?? uniqueMethods[0]);

  return (
    <Pressable
      className="mb-3 p-4 bg-mekha-surface border border-mekha-border rounded-2xl"
      onPress={toggleExpand}
    >
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium text-mekha-text">
            {displayMethod}
          </Text>
          {isSplitGroup && (
            <View className="bg-purple-100 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-purple-700 font-medium">แบ่งจ่าย</Text>
            </View>
          )}
        </View>
        <Text className="text-base font-bold text-purple-600">
          ฿{orderTotal.toFixed(2)}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-mekha-muted">
          {format(new Date(txn.created_at), 'dd/MM/yy HH:mm')}
        </Text>
        <View className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[txn.status]?.split(' ')[0] ?? 'bg-gray-100'}`}>
          <Text className={`text-xs font-medium ${STATUS_COLORS[txn.status]?.split(' ')[1] ?? 'text-gray-700'}`}>
            {txn.status}
          </Text>
        </View>
      </View>
      {txn.amount_sat && (
        <Text className="text-xs text-mekha-muted mt-1">
          {txn.amount_sat.toLocaleString()} sats @ ฿{txn.btc_rate_thb?.toLocaleString()}
        </Text>
      )}
      {expanded && isSplitGroup && (
        <View className="mt-3 pt-3 border-t border-mekha-border">
          <Text className="text-xs font-semibold text-mekha-text mb-2">การชำระเงิน ({splitTxns.length} รายการ)</Text>
          {splitTxns.map((st) => (
            <View key={st.id} className="flex-row justify-between py-1">
              <Text className="text-xs text-mekha-text">
                {METHOD_LABELS[st.payment_method] ?? st.payment_method}
              </Text>
              <Text className="text-xs font-medium text-mekha-text">
                ฿{st.amount_thb.toFixed(2)}
              </Text>
            </View>
          ))}
          <View className="flex-row justify-between mt-1 pt-1 border-t border-mekha-border">
            <Text className="text-xs font-semibold text-mekha-text">ยอดรวม</Text>
            <Text className="text-xs font-bold text-purple-600">฿{orderTotal.toFixed(2)}</Text>
          </View>
        </View>
      )}
      {expanded && items.length > 0 && (
        <View className={`mt-3 pt-3 border-t border-mekha-border ${isSplitGroup ? 'mt-2 pt-2' : ''}`}>
          {items.map((item) => (
            <View key={item.id} className="flex-row justify-between py-1">
              <Text className="text-xs text-mekha-text flex-1">
                {item.menu_name} x{item.quantity}
              </Text>
              <Text className="text-xs text-mekha-muted">
                ฿{item.item_total.toFixed(0)}
              </Text>
            </View>
          ))}
        </View>
      )}
      {expanded && items.length === 0 && (
        <Text className="text-xs text-mekha-muted mt-2 italic">ไม่มีรายละเอียด</Text>
      )}
      {expanded && txn.status === 'completed' && (txn.payment_method === 'promptpay' || txn.payment_method === 'lightning') && (
        <Pressable
          className="mt-3 bg-purple-50 py-2 rounded-xl items-center"
          onPress={async (e) => {
            e.stopPropagation?.();
            if (txn.payment_method === 'promptpay') {
              const promptpayId = await SecureStore.getItemAsync('mekha.promptpay_id');
              if (promptpayId) {
                setQrData(generatePromptPayQR(promptpayId, txn.amount_thb));
                setShowQr(true);
              }
            } else if (txn.payment_method === 'lightning' && txn.lightning_invoice) {
              setQrData(txn.lightning_invoice);
              setShowQr(true);
            }
          }}
        >
          <Text className="text-sm font-medium text-purple-700">แสดง QR อีกครั้ง</Text>
        </Pressable>
      )}
      {showQr && (
        <Modal visible={showQr} animationType="fade" transparent>
          <TouchableWithoutFeedback onPress={() => setShowQr(false)}>
            <View className="flex-1 bg-black/40 items-center justify-center">
              <TouchableWithoutFeedback>
                <View className="bg-white rounded-2xl p-6 mx-6 items-center">
                  <Text className="text-lg font-bold text-mekha-text mb-2">
                    {txn.payment_method === 'promptpay' ? 'PromptPay QR' : 'Lightning Invoice'}
                  </Text>
                  <Text className="text-purple-600 font-semibold mb-4">฿{txn.amount_thb.toFixed(2)}</Text>
                  {txn.payment_method === 'lightning' && (
                    <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4">
                      <Text className="text-xs text-amber-700 text-center">
                        Invoice นี้อาจหมดอายุแล้ว ตรวจสอบก่อนให้ลูกค้าสแกน
                      </Text>
                    </View>
                  )}
                  <View className="bg-white p-3 rounded-xl border border-mekha-border">
                    <QRCode value={qrData} size={200} />
                  </View>
                  <Pressable className="mt-4 py-2 px-6 rounded-xl bg-purple-600" onPress={() => setShowQr(false)}>
                    <Text className="text-white font-semibold">ปิด</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </Pressable>
  );
}
