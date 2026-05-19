# Mekha POS — Error Log & Fixes

## Error 1: NativeWind only supports Tailwind CSS v3

**When:** Metro config loading  
**Error:**
```
Error loading Metro config at: /Users/kritta/work/personal/Mekha/mekha/metro.config.js
NativeWind only supports Tailwind CSS v3
```

**Cause:** `tailwindcss@4.3.0` was installed but NativeWind v4 only supports Tailwind CSS v3.  
**Fix:** Downgrade tailwindcss:
```bash
npm install tailwindcss@3 --legacy-peer-deps
```

---

## Error 2: Cannot find module 'react-native-worklets/plugin'

**When:** Babel transform during iOS bundling  
**Error:**
```
[BABEL] index.ts: Cannot find module 'react-native-worklets/plugin'
Require stack:
- node_modules/react-native-reanimated/plugin/index.js
- node_modules/expo/node_modules/babel-preset-expo/build/index.js
```

**Cause:** `react-native-reanimated@4.x` (Expo SDK 54) requires `react-native-worklets` as a peer dependency that wasn't auto-installed.  
**Fix:**
```bash
npx expo install react-native-worklets
```

After installing, Metro's transformer cache still referenced the old state.  
**Additional fix:** Clear Metro cache:
```bash
npx expo start --clear
```

---

## Error 3: Metro still using stale cache after installing worklets

**When:** Running `npx expo start` after installing `react-native-worklets`  
**Error:** Same `Cannot find module 'react-native-worklets/plugin'` persisted  
**Cause:** The previous Metro process (pid 15908) was still running on port 8081 with the old module cache.  
**Fix:**
```bash
kill 15908
npx expo start --clear
```
This killed the stale process and started fresh with a clean Metro cache.

---

## Final Status: ✅ All Resolved

- Metro starts successfully on `exp://192.168.1.46:8081`
- iOS bundle compiled in 6416ms (2312 modules)
- No bundling errors

---

## Error 4: `csv-stringify` requires Node.js `Buffer` (not available in RN)

**When:** App runtime — dashboard screen loads  
**Error:**
```
[ReferenceError: Property 'Buffer' doesn't exist]
Code: exportCsv.ts > import { stringify } from 'csv-stringify/sync';
```
Also triggered: `Route "./(tabs)/dashboard/index.tsx" is missing the required default export` (because the crash prevents the module from exporting).

**Cause:** `csv-stringify` is a Node.js library that uses `Buffer` internally. React Native doesn't have `Buffer` in its JS runtime.  
**Fix:** Replaced `csv-stringify` with a simple manual CSV generator:
```ts
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
}
```
No external dependency needed — handles proper CSV escaping natively.

---

## Error 5: `split('T')` fails to extract date from `created_at`

**When:** Transaction filter — selecting date range shows 0 results  
**Date:** 12 พ.ค. 2569  
**Error:** No crash, but all transactions filtered out — list shows empty  
**Cause:** SQLite `datetime('now')` stores timestamps as `YYYY-MM-DD HH:MM:SS` (space separator), but code used `t.created_at.split('T')[0]` which expects ISO 8601 format with `T` separator. The split returned the full string instead of just the date portion, so date comparison always failed.  
**Fix:** Changed to `t.created_at.substring(0, 10)` which works regardless of separator:
```ts
// Before (broken):
const txnDate = t.created_at.split('T')[0];

// After (fixed):
const txnDate = t.created_at.substring(0, 10);
```

---

## Error 6: EAS CLI "Run this command inside a project directory"

**When:** Running `npx eas-cli build` from parent directory  
**Date:** 12 พ.ค. 2569  
**Error:**
```
Run this command inside a project directory.
Error: build command failed.
```
**Cause:** EAS CLI was invoked from `/Users/kritta/work/personal/Mekha/` (parent) instead of `/Users/kritta/work/personal/Mekha/mekha/` (project with `app.json`).  
**Fix:** `cd mekha` first, then run the build command:
```bash
cd mekha && npx eas-cli build --platform android --profile preview --non-interactive
```

---

## Features Added — 12 พ.ค. 2569

### Dashboard Revamp
- Added date range filter pills: วันนี้ / 7 วัน / 30 วัน / 90 วัน
- Added payment method filter pills: ทั้งหมด / เงินสด / PromptPay / Lightning
- Added filtered revenue card with transaction count
- Added average per transaction stat
- Added clickable payment breakdown bars (tap to filter by method)
- Added top 10 menu items with revenue amounts
- Added daily revenue bar chart
- New repo functions: `getFilteredRevenue()`, `getFilteredRevenueByDate()`
- Updated `getPaymentMethodBreakdown()` and `getTopMenuItems()` with date/method params

### Transaction Page Filters
- Added same date range and payment method filter pills
- Added summary bar showing count + total amount
- Fixed filter UI: reduced pill size (`py-1.5`, `text-xs`, no border) for cleaner look
