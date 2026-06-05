import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { format, subDays } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { cancelTransaction, completeTransaction, getNextSerial, getTransactions, getTransactionsByOrderId, updatePendingTransactionMethod, updateTransactionStatus } from '../../../src/db/repositories/transactionRepo';
import { getOrderItems, updateOrderStatus } from '../../../src/db/repositories/orderRepo';
import { useSessionStore } from '../../../src/features/auth/sessionStore';
import { generatePromptPayQR } from '../../../src/lib/promptpay';
import { checkVerifyUrl, parseInvoiceExpiry } from '../../../src/lib/lightning';
import { getBtcRateThb, thbToSats } from '../../../src/lib/exchangeRate';
import { useLnurlCacheStore } from '../../../src/features/payment/lnurlCacheStore';
import type { PaymentMethod, Transaction, OrderItem } from '../../../src/types';

const METHOD_LABELS: Record<string, string> = {
  cash: 'เงินสด',
  promptpay: 'PromptPay',
  lightning: 'Lightning',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  expired: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  voided: 'bg-red-50 text-red-700',
  refunded: 'bg-yellow-50 text-yellow-700',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'ชำระแล้ว',
  cancelled: 'ยกเลิก',
  voided: 'ยกเลิก',
  refunded: 'คืนเงิน',
  pending: 'รอชำระ',
  expired: 'หมดอายุ',
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

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

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
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
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
          renderItem={({ item }) => <TransactionCard txn={item} onChanged={loadData} />}
        />
      )}
    </SafeAreaView>
  );
}

function TransactionCard({ txn, onChanged }: { txn: Transaction; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [splitTxns, setSplitTxns] = useState<Transaction[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState('');
  const [qrTxn, setQrTxn] = useState<Transaction>(txn);
  const [qrNow, setQrNow] = useState(Date.now());

  // Load split info immediately on mount/recycle
  useEffect(() => {
    setExpanded(false);
    setItems([]);
    const related = getTransactionsByOrderId(txn.order_id);
    setSplitTxns(related.length > 1 ? related : []);
  }, [txn.id, txn.order_id]);

  useEffect(() => {
    if (!showQr || qrTxn.payment_method !== 'lightning' || !qrTxn.lightning_invoice) return;

    setQrNow(Date.now());
    const timer = setInterval(() => setQrNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showQr, qrTxn.id, qrTxn.payment_method, qrTxn.lightning_invoice]);

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
  const formatPaymentId = (t: Transaction) =>
    t.serial_number != null ? `#${String(t.serial_number).padStart(4, '0')}` : t.id.slice(0, 8);
  const refreshRelated = () => {
    const related = getTransactionsByOrderId(txn.order_id);
    setSplitTxns(related.length > 1 ? related : []);
    onChanged();
  };
  const settleOrderIfAllCompleted = () => {
    const related = getTransactionsByOrderId(txn.order_id);
    const active = related.filter((t) => !['cancelled', 'voided', 'refunded', 'expired'].includes(t.status));
    if (active.length > 0 && active.every((t) => t.status === 'completed')) {
      updateOrderStatus(txn.order_id, 'paid');
    }
  };
  const handleConfirmPending = (target: Transaction) => {
    completeTransaction(target.id);
    settleOrderIfAllCompleted();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refreshRelated();
  };
  const handleCancelPending = (target: Transaction) => {
    Alert.alert('ยกเลิกรายการรอชำระ', `ต้องการยกเลิก ${formatPaymentId(target)} หรือไม่?`, [
      { text: 'ไม่ยกเลิก', style: 'cancel' },
      {
        text: 'ยกเลิกรายการ',
        style: 'destructive',
        onPress: () => {
          cancelTransaction(target.id, 'cancelled from transaction history');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          refreshRelated();
        },
      },
    ]);
  };
  const handleCheckLightning = async (target: Transaction) => {
    if (!target.lightning_verify_url) {
      Alert.alert('ตรวจสอบไม่ได้', 'รายการนี้ไม่มี verify URL');
      return;
    }
    const status = await checkVerifyUrl(target.lightning_verify_url);
    if (status === 'settled') {
      completeTransaction(target.id);
      settleOrderIfAllCompleted();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('จ่ายแล้ว', 'ตรวจพบการชำระเงิน Lightning แล้ว');
      refreshRelated();
      return;
    }
    const expiryMs = target.lightning_invoice ? parseInvoiceExpiry(target.lightning_invoice) : null;
    if (expiryMs && Date.now() > expiryMs) {
      updateTransactionStatus(target.id, 'expired');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('หมดอายุแล้ว', 'Invoice นี้หมดอายุแล้ว');
      refreshRelated();
      return;
    }
    Alert.alert('ยังไม่พบการชำระ', 'ยังตรวจไม่พบการจ่าย Lightning รายการนี้');
  };
  const handleSwitchMethod = async (target: Transaction, method: PaymentMethod) => {
    if (target.status !== 'pending' || method === target.payment_method) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (method === 'cash') {
        updatePendingTransactionMethod(target.id, {
          paymentMethod: 'cash',
          amountSat: null,
          btcRateThb: null,
          lightningInvoice: null,
          lightningVerifyUrl: null,
          promptpayRef: null,
          serialNumber: null,
        });
        refreshRelated();
        return;
      }

      const serial = getNextSerial();
      if (method === 'promptpay') {
        const promptpayId = await SecureStore.getItemAsync('mekha.promptpay_id');
        if (!promptpayId) {
          Alert.alert('ยังไม่ได้ตั้งค่า', 'กรุณาตั้งค่า PromptPay ID ในหน้าตั้งค่าก่อน');
          return;
        }
        const qr = generatePromptPayQR(promptpayId, target.amount_thb);
        updatePendingTransactionMethod(target.id, {
          paymentMethod: 'promptpay',
          amountSat: null,
          btcRateThb: null,
          lightningInvoice: null,
          lightningVerifyUrl: null,
          promptpayRef: qr,
          serialNumber: serial,
        });
        const updatedTxn = {
          ...target,
          payment_method: 'promptpay' as const,
          amount_sat: null,
          btc_rate_thb: null,
          lightning_invoice: null,
          lightning_verify_url: null,
          promptpay_ref: qr,
          serial_number: serial,
        };
        setQrTxn(updatedTxn);
        setQrData(qr);
        setShowQr(true);
        refreshRelated();
        return;
      }

      const lnAddress = await SecureStore.getItemAsync('mekha.ln_address');
      if (!lnAddress) {
        Alert.alert('ยังไม่ได้ตั้งค่า', 'กรุณาตั้งค่า Lightning Address ในหน้าตั้งค่าก่อน');
        return;
      }
      const rate = await getBtcRateThb();
      const amountSat = thbToSats(target.amount_thb, rate);
      const invoiceResult = await useLnurlCacheStore.getState().requestInvoiceWithCache(amountSat * 1000, lnAddress);
      updatePendingTransactionMethod(target.id, {
        paymentMethod: 'lightning',
        amountSat,
        btcRateThb: rate,
        lightningInvoice: invoiceResult.pr,
        lightningVerifyUrl: invoiceResult.verify,
        promptpayRef: null,
        serialNumber: serial,
      });
      const updatedTxn = {
        ...target,
        payment_method: 'lightning' as const,
        amount_sat: amountSat,
        btc_rate_thb: rate,
        lightning_invoice: invoiceResult.pr,
        lightning_verify_url: invoiceResult.verify,
        promptpay_ref: null,
        serial_number: serial,
      };
      setQrTxn(updatedTxn);
      setQrData(invoiceResult.pr);
      setShowQr(true);
      refreshRelated();
    } catch (e: any) {
      Alert.alert('ผิดพลาด', e?.message ?? 'ไม่สามารถเปลี่ยนวิธีชำระได้');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  const handleCopyInvoice = async () => {
    if (qrTxn.payment_method !== 'lightning' || !qrData) return;
    await Clipboard.setStringAsync(qrData);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('คัดลอกแล้ว', 'Invoice ถูกคัดลอกเรียบร้อย');
  };

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
          {txn.serial_number && txn.payment_method !== 'cash' && !isSplitGroup && (
            <View className="bg-mekha-surface px-2 py-0.5 rounded-full border border-mekha-border">
              <Text className="text-xs text-mekha-muted font-medium">#{String(txn.serial_number).padStart(4, '0')}</Text>
            </View>
          )}
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
            {STATUS_LABELS[txn.status] ?? txn.status}
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
                {st.serial_number && st.payment_method !== 'cash' ? ` #${String(st.serial_number).padStart(4, '0')}` : ''}
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
      {expanded && (txn.status === 'completed' || txn.status === 'pending') && !isSplitGroup && (txn.payment_method === 'promptpay' || txn.payment_method === 'lightning') && (
        <Pressable
          className="mt-3 bg-purple-50 py-2 rounded-xl items-center"
          onPress={async (e) => {
            e.stopPropagation?.();
            setQrTxn(txn);
            if (txn.payment_method === 'promptpay') {
              if (txn.promptpay_ref) {
                setQrData(txn.promptpay_ref);
                setShowQr(true);
              } else {
                const promptpayId = await SecureStore.getItemAsync('mekha.promptpay_id');
                if (promptpayId) {
                  setQrData(generatePromptPayQR(promptpayId, txn.amount_thb));
                  setShowQr(true);
                }
              }
            } else if (txn.payment_method === 'lightning' && txn.lightning_invoice) {
              setQrData(txn.lightning_invoice);
              setShowQr(true);
            }
          }}
        >
          <Text className="text-sm font-medium text-purple-700">
            แสดง QR {formatPaymentId(txn)} อีกครั้ง
          </Text>
        </Pressable>
      )}
      {expanded && txn.status === 'pending' && !isSplitGroup && (
        <PendingActions
          txn={txn}
          onConfirm={handleConfirmPending}
          onCancel={handleCancelPending}
          onCheckLightning={handleCheckLightning}
          onSwitchMethod={handleSwitchMethod}
        />
      )}
      {expanded && isSplitGroup && splitTxns.filter((st) => st.payment_method === 'promptpay' || st.payment_method === 'lightning').length > 0 && (
        <View className="mt-3">
          {splitTxns.filter((st) => st.payment_method === 'promptpay' || st.payment_method === 'lightning').map((st) => (
            <Pressable
              key={st.id}
              className="bg-purple-50 py-2 rounded-xl items-center mb-1"
              onPress={async (e) => {
                e.stopPropagation?.();
                setQrTxn(st);
                if (st.payment_method === 'promptpay') {
                  if (st.promptpay_ref) {
                    setQrData(st.promptpay_ref);
                    setShowQr(true);
                  } else {
                    const promptpayId = await SecureStore.getItemAsync('mekha.promptpay_id');
                    if (promptpayId) {
                      setQrData(generatePromptPayQR(promptpayId, st.amount_thb));
                      setShowQr(true);
                    }
                  }
                } else if (st.payment_method === 'lightning' && st.lightning_invoice) {
                  setQrData(st.lightning_invoice);
                  setShowQr(true);
                }
              }}
            >
              <Text className="text-sm font-medium text-purple-700">
                {formatPaymentId(st)} QR {METHOD_LABELS[st.payment_method]} ฿{st.amount_thb.toFixed(2)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {expanded && isSplitGroup && splitTxns.some((st) => st.status === 'pending') && (
        <View className="mt-2">
          {splitTxns.filter((st) => st.status === 'pending').map((st) => (
            <PendingActions
              key={`pending-${st.id}`}
              txn={st}
              onConfirm={handleConfirmPending}
              onCancel={handleCancelPending}
              onCheckLightning={handleCheckLightning}
              onSwitchMethod={handleSwitchMethod}
            />
          ))}
        </View>
      )}
      {showQr && (
        <Modal visible={showQr} animationType="fade" transparent>
          <TouchableWithoutFeedback onPress={() => setShowQr(false)}>
            <View className="flex-1 bg-black/40 items-center justify-center">
              <TouchableWithoutFeedback>
                <View className="bg-white rounded-2xl p-6 mx-6 items-center">
                  <Text className="text-lg font-bold text-mekha-text mb-2">
                    {qrTxn.payment_method === 'promptpay' ? 'PromptPay QR' : 'Lightning Invoice'}
                  </Text>
                  {qrTxn.serial_number != null && (
                    <Text className="text-sm text-mekha-muted mb-1">#{String(qrTxn.serial_number).padStart(4, '0')}</Text>
                  )}
                  <Text className="text-purple-600 font-semibold mb-4">฿{qrTxn.amount_thb.toFixed(2)}</Text>
                  {qrTxn.payment_method === 'lightning' && qrTxn.lightning_invoice && (() => {
                    if (qrTxn.status === 'completed') {
                      return (
                        <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 mb-4">
                          <Text className="text-xs text-green-700 text-center font-medium">
                            จ่ายแล้ว
                          </Text>
                        </View>
                      );
                    }
                    const expiryMs = parseInvoiceExpiry(qrTxn.lightning_invoice!);
                    const remainingMs = expiryMs ? expiryMs - qrNow : 0;
                    const isExpired = remainingMs <= 0;
                    return isExpired ? (
                      <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-4">
                        <Text className="text-xs text-red-700 text-center font-medium">
                          Invoice หมดอายุแล้ว
                        </Text>
                      </View>
                    ) : (
                      <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 mb-4">
                        <Text className="text-xs text-green-700 text-center font-medium">
                          หมดอายุใน {formatCountdown(remainingMs)}
                        </Text>
                      </View>
                    );
                  })()}
                  <Pressable className="bg-white p-3 rounded-xl border border-mekha-border" onPress={handleCopyInvoice}>
                    <QRCode value={qrData} size={200} />
                  </Pressable>
                  {qrTxn.payment_method === 'lightning' && (
                    <Text className="text-xs text-mekha-muted mt-2">แตะ QR เพื่อคัดลอก invoice</Text>
                  )}
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

function PendingActions({
  txn,
  onConfirm,
  onCancel,
  onCheckLightning,
  onSwitchMethod,
}: {
  txn: Transaction;
  onConfirm: (txn: Transaction) => void;
  onCancel: (txn: Transaction) => void;
  onCheckLightning: (txn: Transaction) => void;
  onSwitchMethod: (txn: Transaction, method: PaymentMethod) => void;
}) {
  const switchTargets = (['cash', 'promptpay', 'lightning'] as PaymentMethod[]).filter(
    (method) => method !== txn.payment_method
  );

  return (
    <View className="mt-2 gap-2">
      <View className="bg-mekha-surface border border-mekha-border rounded-xl px-3 py-2">
        <Text className="text-xs font-semibold text-mekha-text mb-2">
          เปลี่ยนวิธีชำระ
        </Text>
        <View className="flex-row gap-2">
          {switchTargets.map((method) => (
            <Pressable
              key={method}
              className="flex-1 bg-white border border-mekha-border py-2 rounded-lg items-center"
              onPress={(e) => {
                e.stopPropagation?.();
                onSwitchMethod(txn, method);
              }}
            >
              <Text className="text-xs font-medium text-purple-700">
                {METHOD_LABELS[method]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {txn.payment_method === 'lightning' && (
        <Pressable
          className="bg-amber-50 border border-amber-200 py-2 rounded-xl items-center"
          onPress={(e) => {
            e.stopPropagation?.();
            onCheckLightning(txn);
          }}
        >
          <Text className="text-sm font-medium text-amber-700">ตรวจสอบ Lightning</Text>
        </Pressable>
      )}
      <Pressable
        className="bg-green-50 border border-green-200 py-2 rounded-xl items-center"
        onPress={(e) => {
          e.stopPropagation?.();
          onConfirm(txn);
        }}
      >
        <Text className="text-sm font-medium text-green-700">ยืนยันรับเงิน</Text>
      </Pressable>
      <Pressable
        className="bg-red-50 border border-red-200 py-2 rounded-xl items-center"
        onPress={(e) => {
          e.stopPropagation?.();
          onCancel(txn);
        }}
      >
        <Text className="text-sm font-medium text-red-700">ยกเลิกรายการรอชำระ</Text>
      </Pressable>
    </View>
  );
}
