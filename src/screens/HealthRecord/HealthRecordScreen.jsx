import { useEffect, useMemo, useState, useCallback } from "react"
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from "react-native"
import healthRecordService from "../../services/healthRecordService"
import userService from "../../services/userService"

// Stable component definitions to prevent remounting of inputs (which causes cursor loss)
const SectionCard = ({ title, subtitle, children, right }) => (
  <View
    style={{
      backgroundColor: "white",
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }}
  >
    {(title || right) && (
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: "#0f172a", flex: 1 }}>{title}</Text>
        {right}
      </View>
    )}
    {subtitle ? <Text style={{ color: "#64748b", marginBottom: 12 }}>{subtitle}</Text> : null}
    {children}
  </View>
)

const Input = ({ label, value, onChangeText, keyboardType = "numeric", placeholder, maxLength }) => {
  const handleTextChange = (text) => {
    // Chỉ cho phép nhập số và dấu chấm thập phân
    if (keyboardType === "numeric") {
      const numericRegex = /^[0-9]*\.?[0-9]*$/;
      if (text === "" || numericRegex.test(text)) {
        onChangeText(text);
      }
    } else {
      onChangeText(text);
    }
  };

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={{ marginBottom: 6, color: "#475569", fontWeight: "600" }}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={handleTextChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        blurOnSubmit={false}
        maxLength={maxLength}
        style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 12, backgroundColor: "#ffffff" }}
      />
    </View>
  )
}

const Hint = ({ text, tone = "info" }) => {
  const map = {
    info: { bg: "#eff6ff", color: "#2563eb" },
    success: { bg: "#ecfdf5", color: "#059669" },
    warn: { bg: "#fff7ed", color: "#ea580c" },
    danger: { bg: "#fef2f2", color: "#dc2626" },
  }
  const s = map[tone] || map.info
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text style={{ color: s.color, fontSize: 12 }}>{text}</Text>
    </View>
  )
}

const HealthStatus = ({ value, type }) => {
  const getStatus = () => {
    const numValue = parseFloat(value)
    if (!value || isNaN(numValue)) return null

    switch (type) {
      case 'bloodPressure':
        const [systolic, diastolic] = value.split('/').map(v => parseFloat(v))
        if (isNaN(systolic) || isNaN(diastolic)) return null
        
        if (systolic < 90 || diastolic < 60) {
          return { text: "Huyết áp thấp", tone: "danger" }
        } else if (systolic < 120 && diastolic < 80) {
          return { text: "Huyết áp bình thường", tone: "success" }
        } else if (systolic < 140 && diastolic < 90) {
          return { text: "Huyết áp cao - mức 1", tone: "warn" }
        } else {
          return { text: "Huyết áp cao - mức 2", tone: "danger" }
        }

      case 'heartRate':
        if (numValue < 60) {
          return { text: "Nhịp tim thấp", tone: "danger" }
        } else if (numValue >= 60 && numValue <= 100) {
          return { text: "Nhịp tim bình thường", tone: "success" }
        } else {
          return { text: "Nhịp tim cao", tone: "danger" }
        }

      case 'bloodSugar':
        if (numValue < 70) {
          return { text: "Đường huyết thấp", tone: "danger" }
        } else if (numValue < 100) {
          return { text: "Đường huyết bình thường", tone: "success" }
        } else if (numValue < 126) {
          return { text: "Tiền tiểu đường", tone: "warn" }
        } else {
          return { text: "Đường huyết cao", tone: "danger" }
        }

      case 'bmi':
        if (numValue < 18.5) {
          return { text: "Thiếu cân", tone: "warn" }
        } else if (numValue < 23) {
          return { text: "Cân nặng bình thường", tone: "success" }
        } else if (numValue < 25) {
          return { text: "Thừa cân", tone: "warn" }
        } else {
          return { text: "Béo phì", tone: "danger" }
        }

      case 'temperature':
        if (numValue < 36.1) {
          return { text: "Nhiệt độ thấp", tone: "warn" }
        } else if (numValue >= 36.1 && numValue <= 37.2) {
          return { text: "Nhiệt độ bình thường", tone: "success" }
        } else if (numValue <= 38) {
          return { text: "Sốt nhẹ", tone: "warn" }
        } else {
          return { text: "Sốt cao", tone: "danger" }
        }

      default:
        return null
    }
  }

  const status = getStatus()
  if (!status) return null

  return <Hint text={status.text} tone={status.tone} />
}

// Tạo thông báo lưu ý sức khỏe tổng hợp
const generateHealthAlert = (form, bmiValue) => {
  const alerts = []
  const warnings = []
  const criticals = []

  // Kiểm tra huyết áp
  if (form.systolic && form.diastolic) {
    const systolic = parseFloat(form.systolic)
    const diastolic = parseFloat(form.diastolic)
    if (systolic < 90 || diastolic < 60) {
      criticals.push("Huyết áp quá thấp - cần kiểm tra y tế ngay")
    } else if (systolic >= 140 || diastolic >= 90) {
      if (systolic >= 160 || diastolic >= 100) {
        criticals.push("Huyết áp rất cao - cần đi khám ngay")
      } else {
        warnings.push("Huyết áp cao - nên theo dõi và tham khảo bác sĩ")
      }
    }
  }

  // Kiểm tra nhịp tim
  if (form.heartRate) {
    const hr = parseFloat(form.heartRate)
    if (hr < 50) {
      criticals.push("Nhịp tim quá chậm - cần kiểm tra tim mạch")
    } else if (hr > 120) {
      criticals.push("Nhịp tim quá nhanh - cần nghỉ ngơi và theo dõi")
    } else if (hr < 60 || hr > 100) {
      warnings.push("Nhịp tim bất thường - nên theo dõi thêm")
    }
  }

  // Kiểm tra đường huyết
  if (form.bloodSugar) {
    const bs = parseFloat(form.bloodSugar)
    if (bs < 70) {
      criticals.push("Đường huyết thấp - cần bổ sung đường ngay")
    } else if (bs >= 200) {
      criticals.push("Đường huyết rất cao - cần đi khám ngay")
    } else if (bs >= 126) {
      warnings.push("Đường huyết cao - cần kiểm soát chế độ ăn và tham khảo bác sĩ")
    } else if (bs >= 100) {
      alerts.push("Đường huyết hơi cao - nên chú ý chế độ ăn")
    }
  }

  // Kiểm tra BMI
  if (bmiValue) {
    const bmi = parseFloat(bmiValue)
    if (bmi < 16) {
      criticals.push("Cân nặng quá thấp - cần tăng cường dinh dưỡng")
    } else if (bmi >= 30) {
      warnings.push("Béo phì - cần chế độ ăn kiêng và tập luyện")
    } else if (bmi < 18.5) {
      alerts.push("Thiếu cân - nên bổ sung dinh dưỡng")
    } else if (bmi >= 25) {
      alerts.push("Thừa cân - nên tăng cường vận động")
    }
  }

  // Kiểm tra nhiệt độ
  if (form.temperature) {
    const temp = parseFloat(form.temperature)
    if (temp >= 39) {
      criticals.push("Sốt cao - cần hạ sốt và theo dõi sát")
    } else if (temp >= 37.5) {
      warnings.push("Có sốt - nên nghỉ ngơi và uống nhiều nước")
    } else if (temp < 35) {
      criticals.push("Nhiệt độ cơ thể quá thấp - cần giữ ấm")
    }
  }

  return { alerts, warnings, criticals }
}

export default function HealthRecordScreen() {
  const [form, setForm] = useState({
    systolic: "",
    diastolic: "",
    heartRate: "",
    bloodSugar: "",
    weight: "",
    height: "",
    temperature: "",
    notes: "",
  })
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const updateForm = useCallback(
    (field) => (value) => {
      setForm((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  const bmiValue = useMemo(() => {
    const w = Number.parseFloat(form.weight)
    const h = Number.parseFloat(form.height)
    if (!w || !h) return ""
    const m = h / 100
    return (w / (m * m)).toFixed(1)
  }, [form.weight, form.height])

  useEffect(() => {
    ;(async () => {
      try {
        // Check user role first
        const { success: userSuccess, data: userData } = await userService.getUserInfo()
        if (userSuccess && userData) {
          setUserRole(userData.role)

          // Only load health data if user is elderly
          if (userData.role === "elderly") {
            const { success, data } = await healthRecordService.getToday()
            if (success && data) {
              setForm({
                systolic: data?.vitals?.bloodPressure?.systolic?.toString() || "",
                diastolic: data?.vitals?.bloodPressure?.diastolic?.toString() || "",
                heartRate: data?.vitals?.heartRate?.value?.toString() || "",
                bloodSugar: data?.vitals?.bloodSugar?.value?.toString() || "",
                weight: (data?.vitals?.weight?.value ?? "").toString(),
                height: (data?.vitals?.height?.value ?? "").toString(),
                temperature: data?.vitals?.temperature?.value?.toString() || "",
                notes: data?.notes || "",
              })
            }
          }
        }
      } catch (error) {
        console.error("Error loading user info:", error)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const onSubmit = async () => {
    if (userRole !== "elderly") {
      Alert.alert("Lỗi", "Chỉ người dùng cao tuổi mới có thể tạo nhật ký sức khỏe")
      return
    }

    // Tạo thông báo lưu ý sức khỏe
    const healthAlerts = generateHealthAlert(form, bmiValue)
    
    const payload = {
      vitals: {
        bloodPressure: {
          systolic: form.systolic ? Number(form.systolic) : undefined,
          diastolic: form.diastolic ? Number(form.diastolic) : undefined,
        },
        heartRate: { value: form.heartRate ? Number(form.heartRate) : undefined },
        bloodSugar: { value: form.bloodSugar ? Number(form.bloodSugar) : undefined },
        weight: { value: form.weight ? Number(form.weight) : undefined },
        height: { value: form.height ? Number(form.height) : undefined },
        temperature: { value: form.temperature ? Number(form.temperature) : undefined },
      },
      notes: form.notes || undefined,
    }
    
    const res = await healthRecordService.createRecord(payload)
    
    if (res.success) {
      // Tạo thông báo với lưu ý sức khỏe
      let alertMessage = "✅ Đã lưu nhật ký sức khỏe thành công!\n\n"
      
      // Thêm cảnh báo nghiêm trọng
      if (healthAlerts.criticals.length > 0) {
        alertMessage += "🚨 CẢNH BÁO NGHIÊM TRỌNG:\n"
        healthAlerts.criticals.forEach(critical => {
          alertMessage += `• ${critical}\n`
        })
        alertMessage += "\n"
      }
      
      // Thêm cảnh báo
      if (healthAlerts.warnings.length > 0) {
        alertMessage += "⚠️ LƯU Ý:\n"
        healthAlerts.warnings.forEach(warning => {
          alertMessage += `• ${warning}\n`
        })
        alertMessage += "\n"
      }
      
      // Thêm khuyến nghị
      if (healthAlerts.alerts.length > 0) {
        alertMessage += "💡 KHUYẾN NGHỊ:\n"
        healthAlerts.alerts.forEach(alert => {
          alertMessage += `• ${alert}\n`
        })
        alertMessage += "\n"
      }
      
      // Nếu tất cả đều bình thường
      if (healthAlerts.criticals.length === 0 && healthAlerts.warnings.length === 0 && healthAlerts.alerts.length === 0) {
        alertMessage += "🎉 Các chỉ số sức khỏe của bạn đều trong giới hạn bình thường!"
      }
      
      Alert.alert("Thông báo sức khỏe", alertMessage)
    } else {
      Alert.alert("Lỗi", res.message || "Không thể lưu")
    }
  }

  // Show loading state
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#6b7280", fontSize: 16 }}>Đang tải...</Text>
      </View>
    )
  }

  // Show access denied for non-elderly users
  if (userRole && userRole !== "elderly") {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center", padding: 20 }}
      >
        <Text style={{ color: "#ef4444", fontSize: 18, fontWeight: "600", marginBottom: 12, textAlign: "center" }}>
          Không có quyền truy cập
        </Text>
        <Text style={{ color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
          Chỉ người dùng cao tuổi mới có thể sử dụng tính năng nhật ký sức khỏe.
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        {/* Date + action */}
        <SectionCard
          title="Hôm nay"
          right={
            <View style={{ backgroundColor: "#e0f2fe", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 }}>
              <Text style={{ color: "#0284c7" }}>Lịch</Text>
            </View>
          }
        >
          <Text style={{ color: "#64748b" }}>{new Date().toLocaleDateString()}</Text>
        </SectionCard>

        {/* Blood pressure */}
        <SectionCard title="Huyết áp (mmHg)">
          <Input label="Tâm thu" value={form.systolic} onChangeText={updateForm("systolic")} maxLength={3} placeholder="120" />
          <Input label="Tâm trương" value={form.diastolic} onChangeText={updateForm("diastolic")} maxLength={3} placeholder="80" />
          {form.systolic && form.diastolic ? (
            <HealthStatus value={`${form.systolic}/${form.diastolic}`} type="bloodPressure" />
          ) : (
            <Hint text="Bình thường: <120/80 mmHg | Cao: >140/90" tone="info" />
          )}
        </SectionCard>

        {/* Heart rate */}
        <SectionCard title="Nhịp tim (lần/phút)">
          <Input label="Giá trị" value={form.heartRate} onChangeText={updateForm("heartRate")} maxLength={3} placeholder="75" />
          {form.heartRate ? (
            <HealthStatus value={form.heartRate} type="heartRate" />
          ) : (
            <Hint text="Bình thường: 60-100 nhịp/phút" tone="info" />
          )}
        </SectionCard>

        {/* Blood sugar */}
        <SectionCard title="Đường huyết (mg/dL)">
          <Input label="Giá trị" value={form.bloodSugar} onChangeText={updateForm("bloodSugar")} maxLength={3} placeholder="95" />
          {form.bloodSugar ? (
            <HealthStatus value={form.bloodSugar} type="bloodSugar" />
          ) : (
            <Hint text="Bình thường: <100 mg/dL (lúc đói) | Cao: >126" tone="info" />
          )}
        </SectionCard>

        {/* BMI */}
        <SectionCard title="Chỉ số BMI">
          <Input label="Cân nặng (kg)" value={form.weight} onChangeText={updateForm("weight")} maxLength={5} placeholder="65.5" />
          <Input label="Chiều cao (cm)" value={form.height} onChangeText={updateForm("height")} maxLength={3} placeholder="170" />
          <View style={{ marginBottom: 12 }}>
            <Text style={{ marginBottom: 6, color: "#475569", fontWeight: "600" }}>BMI</Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#e2e8f0",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#f8fafc",
              }}
            >
              <Text style={{ color: "#0f172a" }}>{bmiValue ? `${bmiValue}` : "—"}</Text>
            </View>
          </View>
          {bmiValue ? (
            <HealthStatus value={bmiValue} type="bmi" />
          ) : (
            <Hint text="Bình thường: 18.5-22.9 | Thừa cân: 23-24.9 | Béo phì: ≥25" tone="info" />
          )}
        </SectionCard>

        {/* Temperature */}
        <SectionCard title="Nhiệt độ (°C)">
          <Input label="Giá trị" value={form.temperature} onChangeText={updateForm("temperature")} maxLength={4} placeholder="36.5" />
          {form.temperature ? (
            <HealthStatus value={form.temperature} type="temperature" />
          ) : (
            <Hint text="Bình thường: 36.1-37.2°C" tone="info" />
          )}
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Ghi chú">
          <TextInput
            value={form.notes}
            onChangeText={updateForm("notes")}
            placeholder="VD: Sau khi tập thể dục, cảm thấy khoẻ mạnh..."
            multiline
            numberOfLines={4}
            maxLength={200}
            returnKeyType="default"
            blurOnSubmit={false}
            textBreakStrategy="simple"
            placeholderTextColor="#94a3b8"
            style={{
              borderWidth: 1,
              borderColor: "#e2e8f0",
              borderRadius: 12,
              padding: 12,
              textAlignVertical: "top",
              backgroundColor: "#ffffff",
            }}
          />
          <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>{form.notes.length}/200 ký tự</Text>
        </SectionCard>
      </ScrollView>

      {/* Sticky Save Bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          backgroundColor: "rgba(248,250,252,0.96)",
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
        }}
      >
        <TouchableOpacity
          onPress={onSubmit}
          style={{ backgroundColor: "#2563EB", padding: 16, borderRadius: 12, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Lưu dữ liệu sức khỏe</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
