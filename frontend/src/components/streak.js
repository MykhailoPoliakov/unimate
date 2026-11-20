import { useEffect, useState } from "react"
import { View, Text, AppState, useWindowDimensions } from "react-native"
import MaskedView from "@react-native-masked-view/masked-view"
import { LinearGradient as ExpoGradient } from "expo-linear-gradient"
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg"
import AsyncStorage from "@react-native-async-storage/async-storage"

const KEY = "studyDays"
const MAX_FONT = 120
const MIN_FONT = 40
const SIDE_PADDING = 24
const GAP = 6
const DIGIT_RATIO = 0.62
const FLAME_RATIO = 0.85
const FLAME_ASPECT = 250 / 345
// Fixed section height (number + "DAY STREAK" label + week row, with breathing room).
const STREAK_HEIGHT = 280

const WEEK = ["M", "T", "W", "T", "F", "S", "S"]

const toKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`

const todayKey = () => toKey(new Date())

const getWeekDates = (date = new Date()) => {
  const monday = new Date(date)
  const day = monday.getDay()

  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday)
    current.setDate(monday.getDate() + index)
    return toKey(current)
  })
}

const calcStreak = (days) => {
  const set = new Set(days)
  const d = new Date()

  if (!set.has(toKey(d))) {
    d.setDate(d.getDate() - 1)
  }

  let count = 0

  while (set.has(toKey(d))) {
    count++
    d.setDate(d.getDate() - 1)
  }

  return count
}

export default function Streak({ isFocused }) {
  const { width: screenW } = useWindowDimensions()

  const [days, setDays] = useState([])
  const [today, setToday] = useState(todayKey())

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setToday(todayKey())
      }
    })

    return () => sub.remove()
  }, [])

  useEffect(() => {
    let cancelled = false

    AsyncStorage.getItem(KEY).then((raw) => {
      if (!cancelled && raw) {
        setDays(JSON.parse(raw))
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isFocused) return

    let cancelled = false

    const markToday = async () => {
      const raw = await AsyncStorage.getItem(KEY)
      const saved = raw ? JSON.parse(raw) : []

      const next = saved.includes(today) ? saved : [...saved, today]

      if (next !== saved) {
        await AsyncStorage.setItem(KEY, JSON.stringify(next))
      }

      if (!cancelled) {
        setDays(next)
      }
    }

    markToday()

    return () => {
      cancelled = true
    }
  }, [isFocused, today])

  const streak = calcStreak(days)
  const isFired = days.includes(today)

  const weekDates = getWeekDates(new Date())

  const completedDays = weekDates
    .map((date, index) => (days.includes(date) ? index : -1))
    .filter((index) => index !== -1)

  const len = String(streak).length
  const available = screenW - SIDE_PADDING * 2 - GAP

  const fitted = available / (len * DIGIT_RATIO + FLAME_RATIO * FLAME_ASPECT)

  const fontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, fitted))

  return (
    <View
      className="items-center justify-center"
      style={{ height: STREAK_HEIGHT }}
    >
      <View className="items-center gap-5">
        <View className="flex-row items-center gap-3">
          <GradientNumber value={streak} lit={isFired} fontSize={fontSize} />

          <Flame lit={isFired} size={fontSize * FLAME_RATIO} />
        </View>

        <Text className="mt-[-4px] text-xs tracking-[1.5px] text-[#9a9aa0] font-mono">
          DAY STREAK
        </Text>

        <WeekCircles completedDays={completedDays} />
      </View>
    </View>
  )
}

function WeekCircles({ completedDays }) {
  return (
    <View className="w-full flex-row justify-between px-6">
      {WEEK.map((day, index) => {
        const active = completedDays.includes(index)

        return (
          <View key={day + index} className="items-center gap-2">
            <Text className="text-xs text-[#888888]">{day}</Text>

            <ExpoGradient
              colors={
                active
                  ? ["#FFE0A3", "#FFB45E", "#D96A24"]
                  : ["#444444", "#292929", "#202020"]
              }
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: active ? "#FFD29A" : "#454545",
                shadowColor: "#FF9B45",
                shadowOpacity: active ? 0.5 : 0,
                shadowRadius: active ? 10 : 0,
                shadowOffset: {
                  width: 0,
                  height: 0,
                },
                elevation: active ? 5 : 0,
              }}
            >
              {active && (
                <Text className="text-white font-bold text-base">✓</Text>
              )}
            </ExpoGradient>
          </View>
        )
      })}
    </View>
  )
}

function GradientNumber({ value, lit, fontSize }) {
  const text = String(value)

  const textStyle = {
    fontSize,
    lineHeight: fontSize * 1.1,
    fontWeight: "800",
    includeFontPadding: false,
  }

  const colors = lit
    ? ["#FFE0A3", "#FFB45E", "#F7931E", "#F15A24", "#A94718"]
    : ["#FFFFFF", "#D9D9E2", "#85858F", "#B5B5BF", "#A1A1AA"]

  return (
    <MaskedView maskElement={<Text style={textStyle}>{text}</Text>}>
      <ExpoGradient
        colors={colors}
        locations={[0, 0.25, 0.48, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <Text style={[textStyle, { opacity: 0 }]}>{text}</Text>
      </ExpoGradient>
    </MaskedView>
  )
}

function Flame({ lit, size }) {
  return (
    <Svg
      width={size * FLAME_ASPECT}
      height={size}
      viewBox="165 0 250 345"
      opacity={lit ? 1 : 0.35}
    >
      <Defs>
        <LinearGradient id="flameGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={lit ? "#F7931E" : "#888"} />
          <Stop offset="1" stopColor={lit ? "#F15A24" : "#555"} />
        </LinearGradient>
      </Defs>

      <Path
        fill="url(#flameGrad)"
        d="M265 5C330 40 352 100 350 155C358 150 368 140 375 120C400 165 412 200 408 240C405 295 370 325 335 340C355 315 365 290 358 262C350 235 312 215 303 185C300 172 300 162 300 152C270 175 255 210 265 262C255 255 245 240 240 225C222 245 220 300 247 340C190 315 165 265 172 210C180 160 255 100 265 5Z"
      />
    </Svg>
  )
}
