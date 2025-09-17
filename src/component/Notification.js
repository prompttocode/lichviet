import notifee, { AndroidImportance, AndroidVisibility, TriggerType, EventType } from '@notifee/react-native'
import { PermissionsAndroid, Platform } from 'react-native'
import React from 'react'
import Sound from 'react-native-sound' // Thêm import này nếu chưa có

const ensureAndroidNotificationPermission = async () => {
  if (Platform.OS !== 'android') return true
  if (Platform.Version >= 33) { // Android 13+
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    )
    return granted === PermissionsAndroid.RESULTS.GRANTED
  }
  return true
}

let scheduledTriggerIds = []
let handlersRegistered = false
let currentSound = null // Thêm biến để lưu sound hiện tại




const cancelScheduledNotifications = async () => {
  try {
    // huỷ các trigger đã lưu (nếu API có hỗ trợ)
    for (const id of scheduledTriggerIds) {
      try {
        // huỷ trigger cụ thể
        // nếu API không có cancelTriggerNotification hãy gọi cancelNotification / cancelAllNotifications
        await notifee.cancelTriggerNotification?.(id)
        await notifee.cancelNotification?.(id)
      } catch (e) {
        // ignore per-item errors
      }
    }
    // đảm bảo xoá hết thông báo đang hiển thị
    try { await notifee.cancelAllNotifications() } catch (e) {}
    // Dừng nhạc nếu đang phát
    if (currentSound) {
      currentSound.stop()
      currentSound.release()
      currentSound = null
    }
  } finally {
    scheduledTriggerIds = []
  }
}

export const scheduleNotification = async (seconds, message, options = {}) => {
  try {
    const ok = await ensureAndroidNotificationPermission()
    if (!ok) throw new Error('Notification permission not granted')

    // console.log('nhạc đang phát'); // optional remove

    // DO NOT delete channel here — deleting channel can cancel scheduled triggers
    // try {
    //   await notifee.deleteChannel('default')
    // } catch (e) {
    //   // ignore
    // }

    // Nếu dùng sound tuỳ chỉnh, đặt file vào android/app/src/main/res/raw/my_sound.mp3
    // và dùng sound: 'my_sound' (không có .mp3)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: AndroidImportance.MAX,
      vibration: true,
      sound: 'my_sound', // hoặc 'default'
    })

    await notifee.requestPermission() // iOS

    // Cấu hình tổng thời gian lặp lại (5 phút)
    const totalDurationSeconds = options.totalDurationSeconds ?? 300 // 5 phút
    const triggerTimestamp = Date.now() + Math.max(0, seconds) * 1000

    // Huỷ danh sách trước đó nếu cần
    scheduledTriggerIds = []

    const allowOngoing = options.ongoing ?? false // default false để tránh thay thế thông báo

    // Đăng ký handler cho action "stop" (chỉ 1 lần)
    if (!handlersRegistered) {
      notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.ACTION_PRESS && detail?.pressAction?.id === 'stop') {
          cancelScheduledNotifications()
        }
      })
      try {
        notifee.onBackgroundEvent(async ({ type, detail }) => {
          if (type === EventType.ACTION_PRESS && detail?.pressAction?.id === 'stop') {
            await cancelScheduledNotifications()
          }
        })
      } catch (e) {
        // ignore - có thể không hỗ trợ onBackgroundEvent
      }
      handlersRegistered = true
    }

    // Load sound để lấy duration nhưng KHÔNG play ngay
    const sound = new Sound('my_sound.mp3', Sound.MAIN_BUNDLE, async (error) => {
      if (error) {
        console.log('Lỗi tải nhạc:', error)
        return
      }
      currentSound = sound
      const duration = sound.getDuration() // Lấy độ dài nhạc (giây)
      if (!duration || duration <= 0) {
        console.log('Không lấy được duration nhạc')
        return
      }

      // Lên lịch nhiều thông báo lặp lại theo độ dài nhạc
      // Thay vì lên lịch nhiều thông báo chồng nhau, chỉ lên lịch 1 thông báo kiểu "alarm"
      const idForNotif = `notif-alarm-${Date.now()}`
      try {
        const notificationId = await notifee.createTriggerNotification(
          {
            id: idForNotif,
            title: 'Thông báo Nhắc',
            body: message,
            android: {
              channelId,
              sound: 'my_sound',
              visibility: AndroidVisibility.PUBLIC,
              fullScreenIntent: true,
              ongoing: allowOngoing, // nếu muốn 1 thông báo giữ trên thanh thông báo
              pressAction: { id: 'stop' },
              actions: [
                { title: 'Dừng', pressAction: { id: 'stop' } },
              ],
            },
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: triggerTimestamp,
          }
        )
        if (notificationId) scheduledTriggerIds.push(notificationId)
      } catch (e) {
        console.log('Lỗi khi lên lịch thông báo:', e)
      }

      // KHÔNG play ngay. Thay vào đó, bắt đầu play lúc trigger đầu tiên
      const startDelayMs = Math.max(0, triggerTimestamp - Date.now())
      const startTimeout = setTimeout(() => {
        if (!currentSound) return
        try {
          currentSound.setNumberOfLoops(-1)
          currentSound.play((success) => {
            if (!success) console.log('Lỗi phát nhạc')
          })
        } catch (e) {
          console.log('Lỗi khi bắt đầu phát nhạc:', e)
        }
      }, startDelayMs)

      // Dừng nhạc và huỷ thông báo sau totalDurationSeconds kể từ trigger đầu tiên
      const stopTimeout = setTimeout(async () => {
        if (currentSound) {
          currentSound.stop()
          currentSound.release()
          currentSound = null
        }
        await cancelScheduledNotifications()
        clearTimeout(startTimeout)
      }, startDelayMs + totalDurationSeconds * 1000)
    })

    return `Đã lên lịch thông báo lặp lại theo độ dài nhạc trong 5 phút và bắt đầu phát nhạc lặp lại. Nhấn nút Dừng để dừng.`
  } catch (error) {
    throw new Error(error.message || String(error))
  }
}
