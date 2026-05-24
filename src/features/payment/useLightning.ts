import { useState, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { getBtcRateThb, thbToSats } from '../../lib/exchangeRate';
import { fetchLnurlPayParams, requestInvoice, pollInvoice } from '../../lib/lightning';

interface UseLightningResult {
  invoice: string;
  loading: boolean;
  error: string;
  amountSat: number;
  rate: number;
  createInvoice: (amountThb: number) => Promise<boolean>;
  reset: () => void;
  settled: boolean;
}

export function useLightning(): UseLightningResult {
  const [invoice, setInvoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amountSat, setAmountSat] = useState(0);
  const [rate, setRate] = useState(0);
  const [settled, setSettled] = useState(false);
  const stopPollingRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    if (stopPollingRef.current) {
      stopPollingRef.current();
      stopPollingRef.current = null;
    }
    setInvoice('');
    setLoading(false);
    setError('');
    setAmountSat(0);
    setRate(0);
    setSettled(false);
  }, []);

  const createInvoice = useCallback(async (amountThb: number): Promise<boolean> => {
    setLoading(true);
    setError('');
    setSettled(false);

    try {
      const lnAddress = await SecureStore.getItemAsync('mekha.ln_address');
      if (!lnAddress) {
        setError('ยังไม่ได้ตั้งค่า Lightning Address ในตั้งค่า');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
        return false;
      }

      const btcRate = await getBtcRateThb();
      const sats = thbToSats(amountThb, btcRate);
      const amountMsat = sats * 1000;
      setRate(btcRate);
      setAmountSat(sats);

      const params = await fetchLnurlPayParams(lnAddress);

      if (amountMsat < params.minSendable || amountMsat > params.maxSendable) {
        setError(
          `จำนวนเงินไม่อยู่ในช่วงที่รองรับ (${params.minSendable / 1000}-${params.maxSendable / 1000} sats)`
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
        return false;
      }

      const inv = await requestInvoice(params.callback, amountMsat);
      setInvoice(inv);
      setLoading(false);
      return true;
    } catch (e: any) {
      setError(e?.message ?? 'ไม่สามารถสร้าง Invoice ได้');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
      return false;
    }
  }, []);

  return {
    invoice,
    loading,
    error,
    amountSat,
    rate,
    createInvoice,
    reset,
    settled,
  };
}
