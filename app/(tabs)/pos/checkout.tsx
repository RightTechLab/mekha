import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Alert, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
import {
  cancelTransaction,
  completeTransaction,
  createTransaction,
  getNextSerial,
  updatePendingTransactionMethod,
} from '../../../src/db/repositories/transactionRepo';
import { getSetting } from '../../../src/db/repositories/transactionRepo';
import { setTableStatus, clearTable } from '../../../src/db/repositories/tableRepo';
import { generatePromptPayQR } from '../../../src/lib/promptpay';
import { getBtcRateThb, thbToSats } from '../../../src/lib/exchangeRate';
import { fetchLnurlPayParams, requestInvoice, createTimingLog, reportTimingLog, parseInvoiceExpiry, checkVerifyUrl, pollInvoice } from '../../../src/lib/lightning';
import { useLnurlCacheStore } from '../../../src/features/payment/lnurlCacheStore';
import NumPad from '../../../src/components/NumPad';
import type { PaymentMethod } from '../../../src/types';
import QRCode from 'react-native-qrcode-svg';

type CheckoutStep = 'summary' | 'payment' | 'cash' | 'promptpay' | 'lightning' | 'done';
type SplitMode = 'none' | 'equal' | 'items';
type SplitRecord = {
  label: string;
  amount: number;
  method: PaymentMethod;
  status: 'pending' | 'completed';
  amountSat: number | null;
  btcRate: number | null;
  invoice: string | null;
  verifyUrl: string | null;
  qrRef: string | null;
  serial: number | null;
  transactionId: string | null;
  unitIndices: number[];
};

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
  const [lnExpiry, setLnExpiry] = useState<number | null>(null); // epoch ms
  const [lnExpiryText, setLnExpiryText] = useState('');
  const [lnExpired, setLnExpired] = useState(false);
  const [lnVerifyUrl, setLnVerifyUrl] = useState<string | null>(null);
  const [lnAutoConfirmed, setLnAutoConfirmed] = useState(false);
  const [currentSerial, setCurrentSerial] = useState<number | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCleanupRef = useRef<(() => void) | null>(null);
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [customDiscountValue, setCustomDiscountValue] = useState('');
  const [customDiscountType, setCustomDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [customerCount, setCustomerCount] = useState(1);
  const [splitMode, setSplitMode] = useState<SplitMode>('none');
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [selectedUnitIndices, setSelectedUnitIndices] = useState<Set<number>>(new Set());
  const [paidUnitIndices, setPaidUnitIndices] = useState<Set<number>>(new Set());
  const [paidSplits, setPaidSplits] = useState<SplitRecord[]>([]);
  const [activePendingIndex, setActivePendingIndex] = useState<number | null>(null);
  const orderIdRef = useRef<string | null>(null);

  // Expiry countdown timer
  useEffect(() => {
    if (lnExpiry && !lnExpired) {
      const updateExpiry = () => {
        const remaining = lnExpiry - Date.now();
        if (remaining <= 0) {
          setLnExpiryText('');
          setLnExpired(true);
          if (expiryTimerRef.current) {
            clearInterval(expiryTimerRef.current);
            expiryTimerRef.current = null;
          }
        } else {
          setLnExpiryText(`หมดอายุใน ${formatCountdown(remaining)}`);
        }
      };
      updateExpiry();
      expiryTimerRef.current = setInterval(updateExpiry, 1000);
      return () => {
        if (expiryTimerRef.current) {
          clearInterval(expiryTimerRef.current);
          expiryTimerRef.current = null;
        }
      };
    }
  }, [lnExpiry, lnExpired]);

  // Cleanup poll on unmount or step change
  useEffect(() => {
    if (step !== 'lightning' && pollCleanupRef.current) {
      pollCleanupRef.current();
      pollCleanupRef.current = null;
    }
    return () => {
      if (pollCleanupRef.current) {
        pollCleanupRef.current();
        pollCleanupRef.current = null;
      }
    };
  }, [step]);

  const total = getTotal();
  const subtotal = getSubtotal();
  const vatRate = parseFloat(getSetting('vat_rate') ?? '7');
  const vatIncluded = getSetting('vat_mode') !== 'excluded';
  const serviceChargeRate = parseFloat(getSetting('service_charge_rate') ?? '0');
  const discountAmount = discount
    ? discount.type === 'percent'
      ? subtotal * (discount.value / 100)
      : discount.value
    : 0;
  const afterDiscount = subtotal - discountAmount;
  const serviceChargeAmount = serviceChargeRate > 0 ? afterDiscount * (serviceChargeRate / 100) : 0;
  const afterServiceCharge = afterDiscount + serviceChargeAmount;
  const vatAmount = vatIncluded
    ? afterServiceCharge - afterServiceCharge / (1 + vatRate / 100)
    : afterServiceCharge * (vatRate / 100);
  // finalTotal = amount the customer actually pays
  const finalTotal = vatIncluded ? afterServiceCharge : afterServiceCharge + vatAmount;

  // Split bill calculations
  const splitPerPerson = customerCount > 1 ? finalTotal / customerCount : finalTotal;
  const unitFinalMultiplier = subtotal > 0 ? finalTotal / subtotal : 1;

  // Expand items into individual units for split-by-items
  const expandedUnits = items.flatMap((item, itemIdx) =>
    Array.from({ length: item.quantity }, (_, unitIdx) => {
      const unitTotal = item.unitPrice + item.selectedOptions.reduce((s, o) => s + (o.priceDelta ?? 0), 0);
      return {
        itemIdx,
        unitIdx,
        name: item.name,
        unitPrice: item.unitPrice,
        optionsDelta: item.selectedOptions.reduce((s, o) => s + (o.priceDelta ?? 0), 0),
        unitTotal,
        unitPayTotal: unitTotal * unitFinalMultiplier,
        options: item.selectedOptions,
        note: item.note,
      };
    })
  );

  const selectedItemsTotal = Array.from(selectedUnitIndices).reduce(
    (sum, idx) => sum + (expandedUnits[idx]?.unitPayTotal ?? 0),
    0
  );
  const totalPaid = paidSplits.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.amount, 0);
  const totalPending = paidSplits.filter((s) => s.status === 'pending').reduce((sum, s) => sum + s.amount, 0);
  const totalAllocated = totalPaid + totalPending;
  const remaining = finalTotal - totalAllocated;
  const currentPayAmount =
    splitMode === 'equal'
      ? splitPerPerson
      : splitMode === 'items'
        ? selectedItemsTotal
        : finalTotal;
  const activePendingSplit = activePendingIndex != null ? paidSplits[activePendingIndex] : null;

  const getPayableAmount = () => {
    if (splitMode === 'none') return finalTotal;
    if (splitMode === 'equal') return Math.min(splitPerPerson, remaining);
    if (splitMode === 'items') return Math.min(selectedItemsTotal, remaining);
    return finalTotal;
  };

  const getSplitAdjustmentShare = (amount: number) => {
    const ratio = finalTotal > 0 ? amount / finalTotal : 0;
    return {
      discountAmount: discountAmount * ratio,
      serviceChargeAmount: serviceChargeAmount * ratio,
      vatAmount: vatAmount * ratio,
    };
  };

  const ensureOrder = () => {
    if (orderIdRef.current) return orderIdRef.current;

    const orderId = Crypto.randomUUID();
    orderIdRef.current = orderId;
    createOrder({ id: orderId, status: 'open', note: null, table_id: tableId });

    if (tableId) {
      setTableStatus(tableId, 'occupied', orderId);
    }

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

    return orderId;
  };

  const applySplitMode = (mode: SplitMode) => {
    setSplitMode(mode);
    setSelectedUnitIndices(new Set());
    setPaidUnitIndices(new Set());
    setPaidSplits([]);
    if (mode !== 'equal') setCustomerCount(1);
    if (mode === 'equal') setCustomerCount(2);
  };

  const getSplitLabel = (method: PaymentMethod) => {
    if (splitMode === 'equal') {
      return `คนที่ ${paidSplits.length + 1} (${method})`;
    }
    if (splitMode === 'items') {
      const selectedNames = Array.from(selectedUnitIndices).map((i) => expandedUnits[i]?.name).filter(Boolean);
      return `${selectedNames.join(', ')} (${method})`;
    }
    return `ชำระเต็มบิล (${method})`;
  };

  const markSelectedUnitsAllocated = () => {
    if (splitMode === 'items') {
      const newPaid = new Set(paidUnitIndices);
      selectedUnitIndices.forEach((idx) => newPaid.add(idx));
      setPaidUnitIndices(newPaid);
    }
    setSelectedUnitIndices(new Set());
  };

  const getSelectedUnitSnapshot = () => {
    if (splitMode !== 'items') return [];
    return Array.from(selectedUnitIndices);
  };

  const persistCompletedSplit = (orderId: string, split: SplitRecord) => {
    const share = getSplitAdjustmentShare(split.amount);
    createTransaction({
      id: Crypto.randomUUID(),
      order_id: orderId,
      payment_method: split.method,
      amount_thb: split.amount,
      amount_sat: split.amountSat,
      btc_rate_thb: split.btcRate,
      discount_amount: share.discountAmount,
      service_charge_amount: share.serviceChargeAmount,
      vat_amount: share.vatAmount,
      vat_included: vatIncluded ? 1 : 0,
      serial_number: split.serial,
      status: 'completed',
      lightning_invoice: split.invoice ?? (split.method === 'lightning' ? lnInvoice : null),
      lightning_verify_url: split.verifyUrl ?? (split.method === 'lightning' ? lnVerifyUrl : null),
      lightning_preimage: null,
      promptpay_ref: split.qrRef ?? (split.method === 'promptpay' ? qrData : null),
      cashier_id: role,
      void_reason: null,
    });
  };

  const closeOrderIfReady = useCallback(
    async (splits: SplitRecord[]) => {
      const hasPending = splits.some((split) => split.status === 'pending');
      const completedTotal = splits
        .filter((split) => split.status === 'completed')
        .reduce((sum, split) => sum + split.amount, 0);

      if (!hasPending && completedTotal >= finalTotal - 0.01) {
        const orderId = ensureOrder();
        for (const split of splits) {
          if (split.status === 'completed' && !split.transactionId) {
            persistCompletedSplit(orderId, split);
          }
        }
        updateOrderStatus(orderId, 'paid');
        if (tableId) {
          clearTable(tableId);
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        clear();
        router.back();
        return true;
      }

      return false;
    },
    [finalTotal, tableId, clear, vatIncluded, lnInvoice, lnVerifyUrl, qrData, role]
  );

  const handleSplitModeChange = (mode: SplitMode) => {
    if (mode === splitMode) return;
    if (paidSplits.length > 0) {
      Alert.alert(
        'เปลี่ยนวิธีแบ่งจ่าย?',
        'มีรายการที่จ่ายแล้วอยู่ ถ้าเปลี่ยนวิธีแบ่งจ่าย รายการจ่ายบางส่วนจะถูกล้าง',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          { text: 'เปลี่ยนและล้างรายการ', style: 'destructive', onPress: () => applySplitMode(mode) },
        ]
      );
      return;
    }
    applySplitMode(mode);
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
        setCurrentSerial(null);
        setStep('cash');
      } else if (method === 'promptpay') {
        const promptpayId = await SecureStore.getItemAsync('mekha.promptpay_id');
        if (!promptpayId) {
          Alert.alert('ยังไม่ได้ตั้งค่า', 'กรุณาตั้งค่า PromptPay ID ในหน้าตั้งค่าก่อน');
          return;
        }
        const serial = getNextSerial();
        setCurrentSerial(serial);
        const qr = generatePromptPayQR(promptpayId, payAmount);
        setQrData(qr);
        setStep('promptpay');
      } else if (method === 'lightning') {
        setLnLoading(true);
        setLnError('');
        setLnExpired(false);
        setLnExpiry(null);
        setLnExpiryText('');
        setLnVerifyUrl(null);
        setLnAutoConfirmed(false);
        if (pollCleanupRef.current) {
          pollCleanupRef.current();
          pollCleanupRef.current = null;
        }
        setStep('lightning');
        const serial = getNextSerial();
        setCurrentSerial(serial);
        const timing = createTimingLog();
        try {
          const lnAddress = await SecureStore.getItemAsync('mekha.ln_address');
          if (!lnAddress) {
            setLnError('ยังไม่ได้ตั้งค่า Lightning Address ในตั้งค่า');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setLnLoading(false);
            return;
          }
          const rate = await getBtcRateThb();
          const amountSat = thbToSats(payAmount, rate);
          const amountMsat = amountSat * 1000;
          setLnRate(rate);
          setLnAmountSat(amountSat);

          timing.t1_startFetchLnurl = Date.now();

          // Use LNURL cache for faster invoice creation
          const { requestInvoiceWithCache, cache } = useLnurlCacheStore.getState();

          // Validate amount against cached min/max if available
          if (cache && (Date.now() - cache.fetchedAt < 3600000)) {
            if (amountMsat < cache.minSendable || amountMsat > cache.maxSendable) {
              setLnError(`จำนวนเงินไม่อยู่ในช่วงที่รองรับ (${cache.minSendable / 1000}-${cache.maxSendable / 1000} sats)`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setLnLoading(false);
              return;
            }
          }

          timing.t3_startFetchInvoice = Date.now();
          const invoiceResult = await requestInvoiceWithCache(amountMsat, lnAddress);
          timing.t4_gotInvoice = Date.now();

          setLnInvoice(invoiceResult.pr);
          setLnVerifyUrl(invoiceResult.verify);
          setLnAutoConfirmed(false);

          // Parse expiry from invoice
          const expiryMs = parseInvoiceExpiry(invoiceResult.pr);
          if (expiryMs) {
            setLnExpiry(expiryMs);
          }

          // Start polling verify URL if available
          if (invoiceResult.verify) {
            // Clean up any existing poll
            const existingPollCleanup = pollCleanupRef.current as (() => void) | null;
            if (typeof existingPollCleanup === 'function') {
              existingPollCleanup();
            }
            const cleanup = pollInvoice(
              () => checkVerifyUrl(invoiceResult.verify!),
              () => {
                setLnAutoConfirmed(true);
              },
              () => {
                // expired via poll timeout — handled by expiry timer already
              },
              expiryMs ? expiryMs - Date.now() : 600_000
            );
            pollCleanupRef.current = cleanup;
          }

          timing.t5_qrRendered = Date.now();
          reportTimingLog(timing);
        } catch (e: any) {
          setLnError(e?.message ?? 'ไม่สามารถสร้าง Invoice ได้');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      const label = getSplitLabel(method);
      const newSplits = [...paidSplits, {
        label,
        amount: payAmount,
        method,
        status: 'completed' as const,
        amountSat: extra?.amountSat ?? null,
        btcRate: extra?.btcRate ?? null,
        invoice: method === 'lightning' ? lnInvoice : null,
        verifyUrl: method === 'lightning' ? lnVerifyUrl : null,
        qrRef: method === 'promptpay' ? qrData : null,
        serial: method === 'cash' ? null : currentSerial,
        transactionId: null,
        unitIndices: getSelectedUnitSnapshot(),
      }];
      setPaidSplits(newSplits);

      markSelectedUnitsAllocated();

      const newTotalCompleted = newSplits
        .filter((s) => s.status === 'completed')
        .reduce((sum, s) => sum + s.amount, 0);
      if (newTotalCompleted >= finalTotal - 0.01) {
        completeOrder(method, undefined, newSplits);
      } else {
        setStep('summary');
      }
    },
    [splitMode, paidSplits, selectedUnitIndices, expandedUnits, paidUnitIndices, finalTotal, lnInvoice, lnVerifyUrl, qrData, currentSerial]
  );

  const recordPendingPayment = useCallback(
    async (method: PaymentMethod, extra?: { amountSat?: number; btcRate?: number }) => {
      const payAmount = getPayableAmount();
      const orderId = ensureOrder();
      const share = getSplitAdjustmentShare(payAmount);
      const transactionId = Crypto.randomUUID();
      const pending: SplitRecord = {
        label: getSplitLabel(method),
        amount: payAmount,
        method,
        status: 'pending',
        amountSat: extra?.amountSat ?? null,
        btcRate: extra?.btcRate ?? null,
        invoice: method === 'lightning' ? lnInvoice : null,
        verifyUrl: method === 'lightning' ? lnVerifyUrl : null,
        qrRef: method === 'promptpay' ? qrData : null,
        serial: method === 'cash' ? null : currentSerial,
        transactionId,
        unitIndices: getSelectedUnitSnapshot(),
      };

      createTransaction({
        id: transactionId,
        order_id: orderId,
        payment_method: method,
        amount_thb: payAmount,
        amount_sat: pending.amountSat,
        btc_rate_thb: pending.btcRate,
        discount_amount: share.discountAmount,
        service_charge_amount: share.serviceChargeAmount,
        vat_amount: share.vatAmount,
        vat_included: vatIncluded ? 1 : 0,
        serial_number: pending.serial,
        status: 'pending',
        lightning_invoice: pending.invoice,
        lightning_verify_url: pending.verifyUrl,
        lightning_preimage: null,
        promptpay_ref: pending.qrRef,
        cashier_id: role,
        void_reason: null,
      });

      const newSplits = [...paidSplits, pending];
      setPaidSplits(newSplits);
      markSelectedUnitsAllocated();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newAllocated = newSplits.reduce((sum, s) => sum + s.amount, 0);
      if (newAllocated >= finalTotal - 0.01) {
        setStep('summary');
      } else {
        setStep('summary');
      }
    },
    [paidSplits, splitMode, selectedUnitIndices, expandedUnits, paidUnitIndices, finalTotal, lnInvoice, lnVerifyUrl, qrData, currentSerial, vatIncluded, role, clear]
  );

  const completeOrder = useCallback(
    async (method: PaymentMethod, extra?: { amountSat?: number; btcRate?: number }, splitsOverride?: typeof paidSplits) => {
      const orderId = ensureOrder();
      const splits = splitsOverride ?? paidSplits;

      if (splits.length > 0) {
        // Split bill — create transaction per split
        for (const split of splits) {
          if (split.status === 'pending' || split.transactionId) continue;
          persistCompletedSplit(orderId, split);
        }
        // Last split (current payment) — only if remaining after all recorded splits
        const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
        const leftover = finalTotal - splitTotal;
        if (leftover > 0.01) {
          const share = getSplitAdjustmentShare(leftover);
          createTransaction({
            id: Crypto.randomUUID(),
            order_id: orderId,
            payment_method: method,
            amount_thb: leftover,
            amount_sat: extra?.amountSat ?? null,
            btc_rate_thb: extra?.btcRate ?? null,
            discount_amount: share.discountAmount,
            service_charge_amount: share.serviceChargeAmount,
            vat_amount: share.vatAmount,
            vat_included: vatIncluded ? 1 : 0,
            serial_number: method === 'cash' ? null : currentSerial,
            status: 'completed',
            lightning_invoice: method === 'lightning' ? lnInvoice : null,
            lightning_verify_url: method === 'lightning' ? lnVerifyUrl : null,
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
          service_charge_amount: serviceChargeAmount,
          vat_amount: vatAmount,
          vat_included: vatIncluded ? 1 : 0,
          serial_number: method === 'cash' ? null : currentSerial,
          status: 'completed',
          lightning_invoice: method === 'lightning' ? lnInvoice : null,
          lightning_verify_url: method === 'lightning' ? lnVerifyUrl : null,
          lightning_preimage: null,
          promptpay_ref: method === 'promptpay' ? qrData : null,
          cashier_id: role,
          void_reason: null,
        });
      }

      const hasPending = splits.some((split) => split.status === 'pending');
      if (!hasPending) {
        updateOrderStatus(orderId, 'paid');
        if (tableId) {
          clearTable(tableId);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (hasPending) {
        setStep('summary');
      } else {
        clear();
        router.back();
      }
    },
    [items, finalTotal, discountAmount, serviceChargeAmount, vatAmount, vatIncluded, role, clear, paidSplits, remaining, tableId, lnInvoice, qrData, currentSerial]
  );

  const confirmPendingSplit = useCallback(
    async (index: number) => {
      const target = paidSplits[index];
      if (!target || target.status !== 'pending') return;

      if (target.transactionId) {
        completeTransaction(target.transactionId);
      }

      const nextSplits = paidSplits.map((split, i) =>
        i === index ? { ...split, status: 'completed' as const } : split
      );
      setPaidSplits(nextSplits);
      setActivePendingIndex(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const closed = await closeOrderIfReady(nextSplits);
      if (!closed) {
        setStep('summary');
      }
    },
    [paidSplits, closeOrderIfReady]
  );

  const cancelPendingSplit = useCallback(
    (index: number) => {
      const target = paidSplits[index];
      if (!target || target.status !== 'pending') return;

      Alert.alert('ยกเลิกรายการรอชำระ', `ต้องการยกเลิก ${target.label} หรือไม่?`, [
        { text: 'ไม่ยกเลิก', style: 'cancel' },
        {
          text: 'ยกเลิกรายการ',
          style: 'destructive',
          onPress: () => {
            if (target.transactionId) {
              cancelTransaction(target.transactionId, 'cancelled from checkout');
            }
            const nextSplits = paidSplits.filter((_, i) => i !== index);
            setPaidSplits(nextSplits);
            if (splitMode === 'items') {
              const nextPaid = new Set(paidUnitIndices);
              target.unitIndices.forEach((unitIndex) => nextPaid.delete(unitIndex));
              setPaidUnitIndices(nextPaid);
            }
            setActivePendingIndex(null);
            setStep('summary');
          },
        },
      ]);
    },
    [paidSplits, splitMode, paidUnitIndices]
  );

  const openPendingSplit = useCallback(
    (index: number) => {
      const target = paidSplits[index];
      if (!target || target.status !== 'pending') return;

      setActivePendingIndex(index);
      setCurrentSerial(target.serial);
      setQrData(target.qrRef ?? '');
      setLnInvoice(target.invoice ?? '');
      setLnVerifyUrl(target.verifyUrl);
      setLnAmountSat(target.amountSat ?? 0);
      setLnRate(target.btcRate ?? 0);
      setLnAutoConfirmed(false);

      if (target.method === 'promptpay') {
        setStep('promptpay');
      } else if (target.method === 'lightning') {
        const expiryMs = target.invoice ? parseInvoiceExpiry(target.invoice) : null;
        setLnExpiry(expiryMs);
        setLnExpired(expiryMs ? Date.now() >= expiryMs : false);
        setLnLoading(false);
        setLnError('');
        if (pollCleanupRef.current) {
          pollCleanupRef.current();
          pollCleanupRef.current = null;
        }
        if (target.verifyUrl && (!expiryMs || Date.now() < expiryMs)) {
          pollCleanupRef.current = pollInvoice(
            () => checkVerifyUrl(target.verifyUrl!),
            () => {
              setLnAutoConfirmed(true);
            },
            () => {},
            expiryMs ? expiryMs - Date.now() : 600_000
          );
        }
        setStep('lightning');
      }
    },
    [paidSplits]
  );

  const switchPendingSplitMethod = useCallback(
    async (index: number, method: PaymentMethod) => {
      const target = paidSplits[index];
      if (!target || target.status !== 'pending' || method === target.method || !target.transactionId) return;

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (method === 'cash') {
          updatePendingTransactionMethod(target.transactionId, {
            paymentMethod: 'cash',
            amountSat: null,
            btcRateThb: null,
            lightningInvoice: null,
            lightningVerifyUrl: null,
            promptpayRef: null,
            serialNumber: null,
          });
          setPaidSplits((splits) => splits.map((split, i) =>
            i === index
              ? { ...split, method: 'cash', amountSat: null, btcRate: null, invoice: null, verifyUrl: null, qrRef: null, serial: null }
              : split
          ));
          setStep('summary');
          return;
        }

        const serial = getNextSerial();
        if (method === 'promptpay') {
          const promptpayId = await SecureStore.getItemAsync('mekha.promptpay_id');
          if (!promptpayId) {
            Alert.alert('ยังไม่ได้ตั้งค่า', 'กรุณาตั้งค่า PromptPay ID ในหน้าตั้งค่าก่อน');
            return;
          }
          const qr = generatePromptPayQR(promptpayId, target.amount);
          updatePendingTransactionMethod(target.transactionId, {
            paymentMethod: 'promptpay',
            amountSat: null,
            btcRateThb: null,
            lightningInvoice: null,
            lightningVerifyUrl: null,
            promptpayRef: qr,
            serialNumber: serial,
          });
          setPaidSplits((splits) => splits.map((split, i) =>
            i === index
              ? { ...split, method: 'promptpay', amountSat: null, btcRate: null, invoice: null, verifyUrl: null, qrRef: qr, serial }
              : split
          ));
          setActivePendingIndex(index);
          setCurrentSerial(serial);
          setQrData(qr);
          setStep('promptpay');
          return;
        }

        const lnAddress = await SecureStore.getItemAsync('mekha.ln_address');
        if (!lnAddress) {
          Alert.alert('ยังไม่ได้ตั้งค่า', 'กรุณาตั้งค่า Lightning Address ในหน้าตั้งค่าก่อน');
          return;
        }
        const rate = await getBtcRateThb();
        const amountSat = thbToSats(target.amount, rate);
        const invoiceResult = await useLnurlCacheStore.getState().requestInvoiceWithCache(amountSat * 1000, lnAddress);
        updatePendingTransactionMethod(target.transactionId, {
          paymentMethod: 'lightning',
          amountSat,
          btcRateThb: rate,
          lightningInvoice: invoiceResult.pr,
          lightningVerifyUrl: invoiceResult.verify,
          promptpayRef: null,
          serialNumber: serial,
        });
        setPaidSplits((splits) => splits.map((split, i) =>
          i === index
            ? {
                ...split,
                method: 'lightning',
                amountSat,
                btcRate: rate,
                invoice: invoiceResult.pr,
                verifyUrl: invoiceResult.verify,
                qrRef: null,
                serial,
              }
            : split
        ));
        setActivePendingIndex(index);
        setCurrentSerial(serial);
        setLnInvoice(invoiceResult.pr);
        setLnVerifyUrl(invoiceResult.verify);
        setLnAmountSat(amountSat);
        setLnRate(rate);
        setLnExpiry(parseInvoiceExpiry(invoiceResult.pr));
        setLnExpired(false);
        setLnLoading(false);
        setLnError('');
        setStep('lightning');
      } catch (e: any) {
        Alert.alert('ผิดพลาด', e?.message ?? 'ไม่สามารถเปลี่ยนวิธีชำระได้');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [paidSplits]
  );

  const promptSwitchPendingMethod = useCallback(
    (index: number) => {
      const target = paidSplits[index];
      if (!target || target.status !== 'pending') return;

      Alert.alert('เปลี่ยนวิธีชำระ', target.label, [
        { text: 'เงินสด', onPress: () => switchPendingSplitMethod(index, 'cash') },
        { text: 'PromptPay', onPress: () => switchPendingSplitMethod(index, 'promptpay') },
        { text: 'Lightning', onPress: () => switchPendingSplitMethod(index, 'lightning') },
        { text: 'ยกเลิก', style: 'cancel' },
      ]);
    },
    [paidSplits, switchPendingSplitMethod]
  );

  // Auto-confirm Lightning payment when verify URL reports settled
  useEffect(() => {
    if (lnAutoConfirmed && lnInvoice) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (activePendingIndex != null) {
        confirmPendingSplit(activePendingIndex);
      } else if (splitMode !== 'none') {
        recordSplitPayment('lightning', { amountSat: lnAmountSat, btcRate: lnRate });
      } else {
        completeOrder('lightning', { amountSat: lnAmountSat, btcRate: lnRate });
      }
    }
  }, [lnAutoConfirmed]);

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
    const payAmount = activePendingSplit ? activePendingSplit.amount : splitMode !== 'none' ? getPayableAmount() : finalTotal;
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-xl font-bold text-mekha-text mb-2">PromptPay</Text>
        {currentSerial && (
          <Text className="text-sm text-mekha-muted mb-1">#{String(currentSerial).padStart(4, '0')}</Text>
        )}
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
            if (activePendingIndex != null) {
              confirmPendingSplit(activePendingIndex);
            } else if (splitMode !== 'none') {
              recordSplitPayment('promptpay');
            } else {
              completeOrder('promptpay');
            }
          }}
        >
          <Text className="text-white font-semibold">ยืนยันรับเงิน</Text>
        </Pressable>

        {activePendingIndex == null ? (
          <Pressable
            className="mt-3 w-full py-4 rounded-2xl items-center bg-purple-50 border border-purple-200"
            onPress={() => recordPendingPayment('promptpay')}
          >
            <Text className="text-purple-700 font-semibold">
              พักไว้ / ไปคิดคนถัดไป
            </Text>
          </Pressable>
        ) : null}

        <Pressable className="mt-3 items-center" onPress={() => {
          setActivePendingIndex(null);
          setStep('summary');
        }}>
          <Text className="text-mekha-muted">
            {activePendingIndex == null ? 'ย้อนกลับโดยไม่บันทึก' : 'กลับไปสรุป'}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'lightning') {
    const payAmount = activePendingSplit ? activePendingSplit.amount : splitMode !== 'none' ? getPayableAmount() : finalTotal;
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-xl font-bold text-mekha-text mb-2">Lightning</Text>
        {currentSerial && (
          <Text className="text-sm text-mekha-muted mb-1">#{String(currentSerial).padStart(4, '0')}</Text>
        )}
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

        {lnExpired && !lnLoading ? (
          <View className="items-center w-full">
            <View className="bg-red-50 rounded-2xl px-5 py-6 mb-6 w-full items-center">
              <Ionicons name="time-outline" size={40} color="#DC2626" />
              <Text className="text-red-700 font-semibold text-lg mt-3">Invoice หมดอายุแล้ว</Text>
              <Text className="text-red-600 text-sm mt-1">กรุณาสร้าง Invoice ใหม่</Text>
            </View>
            <Pressable
              className="w-full py-4 rounded-2xl items-center bg-purple-600 mb-3"
              onPress={() => handlePayment('lightning')}
            >
              <Text className="text-white font-semibold">สร้าง Invoice ใหม่</Text>
            </Pressable>
          </View>
        ) : lnInvoice && !lnLoading ? (
          <>
            <Pressable
              className="bg-white p-4 rounded-2xl border border-mekha-border mb-4"
              onPress={() => {
                Clipboard.setStringAsync(lnInvoice);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('คัดลอกแล้ว', 'Invoice ถูกคัดลอกเรียบร้อย');
              }}
            >
              <QRCode value={lnInvoice} size={220} />
            </Pressable>
            {lnExpiryText ? (
              <View className="bg-amber-50 rounded-xl px-4 py-2 mb-4">
                <Text className="text-amber-700 text-sm font-medium text-center">{lnExpiryText}</Text>
              </View>
            ) : null}
            {lnVerifyUrl ? (
              <View className="flex-row items-center gap-2 mb-4">
                <ActivityIndicator size="small" color="#7C3AED" />
                <Text className="text-purple-700 text-sm font-medium">รอการยืนยันอัตโนมัติ...</Text>
              </View>
            ) : (
              <Text className="text-mekha-muted text-center text-sm mb-4">
                ลูกค้าสแกน QR เพื่อชำระ
              </Text>
            )}
            <Pressable
              className="w-full py-4 rounded-2xl items-center bg-purple-600"
              onPress={() => {
                if (activePendingIndex != null) {
                  confirmPendingSplit(activePendingIndex);
                } else if (splitMode !== 'none') {
                  recordSplitPayment('lightning', { amountSat: lnAmountSat, btcRate: lnRate });
                } else {
                  completeOrder('lightning', { amountSat: lnAmountSat, btcRate: lnRate });
                }
              }}
            >
              <Text className="text-white font-semibold">ยืนยันรับเงิน</Text>
            </Pressable>
            {activePendingIndex == null ? (
              <Pressable
                className="mt-3 w-full py-4 rounded-2xl items-center bg-purple-50 border border-purple-200"
                onPress={() => recordPendingPayment('lightning', { amountSat: lnAmountSat, btcRate: lnRate })}
              >
                <Text className="text-purple-700 font-semibold">
                  พักไว้ / ไปคิดคนถัดไป
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        <Pressable className="mt-3 items-center" onPress={() => {
          setActivePendingIndex(null);
          setStep('summary');
        }}>
          <Text className="text-mekha-muted">
            {activePendingIndex == null ? 'ย้อนกลับโดยไม่บันทึก' : 'กลับไปสรุป'}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Summary & payment method selection
  const isLandscape = width > height;
  const renderSplitHistory = (tone: 'blue' | 'orange') => (
    <View className="mt-3">
      {paidSplits.map((s, i) => (
        <View key={`${s.transactionId ?? s.label}-${i}`} className={`py-2 border-t ${tone === 'blue' ? 'border-blue-100' : 'border-orange-100'}`}>
          <View className="flex-row justify-between gap-2">
            <Text className={`text-xs flex-1 ${tone === 'blue' ? 'text-blue-800' : 'text-orange-800'}`}>{s.label}</Text>
            <Text className={`text-xs ${s.status === 'pending' ? 'text-amber-700' : 'text-green-700'}`}>
              {s.status === 'pending' ? 'รอชำระ ' : ''}฿{s.amount.toFixed(2)}
            </Text>
          </View>
          {s.status === 'pending' && (
            <View className="flex-row flex-wrap gap-2 mt-2">
              {s.method !== 'cash' && (
                <Pressable
                  className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200"
                  onPress={() => openPendingSplit(i)}
                >
                  <Text className="text-xs font-medium text-purple-700">แสดง QR</Text>
                </Pressable>
              )}
              <Pressable
                className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-200"
                onPress={() => confirmPendingSplit(i)}
              >
                <Text className="text-xs font-medium text-green-700">ยืนยัน</Text>
              </Pressable>
              <Pressable
                className="px-3 py-1.5 rounded-lg bg-white border border-mekha-border"
                onPress={() => promptSwitchPendingMethod(i)}
              >
                <Text className="text-xs font-medium text-purple-700">เปลี่ยนวิธี</Text>
              </Pressable>
              <Pressable
                className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200"
                onPress={() => cancelPendingSplit(i)}
              >
                <Text className="text-xs font-medium text-red-700">ยกเลิก</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
      <View className={`flex-row justify-between mt-2 pt-2 border-t ${tone === 'blue' ? 'border-blue-200' : 'border-orange-200'}`}>
        <Text className={`text-sm font-semibold ${tone === 'blue' ? 'text-blue-900' : 'text-orange-900'}`}>คงเหลือ</Text>
        <Text className="text-sm font-bold text-red-600">฿{remaining.toFixed(2)}</Text>
      </View>
    </View>
  );

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
                handleSplitModeChange(mode);
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
              renderSplitHistory('blue')
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
                  <Text className="text-sm font-semibold text-mekha-text">฿{unit.unitPayTotal.toFixed(2)}</Text>
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
              renderSplitHistory('orange')
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
        {serviceChargeAmount > 0 && (
          <View className="flex-row justify-between mb-1">
            <Text className="text-mekha-muted">Service Charge {serviceChargeRate}%</Text>
            <Text className="text-mekha-text">฿{serviceChargeAmount.toFixed(2)}</Text>
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
        {totalPending > 0 && (
          <View className="flex-row justify-between mt-1">
            <Text className="text-sm text-amber-700 font-semibold">รอชำระ</Text>
            <Text className="text-sm font-semibold text-amber-700">฿{totalPending.toFixed(2)}</Text>
          </View>
        )}
        {splitMode !== 'none' && remaining > 0 && remaining < finalTotal && (
          <View className="flex-row justify-between mt-1">
            <Text className="text-sm text-red-600 font-semibold">คงเหลือ</Text>
            <Text className="text-sm font-bold text-red-600">฿{remaining.toFixed(2)}</Text>
          </View>
        )}
        {totalPending > 0 && remaining <= 0 && (
          <View className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Text className="text-xs text-amber-700 text-center">
              ยังมีรายการรอชำระ กดยืนยันหรือเปลี่ยนวิธีจากรายการด้านบนก่อนปิดบิล
            </Text>
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
