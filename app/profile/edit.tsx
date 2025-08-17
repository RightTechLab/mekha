// EditContact.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { useProfileSecureStore } from "./profileStore";

type Form = { name: string; phone: string; lineId: string };

export default function EditContact() {
  // ดึงค่าปัจจุบันจาก store
  const { profileName, phoneNumber, lineId, setProfile, hasHydrated } =
    useProfileSecureStore();
  useEffect(() => {
    if (hasHydrated) {
      setForm({
        name: profileName ?? "",
        phone: phoneNumber ?? "",
        lineId: lineId ?? "",
      });
    }
  }, [hasHydrated, profileName, phoneNumber, lineId]);

  // local form สำหรับแก้ไข/ตรวจสอบ
  const [form, setForm] = useState<Form>({
    name: profileName ?? "",
    phone: phoneNumber ?? "",
    lineId: lineId ?? "",
  });
  const [touched, setTouched] = useState<{
    name: boolean;
    phone: boolean;
    lineId: boolean;
  }>({
    name: false,
    phone: false,
    lineId: false,
  });

  const initial = useRef(form);
  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.values(errors).every((e) => !e);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial.current);

  const onSave = () => {
    if (!isValid) return;
    // เซฟกลับเข้า Zustand ทีเดียว
    setProfile({
      profileName: form.name.trim(),
      phoneNumber: form.phone.trim(),
      lineId: form.lineId.trim(),
    });
    initial.current = form; // reset dirty state
  };

  return (
    <SafeAreaView style={styles.screen}>

      <View style={styles.form}>
        {/* ชื่อ */}
        <View style={styles.field}>
          <Text style={styles.label}>
            ชื่อ <Text style={styles.req}>*จำเป็น</Text>
          </Text>
          <TextInput
            value={form.name}
            onChangeText={(v: string) => setForm((s) => ({ ...s, name: v }))}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            style={[
              styles.input,
              touched.name && errors.name ? styles.inputError : null,
            ]}
            placeholder="กรอกชื่อ"
            placeholderTextColor="#A3A3A3"
          />
          {touched.name && !!errors.name && (
            <Text style={styles.error}>{errors.name}</Text>
          )}
        </View>

        {/* โทรศัพท์ */}
        <View style={styles.field}>
          <Text style={styles.label}>
            โทรศัพท์ <Text style={styles.req}>*จำเป็น</Text>
          </Text>
          <TextInput
            value={form.phone}
            onChangeText={(v: string) =>
              setForm((s) => ({ ...s, phone: formatPhone(v) }))
            }
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            keyboardType="phone-pad"
            style={[
              styles.input,
              touched.phone && errors.phone ? styles.inputError : null,
            ]}
            placeholder="เช่น 089 123 4567"
            placeholderTextColor="#A3A3A3"
          />
          {touched.phone && !!errors.phone && (
            <Text style={styles.error}>{errors.phone}</Text>
          )}
        </View>

        {/* Line ID */}
        <View style={styles.field}>
          <Text style={styles.label}>Line ID</Text>
          <TextInput
            value={form.lineId}
            onChangeText={(v: string) => setForm((s) => ({ ...s, lineId: v }))}
            onBlur={() => setTouched((t) => ({ ...t, lineId: true }))}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              touched.lineId && errors.lineId ? styles.inputError : null,
            ]}
            placeholder="ตัวอย่าง: khingza_888"
            placeholderTextColor="#A3A3A3"
          />
          {touched.lineId && !!errors.lineId && (
            <Text style={styles.error}>{errors.lineId}</Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            onSave();
            router.back();
          }}
          disabled={!isDirty || !isValid}
          style={({ pressed }) => [
            styles.button,
            (!isDirty || !isValid) && styles.buttonDisabled,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.buttonText}>บันทึกการเปลี่ยนแปลง</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ---- validate & helpers ---- */
function validate(f: Form) {
  const errs: Record<keyof Form, string> = { name: "", phone: "", lineId: "" };

  if (!f.name.trim()) errs.name = "กรุณากรอกชื่อ";
  else if (f.name.trim().length < 2)
    errs.name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";

  const digits = f.phone.replace(/\D/g, "");
  if (!digits) errs.phone = "กรุณากรอกเบอร์โทรศัพท์";
  else if (!/^0\d{9}$/.test(digits))
    errs.phone = "รูปแบบเบอร์โทรไม่ถูกต้อง (เช่น 0891234567)";

  if (f.lineId && !/^[A-Za-z0-9._-]{2,}$/.test(f.lineId))
    errs.lineId = "Line ID ใช้ได้เฉพาะตัวอักษร ตัวเลข จุด ขีดกลาง/ล่าง";

  return errs;
}

function formatPhone(input: string) {
  const d = input.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/* ---- styles ---- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#EBDDFF",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#333" },
  form: { paddingHorizontal: 16, paddingTop: 12 },
  field: { marginBottom: 16 },
  label: { color: "#555", marginBottom: 6, fontSize: 14 },
  req: { color: "#8B5CF6" },
  input: {
    borderWidth: 1,
    borderColor: "#CFC8E8",
    backgroundColor: "#FFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    color: "#111",
  },
  inputError: { borderColor: "#E35B5B" },
  error: { color: "#E35B5B", marginTop: 6, fontSize: 12 },
  footer: { padding: 16 },
  button: {
    backgroundColor: "#5B3FD6",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#B9A8F0" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
