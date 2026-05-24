import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Alert, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useCartStore } from '../../../src/features/cart/cartStore';
import { useSessionStore } from '../../../src/features/auth/sessionStore';
import {
  createOrder,
  addOrderItem,
  updateOrderStatus,
} from '../../../src/db/repositories/orderRepo';
import { createTransaction } from '../../../src/db/repositories/transactionRepo';
import { getSetting } from '../../../src/db/repositories/transactionRepo';
import { setTableStatus, clearTable } from '../../../src/db/repositories/tableRepo';
import { generatePromptPayQR } from '../../../src/lib/promptpay';
import { getBtcRateThb, thbToSats } from '../../../src/lib/exchangeRate';
import { fetchLnurlPayParams, requestInvoice } from '../../../src/lib/lightning';
import NumPad from '../../../src/components/NumPad';
import type { PaymentMethod } from '../../../src/types';
import QRCode from 'react-native-qrcode-svg';

type CheckoutStep = 'summary' | 'payment' | 'cash' | 'promptpay' | 'lightning' | 'done';

export default function CheckoutScreen() {
  const { items, getTotal, getSubtotal, discount, clear, updateQty, removeItem, setDiscount, tableId, tableName } = useCartStore();
  const insets = useSafeAreaInsets();
  const role = useSessionStore((s) => s.role);
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [qrData, setQrData] = useState('');
  const [lnInvoice, setLnInvoice] = useState('');
  const [lnLoading, setLnLoading] = useState(false);
  const [lnError, setLnError] = useState('');
  const [lnAmountSat, setLnAmountSat] = useState(0);
  const [lnRate, setLnRate] = useState(0);
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [customDiscountValue, setCustomDiscountValue] = useState('');
  const [customDiscountType, setCustomDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [customerCount, setCustomerCount] = useState(1);
  const [splitMode, setSplitMode] = useState<'none' | 'equal' | 'items'>('none');
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [selectedUnitIndices, setSelectedUnitIndices] = useState<Set<number>>(new Set());
  const [paidUnitIndices, setPaidUnitIndices] = useState<Set<number>>(new Set());
  const [paidSplits, setPaidSplits] = useState<{ label: string; amount: number; method: PaymentMethod; amountSat: number | null; btcRate: number | null }[]>([]);

  const total = getTotal();
  const subtotal = getSubtotal();
  const vatRate = parseFloat(getSetting('vat_rate') ?? '7');
  const vatIncluded = getSetting('vat_included') === '1';
  const discountAmount = discount
    ? discount.type === 'percent'
      ? subtotal * (discount.value / 100)
      : discount.value
    : 0;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = vatIncluded
    ? afterDiscount - afterDiscount / (1 + vatRate / 100)
    : afterDiscount * (vatRate / 100);
  // finalTotal = amount the customer actually pays
  const finalTotal = vatIncluded ? afterDiscount : afterDiscount + vatAmount;

  // Split bill calculations
  const splitPerPerson = customerCount > 1 ? finalTotal / customerCount : finalTotal;

  // Expand items into individual units for split-by-items
  const expandedUnits = items.flatMap((item, itemIdx) =>
    Array.from({ length: item.quantity }, (_, unitIdx) => ({
      itemIdx,
      unitIdx,
      name: item.name,
      unitPrice: item.unitPrice,
      optionsDelta: item.selectedOptions.reduce((s, o) => s + (o.priceDelta ?? 0), 0),
      unitTotal: item.unitPrice + item.selectedOptions.reduce((s, o) => s + (o.priceDelta ?? 0), 0),
      options: item.selectedOptions,
      note: item.note,
    }))
  );

  const selectedItemsTotal = Array.from(selectedUnitIndices).reduce(
    (sum, idx) => sum + (expandedUnits[idx]?.unitTotal ?? 0),
    0
  );
  const totalPaid = paidSplits.reduce((sum, s) => sum + s.amount, 0);
  const remaining = finalTotal - totalPaid;
  const currentPayAmount =
    splitMode === 'equal'
      ? splitPerPerson
      : splitMode === 'items'
        ? selectedItemsTotal
        : finalTotal;

  const getPayableAmount = () => {
    if (splitMode === 'none') return finalTotal;
    if (splitMode === 'equal') return Math.min(splitPerPerson, remaining);
    if (splitMode === 'items') return selectedItemsTotal;
    return finalTotal;
  };

  const handlePayment = useCallback(
    async (method: PaymentMethod) => {
      const payAmount = getPayableAmount();
      if (payAmount <= 0) {
        Alert.alert('ไม่สามารถชำระได้', 'ยอดชำระต้องมากกว่า 0');
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (method === 'cash') {
        setStep('cash');
      } else if (method === 'promptpay') {
        const promptpayId = await SecureStore.getItemAsync('mekha.promptpay_id');
        if (!promptpayId) {
          Alert.alert('ยังไม่ได้ตั้งค่า', 'กรุณาตั้งค่า PromptPay ID ในหน้าตั้งค่าก่อน');
          return;
        }
        const qr = generatePromptPayQR(promptpayId, payAmount);
        setQrData(qr);
        setStep('promptpay');
      } else if (method === 'lightning') {
        setLnLoading(true);
        setLnError('');
        setStep('lightning');
        try {
          console.time('[LNURL] total');
          const lnAddress = await SecureStore.getItemAsync('mekha.ln_address');
          if (!lnAddress) {
            setLnError('ยังไม่ได้ตั้งค่า Lightning Address ในตั้งค่า');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setLnLoading(false);
            console.timeEnd('[LNURL] total');
            return;
          }
          console.time('[LNURL] getBtcRateThb');
          const rate = await getBtcRateThb();
          console.timeEnd('[LNURL] getBtcRateThb');
          const amountSat = thbToSats(payAmount, rate);
          const amountMsat = amountSat * 1000;
          setLnRate(rate);
          setLnAmountSat(amountSat);

          console.time('[LNURL] fetchLnurlPayParams');
          const params = await fetchLnurlPayParams(lnAddress);
          console.timeEnd('[LNURL] fetchLnurlPayParams');
          if (amountMsat < params.minSendable || amountMsat > params.maxSendable) {
            setLnError(`จำนวนเงินไม่อยู่ในช่วงที่รองรับ (${params.minSendable / 1000}-${params.maxSendable / 1000} sats)`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setLnLoading(false);
            console.timeEnd('[LNURL] total');
            return;
          }
          console.time('[LNURL] requestInvoice');
          const invoice = await requestInvoice(params.callback, amountMsat);
          console.timeEnd('[LNURL] requestInvoice');
          setLnInvoice(invoice);
          console.timeEnd('[LNURL] total');
        } catch (e: any) {
          setLnError(e?.message ?? 'ไม่สามารถสร้าง Invoice ได้');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          console.timeEnd('[LNURL] total');
        } finally {
          setLnLoading(false);
        }
      }
    },
    [finalTotal, splitMode, splitPerPerson, remaining, selectedItemsTotal]
  );

  const recordSplitPayment = useCallback(
    (method: PaymentMethod, extra?: { amountSat: number; btcRate: number }) => {
      const payAmount = getPayableAmount();
      let label: string;
      if (splitMode === 'equal') {
        label = `คนที่ ${paidSplits.length + 1} (${method})`;
      } else {
        const selectedNames = Array.from(selectedUnitIndices).map((i) => expandedUnits[i]?.name).filter(Boolean);
        label = `${selectedNames.join(', ')} (${method})`;
      }
      const newSplits = [...paidSplits, { label, amount: payAmount, method, amountSat: extra?.amountSat ?? null, btcRate: extra?.btcRate ?? null }];
      setPaidSplits(newSplits);

      // Mark selected units as paid
      if (splitMode === 'items') {
        const newPaid = new Set(paidUnitIndices);
        selectedUnitIndices.forEach((idx) => newPaid.add(idx));
        setPaidUnitIndices(newPaid);
      }
      setSelectedUnitIndices(new Set());

      const newTotalPaid = newSplits.reduce((sum, s) => sum + s.amount, 0);
      if (newTotalPaid >= finalTotal - 0.01) {
        completeOrder(method, undefined, newSplits);
      } else {
        setStep('summary');
      }
    },
    [splitMode, paidSplits, selectedUnitIndices, expandedUnits, paidUnitIndices, finalTotal]
  );

  const completeOrder = useCallback(
    async (method: PaymentMethod, extra?: { amountSat?: number; btcRate?: number }, splitsOverride?: typeof paidSplits) => {
      const orderId = Crypto.randomUUID();
      const splits = splitsOverride ?? paidSplits;

      // Create order with table link
      createOrder({ id: orderId, status: 'open', note: null, table_id: tableId });

      // Mark table as occupied
      if (tableId) {
        setTableStatus(tableId, 'occupied', orderId);
      }

      // Add order items
      for (const item of items) {
        addOrderItem({
          id: Crypto.randomUUID(),
          order_id: orderId,
          menu_id: item.menuId.startsWith('custom-') ? null : item.menuId,
          menu_name: item.name,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          selected_options: JSON.stringify(item.selectedOptions),
          item_total: item.itemTotal,
        });
      }

      // Mark order paid
      updateOrderStatus(orderId, 'paid');

      // Free up the table
      if (tableId) {
        clearTable(tableId);
      }

      if (splits.length > 0) {
        // Split bill — create transaction per split
        for (const split of splits) {
          createTransaction({
            id: Crypto.randomUUID(),
            order_id: orderId,
            payment_method: split.method,
            amount_thb: split.amount,
            amount_sat: split.amountSat,
            btc_rate_thb: split.btcRate,
            discount_amount: 0,
            vat_amount: 0,
            vat_included: vatIncluded ? 1 : 0,
            status: 'completed',
            lightning_invoice: split.method === 'lightning' ? lnInvoice : null,
            lightning_preimage: null,
            promptpay_ref: split.method === 'promptpay' ? qrData : null,
            cashier_id: role,
            void_reason: null,
          });
        }
        // Last split (current payment) — only if remaining after all recorded splits
        const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
        const leftover = finalTotal - splitTotal;
        if (leftover > 0.01) {
          createTransaction({
            id: Crypto.randomUUID(),
            order_id: orderId,
            payment_method: method,
            amount_thb: leftover,
            amount_sat: extra?.amountSat ?? null,
            btc_rate_thb: extra?.btcRate ?? null,
            discount_amount: discountAmount,
            vat_amount: vatAmount,
            vat_included: vatIncluded ? 1 : 0,
            status: 'completed',
            lightning_invoice: method === 'lightning' ? lnInvoice : null,
            lightning_preimage: null,
            promptpay_ref: method === 'promptpay' ? qrData : null,
            cashier_id: role,
            void_reason: null,
          });
        }
      } else {
        // Normal single payment
        createTransaction({
          id: Crypto.randomUUID(),
          order_id: orderId,
          payment_method: method,
          amount_thb: finalTotal,
          amount_sat: extra?.amountSat ?? null,
          btc_rate_thb: extra?.btcRate ?? null,
          discount_amount: discountAmount,
          vat_amount: vatAmount,
          vat_included: vatIncluded ? 1 : 0,
          status: 'completed',
          lightning_invoice: method === 'lightning' ? lnInvoice : null,
          lightning_preimage: null,
          promptpay_ref: method === 'promptpay' ? qrData : null,
          cashier_id: role,
          void_reason: null,
        });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clear();
      setStep('done');
    },
    [items, finalTotal, discountAmount, vatAmount, vatIncluded, role, clear, paidSplits, remaining, tableId]
  );

  if (step === 'done') {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Ionicons name="checkmark-circle" size={64} color="#22C55E" style={{ marginBottom: 16 }} />
        <Text className="text-2xl font-bold text-mekha-text mb-2">สำเร็จ!</Text>
        {tableName && (
          <View className="flex-row items-center gap-1 mb-1">
            <Ionicons name="grid-outline" size={16} color="#7C3AED" />
            <Text className="text-purple-600 font-medium">{tableName}</Text>
          </View>
        )}
        <Text className="text-mekha-muted mb-8">บันทึกธุรกรรมเรียบร้อยแล้ว</Text>
        <Pressable
          className="bg-purple-600 px-8 py-4 rounded-2xl"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">กลับหน้า POS</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'cash') {
    const payAmount = splitMode !== 'none' ? getPayableAmount() : finalTotal;
    const received = parseFloat(receivedAmount) || 0;
    const change = received - payAmount;
    const canConfirm = received > 0 && received >= payAmount - 0.01;

    return (
      <SafeAreaView className="flex-1 bg-white px-6 pt-8">
        <Text className="text-xl font-bold text-mekha-text mb-6">จ่ายเงินสด</Text>
        <Text className="text-mekha-muted mb-2">ยอดที่ต้องชำระ</Text>
        <Text className="text-3xl font-bold text-purple-600 mb-6">฿{payAmount.toFixed(2)}</Text>

        <Text className="text-mekha-muted mb-2">จำนวนเงินที่ได้รับ</Text>
        <View className="bg-mekha-surface border border-mekha-border rounded-2xl px-4 py-4 mb-4">
          <Text className="text-2xl font-bold text-mekha-text">
            ฿{receivedAmount || '0'}
          </Text>
        </View>

        <View className="bg-green-50 rounded-2xl px-4 py-3 mb-6">
          <Text className={`font-semibold ${canConfirm ? 'text-green-700' : 'text-gray-400'}`}>
            เงินทอน: {canConfirm ? `฿${Math.max(0, change).toFixed(2)}` : '฿ —'}
          </Text>
        </View>

        {/* NumPad */}
        <NumPad value={receivedAmount} onChange={setReceivedAmount} />

        <Pressable
          className={`mt-4 w-full py-4 rounded-2xl items-center ${
            canConfirm ? 'bg-purple-600' : 'bg-purple-200'
          }`}
          onPress={() => {
            if (splitMode !== 'none') {
              recordSplitPayment('cash');
              setReceivedAmount('');
            } else {
              completeOrder('cash');
            }
          }}
          disabled={!canConfirm}
        >
          <Text className="text-white font-semibold">ยืนยัน</Text>
        </Pressable>

        <Pressable className="mt-3 items-center" onPress={() => setStep('summary')}>
          <Text className="text-mekha-muted">ย้อนกลับ</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'promptpay') {
    const payAmount = splitMode !== 'none' ? getPayableAmount() : finalTotal;
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-xl font-bold text-mekha-text mb-2">PromptPay</Text>
        <Text className="text-3xl font-bold text-purple-600 mb-6">฿{payAmount.toFixed(2)}</Text>

        <View className="bg-white p-4 rounded-2xl border border-mekha-border mb-6">
          <QRCode value={qrData} size={220} />
        </View>

        <Text className="text-mekha-muted text-center mb-6">
          ลูกค้าสแกน QR เพื่อชำระเงิน{'\n'}กดยืนยันเมื่อตรวจสอบยอดเรียบร้อย
        </Text>

        <Pressable
          className="w-full py-4 rounded-2xl items-center bg-purple-600"
          onPress={() => {
            if (splitMode !== 'none') {
              recordSplitPayment('promptpay');
            } else {
              completeOrder('promptpay');
            }
          }}
        >
          <Text className="text-white font-semibold">ยืนยันรับเงิน</Text>
        </Pressable>

        <Pressable className="mt-3 items-center" onPress={() => setStep('summary')}>
          <Text className="text-mekha-muted">ยกเลิก</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'lightning') {
    const payAmount = splitMode !== 'none' ? getPayableAmount() : finalTotal;
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-xl font-bold text-mekha-text mb-2">Lightning</Text>
        <Text className="text-3xl font-bold text-purple-600 mb-2">฿{payAmount.toFixed(2)}</Text>
        {lnAmountSat > 0 && (
          <Text className="text-mekha-muted text-sm mb-6">
            ≈ {lnAmountSat.toLocaleString()} sats (฿{lnRate.toLocaleString()}/BTC)
          </Text>
        )}

        {lnLoading && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text className="text-mekha-muted mt-3">กำลังสร้าง Invoice...</Text>
          </View>
        )}

        {lnError ? (
          <View className="bg-red-50 rounded-2xl px-5 py-4 mb-6 w-full">
            <Text className="text-red-700 text-center">{lnError}</Text>
          </View>
        ) : null}

        {lnInvoice && !lnLoading ? (
          <>
            <View className="bg-white p-4 rounded-2xl border border-mekha-border mb-4">
              <QRCode value={lnInvoice} size={220} />
            </View>
            <Text className="text-mekha-muted text-center text-sm mb-6">
              ลูกค้าสแกน QR เพื่อชำระ{'\n'}กดยืนยันเมื่อเช็คสถานะเรียบร้อย
            </Text>
            <Pressable
              className="w-full py-4 rounded-2xl items-center bg-purple-600"
              onPress={() => {
                if (splitMode !== 'none') {
                  recordSplitPayment('lightning', { amountSat: lnAmountSat, btcRate: lnRate });
                } else {
                  completeOrder('lightning', { amountSat: lnAmountSat, btcRate: lnRate });
                }
              }}
            >
              <Text className="text-white font-semibold">ยืนยันรับเงิน</Text>
            </Pressable>
          </>
        ) : null}

        <Pressable className="mt-3 items-center" onPress={() => setStep('summary')}>
          <Text className="text-mekha-muted">ยกเลิก</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Summary & payment method selection
  const isLandscape = width > height;

  const itemListContent = (
    <>
      <Text className="text-xl font-bold text-mekha-text mb-4">สรุปออเดอร์</Text>

      {/* Table badge */}
      {tableName && (
        <View className="bg-purple-50 rounded-xl px-4 py-2 mb-3 flex-row items-center gap-2">
          <Ionicons name="grid-outline" size={16} color="#7C3AED" />
          <Text className="text-purple-700 font-medium">{tableName}</Text>
        </View>
      )}

      {/* Editable item list */}
      {items.map((item, idx) => (
        <View
          key={`${item.menuId}-${idx}`}
          className="py-3 border-b border-mekha-border"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-medium text-mekha-text">{item.name}</Text>
              {item.selectedOptions.length > 0 && (
                <Text className="text-xs text-purple-600">
                  {item.selectedOptions.map((o) => o.itemName).join(', ')}
                </Text>
              )}
              {item.note ? (
                <Text className="text-xs text-mekha-muted italic">"{item.note}"</Text>
              ) : null}
            </View>
            <Text className="text-sm font-semibold text-mekha-text w-16 text-right">
              ฿{item.itemTotal.toFixed(0)}
            </Text>
          </View>
          <View className="flex-row items-center mt-2 gap-2">
            <Pressable
              className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
              onPress={() => {
                if (item.quantity <= 1) {
                  removeItem(item.menuId);
                } else {
                  updateQty(item.menuId, item.quantity - 1);
                }
              }}
            >
              <Text className="text-red-700 font-bold text-base">
                {item.quantity <= 1 ? '✕' : '−'}
              </Text>
            </Pressable>
            <Text className="text-sm font-medium w-8 text-center">{item.quantity}</Text>
            <Pressable
              className="w-8 h-8 rounded-full bg-purple-50 items-center justify-center"
              onPress={() => updateQty(item.menuId, item.quantity + 1)}
            >
              <Text className="text-purple-700 font-bold text-base">+</Text>
            </Pressable>
            <Text className="text-xs text-mekha-muted ml-1">@฿{item.unitPrice}</Text>
          </View>
        </View>
      ))}

      {items.length === 0 && (
        <View className="py-8 items-center">
          <Text className="text-mekha-muted">ไม่มีสินค้าในตะกร้า</Text>
        </View>
      )}

      {/* Discount section */}
      <View className="mt-6 mb-2">
        <Text className="text-base font-semibold text-mekha-text mb-3">ส่วนลด</Text>
        <View className="flex-row gap-2 mb-2">
          {[5, 10, 15, 20].map((pct) => {
            const isActive = discount?.type === 'percent' && discount.value === pct;
            return (
              <Pressable
                key={pct}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  isActive
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-purple-50 border-purple-200'
                }`}
                onPress={() => {
                  if (isActive) {
                    setDiscount(null);
                  } else {
                    setDiscount({ type: 'percent', value: pct });
                    setShowCustomDiscount(false);
                  }
                }}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive ? 'text-white' : 'text-purple-700'
                  }`}
                >
                  {pct}%
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row gap-2">
          <Pressable
            className={`flex-1 py-2 rounded-xl items-center border ${
              showCustomDiscount
                ? 'bg-purple-600 border-purple-600'
                : 'bg-purple-50 border-purple-200'
            }`}
            onPress={() => {
              setShowCustomDiscount(!showCustomDiscount);
              if (showCustomDiscount) {
                setDiscount(null);
                setCustomDiscountValue('');
              }
            }}
          >
            <Text
              className={`text-sm font-medium ${
                showCustomDiscount ? 'text-white' : 'text-purple-700'
              }`}
            >
              กำหนดเอง
            </Text>
          </Pressable>
          {discount && (
            <Pressable
              className="py-2 px-4 rounded-xl items-center bg-red-50 border border-red-200"
              onPress={() => {
                setDiscount(null);
                setShowCustomDiscount(false);
                setCustomDiscountValue('');
              }}
            >
              <Text className="text-sm font-medium text-red-700">ยกเลิก</Text>
            </Pressable>
          )}
        </View>

        {showCustomDiscount && (
          <View className="mt-3 bg-mekha-surface rounded-xl p-3 border border-mekha-border">
            <View className="flex-row gap-2 mb-2">
              <Pressable
                className={`flex-1 py-2 rounded-lg items-center ${
                  customDiscountType === 'percent' ? 'bg-purple-600' : 'bg-purple-50'
                }`}
                onPress={() => setCustomDiscountType('percent')}
              >
                <Text
                  className={`text-sm font-medium ${
                    customDiscountType === 'percent' ? 'text-white' : 'text-purple-700'
                  }`}
                >
                  เปอร์เซ็นต์ (%)
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-2 rounded-lg items-center ${
                  customDiscountType === 'fixed' ? 'bg-purple-600' : 'bg-purple-50'
                }`}
                onPress={() => setCustomDiscountType('fixed')}
              >
                <Text
                  className={`text-sm font-medium ${
                    customDiscountType === 'fixed' ? 'text-white' : 'text-purple-700'
                  }`}
                >
                  จำนวนเงิน (฿)
                </Text>
              </Pressable>
            </View>
            <View className="flex-row items-center gap-2">
              <TextInput
                className="flex-1 border border-mekha-border rounded-lg px-3 py-2 text-sm text-mekha-text"
                placeholder={customDiscountType === 'percent' ? 'เช่น 12' : 'เช่น 50'}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={customDiscountValue}
                onChangeText={setCustomDiscountValue}
              />
              <Pressable
                className="bg-purple-600 px-4 py-2 rounded-lg"
                onPress={() => {
                  const val = parseFloat(customDiscountValue);
                  if (!val || val <= 0) return;
                  if (customDiscountType === 'percent' && val > 100) return;
                  if (customDiscountType === 'fixed' && val > subtotal) return;
                  setDiscount({ type: customDiscountType, value: val });
                }}
              >
                <Text className="text-white text-sm font-medium">ตกลง</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </>
  );

  const paymentContent = (
    <>
      {/* Split Bill Mode - collapsed by default */}
      <View className="mt-4 mb-4">
        <Pressable
          className="flex-row items-center justify-between mb-3"
          onPress={() => setShowSplitOptions(!showSplitOptions)}
        >
          <Text className="text-base font-semibold text-mekha-text">ตัวเลือกเพิ่มเติม</Text>
          <Ionicons name={showSplitOptions ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
        </Pressable>
        {showSplitOptions && (
          <>
        <View className="flex-row gap-2 mb-3">
          {([
            { mode: 'none' as const, label: 'ไม่แบ่ง' },
            { mode: 'equal' as const, label: 'หารเท่า' },
            { mode: 'items' as const, label: 'เลือกเมนู' },
          ] as const).map(({ mode, label }) => (
            <Pressable
              key={mode}
              className={`flex-1 py-3 rounded-xl items-center border ${
                splitMode === mode
                  ? 'bg-purple-600 border-purple-600'
                  : 'bg-purple-50 border-purple-200'
              }`}
              onPress={() => {
                setSplitMode(mode);
                setSelectedUnitIndices(new Set());
                setPaidUnitIndices(new Set());
                setPaidSplits([]);
                if (mode !== 'equal') setCustomerCount(1);
                if (mode === 'equal') setCustomerCount(2);
              }}
            >
              <Text
                className={`text-sm font-medium ${
                  splitMode === mode ? 'text-white' : 'text-purple-700'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Equal split - customer count */}
        {splitMode === 'equal' && (
          <View className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-3">
            <Text className="text-sm font-semibold text-blue-900 mb-3">จำนวนคน</Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                className="w-10 h-10 rounded-lg bg-blue-200 items-center justify-center"
                onPress={() => setCustomerCount(Math.max(2, customerCount - 1))}
              >
                <Text className="text-lg font-bold text-blue-700">−</Text>
              </Pressable>
              <TextInput
                className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-center text-mekha-text font-semibold"
                keyboardType="number-pad"
                value={customerCount.toString()}
                onChangeText={(v) => setCustomerCount(Math.max(2, parseInt(v) || 2))}
              />
              <Pressable
                className="w-10 h-10 rounded-lg bg-blue-600 items-center justify-center"
                onPress={() => setCustomerCount(customerCount + 1)}
              >
                <Text className="text-lg font-bold text-white">+</Text>
              </Pressable>
            </View>
            <View className="mt-3 bg-white rounded-lg p-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-blue-900">คนละ</Text>
                <Text className="text-lg font-bold text-blue-600">฿{splitPerPerson.toFixed(2)}</Text>
              </View>
            </View>

            {/* Paid splits history */}
            {paidSplits.length > 0 && (
              <View className="mt-3">
                {paidSplits.map((s, i) => (
                  <View key={i} className="flex-row justify-between py-1">
                    <Text className="text-xs text-blue-800">{s.label}</Text>
                    <Text className="text-xs text-green-700">฿{s.amount.toFixed(2)}</Text>
                  </View>
                ))}
                <View className="flex-row justify-between mt-2 pt-2 border-t border-blue-200">
                  <Text className="text-sm font-semibold text-blue-900">คงเหลือ</Text>
                  <Text className="text-sm font-bold text-red-600">฿{remaining.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Item selection */}
        {splitMode === 'items' && (
          <View className="p-4 bg-orange-50 border border-orange-200 rounded-xl mb-3">
            <Text className="text-sm font-semibold text-orange-900 mb-3">เลือกเมนูที่จะจ่าย</Text>
            {expandedUnits.map((unit, idx) => {
              const isPaid = paidUnitIndices.has(idx);
              const isSelected = selectedUnitIndices.has(idx);
              if (isPaid) {
                return (
                  <View
                    key={`unit-${idx}`}
                    className="flex-row items-center justify-between py-3 px-3 mb-1 rounded-xl bg-green-100 opacity-60"
                  >
                    <View className="flex-row items-center gap-2 flex-1">
                      <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                      <Text className="text-sm text-mekha-muted line-through">{unit.name}</Text>
                    </View>
                    <Text className="text-sm text-green-700 font-medium">จ่ายแล้ว</Text>
                  </View>
                );
              }
              return (
                <Pressable
                  key={`unit-${idx}`}
                  className={`flex-row items-center justify-between py-3 px-3 mb-1 rounded-xl ${
                    isSelected ? 'bg-orange-200' : 'bg-white'
                  }`}
                  onPress={() => {
                    const next = new Set(selectedUnitIndices);
                    if (isSelected) {
                      next.delete(idx);
                    } else {
                      next.add(idx);
                    }
                    setSelectedUnitIndices(next);
                  }}
                >
                  <View className="flex-row items-center gap-2 flex-1">
                    <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={20} color={isSelected ? '#EA580C' : '#9CA3AF'} />
                    <View className="flex-1">
                      <Text className="text-sm text-mekha-text">{unit.name}</Text>
                      {unit.options.length > 0 && (
                        <Text className="text-xs text-mekha-muted">
                          {unit.options.map((o) => o.itemName).join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text className="text-sm font-semibold text-mekha-text">฿{unit.unitTotal.toFixed(0)}</Text>
                </Pressable>
              );
            })}
            {selectedUnitIndices.size > 0 && (
              <View className="mt-3 bg-white rounded-lg p-3">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-orange-900">ยอดที่เลือก ({selectedUnitIndices.size} รายการ)</Text>
                  <Text className="text-lg font-bold text-orange-600">฿{selectedItemsTotal.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {/* Paid splits history */}
            {paidSplits.length > 0 && (
              <View className="mt-3">
                {paidSplits.map((s, i) => (
                  <View key={i} className="flex-row justify-between py-1">
                    <Text className="text-xs text-orange-800">{s.label}</Text>
                    <Text className="text-xs text-green-700">฿{s.amount.toFixed(2)}</Text>
                  </View>
                ))}
                <View className="flex-row justify-between mt-2 pt-2 border-t border-orange-200">
                  <Text className="text-sm font-semibold text-orange-900">คงเหลือ</Text>
                  <Text className="text-sm font-bold text-red-600">฿{remaining.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>
        )}
          </>
        )}
      </View>

      {/* Totals */}
      <View className={`border-t border-mekha-border pt-4 ${isLandscape ? '' : 'mt-4'}`}>
        <View className="flex-row justify-between mb-1">
          <Text className="text-mekha-muted">ยอดรวม</Text>
          <Text className="text-mekha-text">฿{subtotal.toFixed(2)}</Text>
        </View>
        {discountAmount > 0 && (
          <View className="flex-row justify-between mb-1">
            <Text className="text-mekha-muted">
              ส่วนลด{discount?.type === 'percent' ? ` ${discount.value}%` : ''}
            </Text>
            <Text className="text-red-700">-฿{discountAmount.toFixed(2)}</Text>
          </View>
        )}
        <View className="flex-row justify-between mb-1">
          <Text className="text-mekha-muted">VAT {vatRate}%{vatIncluded ? ' (รวม)' : ''}</Text>
          <Text className="text-mekha-text">฿{vatAmount.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mt-2 pt-2 border-t border-mekha-border">
          <Text className="text-lg font-bold text-mekha-text">ยอดชำระ</Text>
          <Text className="text-lg font-bold text-purple-600">฿{finalTotal.toFixed(2)}</Text>
        </View>
        {totalPaid > 0 && (
          <View className="flex-row justify-between mt-1">
            <Text className="text-sm text-green-700">จ่ายแล้ว</Text>
            <Text className="text-sm font-semibold text-green-700">฿{totalPaid.toFixed(2)}</Text>
          </View>
        )}
        {splitMode !== 'none' && remaining > 0 && remaining < finalTotal && (
          <View className="flex-row justify-between mt-1">
            <Text className="text-sm text-red-600 font-semibold">คงเหลือ</Text>
            <Text className="text-sm font-bold text-red-600">฿{remaining.toFixed(2)}</Text>
          </View>
        )}
      </View>

      <Text className="text-base font-semibold text-mekha-text mt-6 mb-4">
        เลือกวิธีชำระเงิน
      </Text>

      <Pressable
        className={`w-full py-4 rounded-2xl items-center border mb-3 ${
          items.length > 0 ? 'bg-green-50 border-green-700' : 'bg-gray-100 border-gray-300'
        }`}
        onPress={() => handlePayment('cash')}
        disabled={items.length === 0}
      >
        <Text className={`font-semibold ${items.length > 0 ? 'text-green-700' : 'text-gray-400'}`}>
          เงินสด
        </Text>
      </Pressable>

      <Pressable
        className={`w-full py-4 rounded-2xl items-center border mb-3 ${
          items.length > 0 ? 'bg-blue-50 border-blue-700' : 'bg-gray-100 border-gray-300'
        }`}
        onPress={() => handlePayment('promptpay')}
        disabled={items.length === 0}
      >
        <Text className={`font-semibold ${items.length > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
          PromptPay
        </Text>
      </Pressable>

      <Pressable
        className={`w-full py-4 rounded-2xl items-center border mb-3 ${
          items.length > 0 ? 'bg-yellow-50 border-yellow-700' : 'bg-gray-100 border-gray-300'
        }`}
        onPress={() => handlePayment('lightning')}
        disabled={items.length === 0}
      >
        <Text className={`font-semibold ${items.length > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>
          Lightning
        </Text>
      </Pressable>

      <Pressable className="items-center py-3" onPress={() => router.back()}>
        <Text className="text-mekha-muted">ยกเลิก</Text>
      </Pressable>
    </>
  );

  if (isLandscape) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 flex-row">
          <ScrollView className="flex-[2] px-6 pt-6 border-r border-mekha-border" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
            {itemListContent}
          </ScrollView>
          <ScrollView className="flex-[1] px-4 pt-6" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
            {paymentContent}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {itemListContent}
        {paymentContent}
      </ScrollView>
    </SafeAreaView>
  );
}
