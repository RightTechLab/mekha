import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import {
  getTodayRevenue,
  getPaymentMethodBreakdown,
  getTopMenuItems,
  getFilteredRevenue,
  getFilteredRevenueByDate,
} from '../../../src/db/repositories/transactionRepo';
import { exportTransactionsCsv } from '../../../src/lib/exportCsv';
import { getTransactions } from '../../../src/db/repositories/transactionRepo';
import { getBangkokDateKey } from '../../../src/lib/time';

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

const METHOD_LABELS: Record<string, string> = {
  cash: 'เงินสด',
  promptpay: 'PromptPay',
  lightning: 'Lightning',
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [selectedRange, setSelectedRange] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [breakdown, setBreakdown] = useState<{ method: string; total: number; count: number }[]>([]);
  const [topItems, setTopItems] = useState<{ menu_name: string; quantity: number; revenue: number }[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; total: number }[]>([]);
  const [maxDaily, setMaxDaily] = useState(0);

  const loadData = useCallback(() => {
    const today = getBangkokDateKey();
    setTodayRevenue(getTodayRevenue());

    const startDate = selectedRange === 0
      ? today
      : getBangkokDateKey(subDays(new Date(), selectedRange));

    const filtered = getFilteredRevenue(startDate, today, selectedMethod ?? undefined);
    setFilteredTotal(filtered.total);
    setFilteredCount(filtered.count);

    setBreakdown(getPaymentMethodBreakdown(startDate, today));
    setTopItems(getTopMenuItems(10, startDate, today, selectedMethod ?? undefined));

    if (selectedRange > 0) {
      const daily = getFilteredRevenueByDate(startDate, today, selectedMethod ?? undefined);
      setDailyRevenue(daily);
      setMaxDaily(Math.max(...daily.map((d) => d.total), 1));
    } else {
      setDailyRevenue([]);
      setMaxDaily(0);
    }
  }, [selectedRange, selectedMethod]);

  useFocusEffect(loadData);

  const handleExport = async () => {
    const transactions = getTransactions({ limit: 1000 });
    await exportTransactionsCsv(transactions);
  };

  const rangeLabel = DATE_RANGES.find((r) => r.days === selectedRange)?.label ?? '';
  const methodLabel = PAYMENT_FILTERS.find((f) => f.value === selectedMethod)?.label ?? 'ทั้งหมด';

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <Text className="text-2xl font-bold text-mekha-text mb-4">Dashboard</Text>

        {/* Date Range Filter */}
        <Text className="text-sm font-semibold text-mekha-text mb-2">ช่วงเวลา</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-2">
            {DATE_RANGES.map((range) => (
              <Pressable
                key={range.days}
                className={`px-4 py-2 rounded-full border ${
                  selectedRange === range.days
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-purple-50 border-purple-200'
                }`}
                onPress={() => setSelectedRange(range.days)}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedRange === range.days ? 'text-white' : 'text-purple-700'
                  }`}
                >
                  {range.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Payment Method Filter */}
        <Text className="text-sm font-semibold text-mekha-text mb-2">วิธีชำระ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {PAYMENT_FILTERS.map((filter) => (
              <Pressable
                key={filter.value ?? 'all'}
                className={`px-4 py-2 rounded-full border ${
                  selectedMethod === filter.value
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-purple-50 border-purple-200'
                }`}
                onPress={() => setSelectedMethod(filter.value)}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedMethod === filter.value ? 'text-white' : 'text-purple-700'
                  }`}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Revenue Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-purple-50 rounded-2xl p-4">
            <Text className="text-xs text-purple-700 mb-1">วันนี้</Text>
            <Text className="text-xl font-bold text-purple-600">
              ฿{todayRevenue.toLocaleString()}
            </Text>
          </View>
          <View className="flex-1 bg-purple-600 rounded-2xl p-4">
            <Text className="text-xs text-purple-200 mb-1">
              {rangeLabel} {selectedMethod ? `(${methodLabel})` : ''}
            </Text>
            <Text className="text-xl font-bold text-white">
              ฿{filteredTotal.toLocaleString()}
            </Text>
            <Text className="text-xs text-purple-200 mt-1">
              {filteredCount} รายการ
            </Text>
          </View>
        </View>

        {/* Average per transaction */}
        {filteredCount > 0 && (
          <View className="bg-blue-50 rounded-2xl p-4 mb-6">
            <View className="flex-row justify-between">
              <Text className="text-sm text-blue-900">ค่าเฉลี่ยต่อรายการ</Text>
              <Text className="text-lg font-bold text-blue-600">
                ฿{(filteredTotal / filteredCount).toFixed(0)}
              </Text>
            </View>
          </View>
        )}

        {/* Payment Method Breakdown */}
        <Text className="text-lg font-semibold text-mekha-text mb-3">
          สัดส่วนการชำระ ({rangeLabel})
        </Text>
        <View className="mb-6">
          {breakdown.length === 0 ? (
            <Text className="text-mekha-muted text-sm">ยังไม่มีข้อมูล</Text>
          ) : (
            breakdown.map((item) => {
              const total = breakdown.reduce((s, b) => s + b.total, 0);
              const pct = total > 0 ? (item.total / total) * 100 : 0;
              return (
                <Pressable
                  key={item.method}
                  className={`mb-2 p-3 rounded-xl ${
                    selectedMethod === item.method ? 'bg-purple-100 border border-purple-300' : ''
                  }`}
                  onPress={() =>
                    setSelectedMethod(selectedMethod === item.method ? null : item.method)
                  }
                >
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-sm text-mekha-text">
                      {METHOD_LABELS[item.method] ?? item.method} ({item.count})
                    </Text>
                    <Text className="text-sm font-semibold text-mekha-text">
                      ฿{item.total.toLocaleString()} ({pct.toFixed(0)}%)
                    </Text>
                  </View>
                  <View className="h-2 bg-purple-100 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-purple-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Top Items */}
        <Text className="text-lg font-semibold text-mekha-text mb-3">
          เมนูขายดี {selectedMethod ? `(${methodLabel})` : ''}
        </Text>
        <View className="mb-6">
          {topItems.length === 0 ? (
            <Text className="text-mekha-muted text-sm">ยังไม่มีข้อมูล</Text>
          ) : (
            topItems.map((item, idx) => (
              <View
                key={item.menu_name}
                className="flex-row items-center justify-between py-2 border-b border-mekha-border"
              >
                <View className="flex-row items-center gap-2 flex-1">
                  <View className={`w-6 h-6 rounded-full items-center justify-center ${
                    idx < 3 ? 'bg-purple-600' : 'bg-purple-100'
                  }`}>
                    <Text className={`text-xs font-bold ${idx < 3 ? 'text-white' : 'text-purple-700'}`}>
                      {idx + 1}
                    </Text>
                  </View>
                  <Text className="text-sm text-mekha-text flex-1">{item.menu_name}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-medium text-purple-600">
                    {item.quantity} ชิ้น
                  </Text>
                  <Text className="text-xs text-mekha-muted">
                    ฿{item.revenue?.toLocaleString() ?? 0}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Daily Revenue Chart */}
        {dailyRevenue.length > 0 && (
          <>
            <Text className="text-lg font-semibold text-mekha-text mb-3">
              ยอดขายรายวัน ({rangeLabel})
            </Text>
            <View className="mb-6">
              {dailyRevenue.map((day) => {
                const pct = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
                return (
                  <View key={day.date} className="flex-row items-center py-2 gap-3">
                    <Text className="text-xs text-mekha-muted w-12">
                      {`${day.date.substring(8, 10)}/${day.date.substring(5, 7)}`}
                    </Text>
                    <View className="flex-1 h-5 bg-purple-50 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </View>
                    <Text className="text-xs font-medium text-mekha-text w-16 text-right">
                      ฿{day.total.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Export */}
        <Pressable
          className="bg-purple-50 border border-purple-200 py-3 rounded-2xl items-center mb-8"
          onPress={handleExport}
        >
          <Text className="text-purple-700 font-medium">Export CSV</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
