import { useEffect, useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from "react-native"
import healthRecordService from "../../services/healthRecordService"
import userService from "../../services/userService";

const { width } = Dimensions.get("window")

export default function HealthChartScreen() {
  const [selectedMetric, setSelectedMetric] = useState("bloodPressure")
  const [healthData, setHealthData] = useState([])
  const [timeRange, setTimeRange] = useState("7")
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [todayRecord, setTodayRecord] = useState(null)

  const getMetrics = () => [
    {
      key: "bloodPressure",
      title: "Huyết áp",
      icon: "❤️",
      unit: "mmHg",
      currentValue:
        todayRecord?.vitals?.bloodPressure?.systolic && todayRecord?.vitals?.bloodPressure?.diastolic
          ? `${todayRecord.vitals.bloodPressure.systolic}/${todayRecord.vitals.bloodPressure.diastolic}`
          : "--",
      color: "#ef4444",
    },
    {
      key: "heartRate",
      title: "Nhịp tim",
      icon: "💓",
      unit: "bpm",
      currentValue: todayRecord?.vitals?.heartRate?.value?.toString() || "--",
      color: "#ec4899",
    },
    {
      key: "bloodSugar",
      title: "Đường huyết",
      icon: "🩸",
      unit: "mg/dL",
      currentValue: todayRecord?.vitals?.bloodSugar?.value?.toString() || "--",
      color: "#f97316",
    },
    {
      key: "bmi",
      title: "BMI",
      icon: "⚖️",
      unit: "",
      currentValue: todayRecord?.vitals?.bmi?.value?.toString() || "--",
      color: "#8b5cf6",
    },
  ]

  const timeRanges = [
    { key: "7", label: "7 ngày" },
    { key: "30", label: "30 ngày" },
    { key: "90", label: "3 tháng" },
  ]

  useEffect(() => {
    checkUserRole()
  }, [])

  useEffect(() => {
    if (userRole === "elderly") {
      loadHealthData()
      loadTodayRecord()
    }
  }, [timeRange, userRole])

  const checkUserRole = async () => {
    try {
      const { success, data } = await userService.getUserInfo()
      if (success && data) {
        setUserRole(data.role)
      }
    } catch (error) {
      console.error("Error loading user info:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadTodayRecord = async () => {
    try {
      const { success, data } = await healthRecordService.getToday()
      if (success && data) {
        setTodayRecord(data)
      }
    } catch (error) {
      console.error("Error loading today record:", error)
    }
  }

  const loadHealthData = async () => {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - Number.parseInt(timeRange))

      const { success, data } = await healthRecordService.listRecords({
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      })

      if (success) {
        setHealthData(data || [])
      }
    } catch (error) {
      console.error("Error loading health data:", error)
    }
  }

  const getCurrentMetric = () => {
    const metrics = getMetrics()
    return metrics.find((m) => m.key === selectedMetric) || metrics[0]
  }

  const getMetricValue = (record) => {
    switch (selectedMetric) {
      case "bloodPressure":
        return record.vitals?.bloodPressure
          ? `${record.vitals.bloodPressure.systolic}/${record.vitals.bloodPressure.diastolic}`
          : null
      case "heartRate":
        return record.vitals?.heartRate?.value
      case "bloodSugar":
        return record.vitals?.bloodSugar?.value
      case "bmi":
        return record.vitals?.bmi?.value
      default:
        return null
    }
  }

  const getStatusColor = (value) => {
    if (!value || value === "--") return "#6b7280"

    switch (selectedMetric) {
      case "bloodPressure":
        const [systolic, diastolic] = value.split("/").map(Number)
        if (systolic < 120 && diastolic < 80) return "#10b981"
        if (systolic < 140 && diastolic < 90) return "#f59e0b"
        return "#ef4444"
      case "heartRate":
        if (value >= 60 && value <= 100) return "#10b981"
        if (value >= 50 && value <= 110) return "#f59e0b"
        return "#ef4444"
      case "bloodSugar":
        if (value < 100) return "#10b981"
        if (value < 126) return "#f59e0b"
        return "#ef4444"
      case "bmi":
        if (value >= 18.5 && value < 23) return "#10b981"
        if (value >= 23 && value < 25) return "#f59e0b"
        return "#ef4444"
      default:
        return "#6b7280"
    }
  }

  const getStatusText = (value) => {
    if (!value || value === "--") return "Chưa có dữ liệu"

    switch (selectedMetric) {
      case "bloodPressure":
        const [systolic, diastolic] = value.split("/").map(Number)
        if (systolic < 120 && diastolic < 80) return "Bình thường"
        if (systolic < 140 && diastolic < 90) return "Cần theo dõi"
        return "Cần chú ý"
      case "heartRate":
        if (value >= 60 && value <= 100) return "Bình thường"
        if (value >= 50 && value <= 110) return "Cần theo dõi"
        return "Cần chú ý"
      case "bloodSugar":
        if (value < 100) return "Bình thường"
        if (value < 126) return "Cần theo dõi"
        return "Cần chú ý"
      case "bmi":
        if (value >= 18.5 && value < 23) return "Bình thường"
        if (value >= 23 && value < 25) return "Cần theo dõi"
        return "Cần chú ý"
      default:
        return "Chưa có dữ liệu"
    }
  }

  const getChartData = () => {
    const data = healthData
      .filter((record) => getMetricValue(record) !== null)
      .sort((a, b) => new Date(a.recordDate) - new Date(b.recordDate))
      .slice(-Number.parseInt(timeRange))

    return data.map((record) => ({
      date: new Date(record.recordDate),
      value: getMetricValue(record),
      status: getStatusText(getMetricValue(record)),
    }))
  }

  const getStats = () => {
    const chartData = getChartData()
    if (chartData.length === 0) return { highest: 0, average: 0, lowest: 0 }

    const values = chartData
      .map((d) => {
        if (selectedMetric === "bloodPressure") {
          const systolic = Number.parseInt(d.value.split("/")[0])
          return isNaN(systolic) ? 0 : systolic
        }
        const numValue = Number.parseFloat(d.value)
        return isNaN(numValue) ? 0 : numValue
      })
      .filter((val) => val > 0) // Remove zero values

    if (values.length === 0) return { highest: 0, average: 0, lowest: 0 }

    return {
      highest: Math.max(...values),
      average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      lowest: Math.min(...values),
    }
  }

  const renderChart = () => {
    const chartData = getChartData()
    if (chartData.length === 0) {
      return (
        <View style={{ height: 200, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#6b7280", fontSize: 16 }}>Chưa có dữ liệu để hiển thị</Text>
        </View>
      )
    }

    const values = chartData.map((d) => {
      if (selectedMetric === "bloodPressure") {
        const systolic = Number.parseInt(d.value.split("/")[0])
        return isNaN(systolic) ? 0 : systolic
      }
      const numValue = Number.parseFloat(d.value)
      return isNaN(numValue) ? 0 : numValue
    })

    const maxValue = Math.max(...values, 1) // Ensure maxValue is at least 1

    return (
      <View style={{ height: 200, paddingVertical: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 160, paddingHorizontal: 10 }}>
          {chartData.map((point, index) => {
            let pointValue = 0
            if (selectedMetric === "bloodPressure") {
              const systolic = Number.parseInt(point.value.split("/")[0])
              pointValue = isNaN(systolic) ? 0 : systolic
            } else {
              const numValue = Number.parseFloat(point.value)
              pointValue = isNaN(numValue) ? 0 : numValue
            }

            const height = Math.max((pointValue / maxValue) * 120, 5) // Minimum height of 5
            const color = getStatusColor(point.value)

            return (
              <View key={index} style={{ flex: 1, alignItems: "center", marginHorizontal: 2 }}>
                <View
                  style={{
                    width: 20,
                    height: height,
                    backgroundColor: color,
                    borderRadius: 10,
                    marginBottom: 8,
                    opacity: 0.8,
                  }}
                />
                <Text style={{ fontSize: 10, color: "#6b7280" }}>
                  {point.date.getDate()}/{point.date.getMonth() + 1}
                </Text>
              </View>
            )
          })}
        </View>
      </View>
    )
  }

  const currentMetric = getCurrentMetric()
  const stats = getStats()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#6b7280", fontSize: 16 }}>Đang tải...</Text>
      </View>
    )
  }

  if (userRole && userRole !== "elderly") {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center", padding: 20 }}
      >
        <Text style={{ color: "#ef4444", fontSize: 18, fontWeight: "600", marginBottom: 12, textAlign: "center" }}>
          Không có quyền truy cập
        </Text>
        <Text style={{ color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
          Chỉ người dùng cao tuổi mới có thể sử dụng tính năng biểu đồ sức khỏe.
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937", marginBottom: 12 }}>
            Chọn chỉ số theo dõi
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {getMetrics().map((metric) => (
              <TouchableOpacity
                key={metric.key}
                onPress={() => setSelectedMetric(metric.key)}
                style={{
                  width: (width - 56) / 2,
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: selectedMetric === metric.key ? 2 : 1,
                  borderColor: selectedMetric === metric.key ? "#f97316" : "#e5e7eb",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 24, marginBottom: 8 }}>{metric.icon}</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1f2937", marginBottom: 4 }}>
                  {metric.title}
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280" }}>
                  {metric.currentValue} {metric.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View
              style={{ width: 8, height: 8, backgroundColor: currentMetric.color, borderRadius: 4, marginRight: 8 }}
            />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>{currentMetric.title}</Text>
            <Text style={{ fontSize: 14, color: "#6b7280", marginLeft: 8 }}>Giá trị hiện tại</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ color: getStatusColor(currentMetric.currentValue), fontSize: 14, fontWeight: "600" }}>
              {getStatusText(currentMetric.currentValue)}
            </Text>
          </View>

          <Text style={{ fontSize: 32, fontWeight: "700", color: "#1f2937", marginBottom: 8 }}>
            {currentMetric.currentValue}
          </Text>
          <Text style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>{currentMetric.unit}</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: "#6b7280" }}>Lần đo gần nhất</Text>
            <Text style={{ fontSize: 12, color: "#6b7280" }}>
              {todayRecord?.recordDate
                ? new Date(todayRecord.recordDate).toLocaleDateString("vi-VN") +
                  " " +
                  new Date(todayRecord.recordDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                : "Chưa có dữ liệu"}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>Biểu đồ xu hướng</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {timeRanges.map((range) => (
                <TouchableOpacity
                  key={range.key}
                  onPress={() => setTimeRange(range.key)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: timeRange === range.key ? "#2563eb" : "white",
                    borderWidth: 1,
                    borderColor: timeRange === range.key ? "#2563eb" : "#d1d5db",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: timeRange === range.key ? "white" : "#6b7280",
                      fontWeight: timeRange === range.key ? "600" : "400",
                    }}
                  >
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {renderChart()}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              marginTop: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: "#f3f4f6",
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Cao nhất</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#ef4444" }}>{stats.highest}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Trung bình</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#2563eb" }}>{stats.average}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Thấp nhất</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#10b981" }}>{stats.lowest}</Text>
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: "#fef3c7", borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#f59e0b",
                borderRadius: 16,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <Text style={{ color: "white", fontSize: 16 }}>💡</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>Lời khuyên sức khỏe</Text>
          </View>
          <Text style={{ fontSize: 14, color: "#92400e", lineHeight: 20 }}>
            Duy trì chế độ ăn ít muối, tập thể dục đều đặn và kiểm soát stress để có huyết áp ổn định.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
