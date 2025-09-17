import { Button, StyleSheet, Text, View, Alert } from 'react-native';
import React, { useState } from 'react';
import { CalendarList } from 'react-native-calendars';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { scheduleNotification } from '../component/Notification'; // added import

const Calendars = () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [markedDates, setMarkedDates] = useState({
    [currentDate]: { selected: true, selectedColor: 'blue' },
  }); 
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = date => {
    setSelectedTime(date);
    hideDatePicker();
  };
  const scheduleSelected = async () => {
    if (!selectedDate) {
      Alert.alert('Lỗi', 'Chưa chọn ngày');
      return;
    }
    if (!selectedTime) {
      Alert.alert('Lỗi', 'Chưa chọn giờ');
      return;
    }

    // selectedDate: "YYYY-MM-DD"
    const [y, m, d] = selectedDate.split('-').map(Number);
    const scheduled = new Date(selectedTime); // clone time object
    scheduled.setFullYear(y, m - 1, d); // set date to the selected day

    const now = new Date();
    const diffSeconds = Math.round((scheduled.getTime() - now.getTime()) / 1000);

    if (diffSeconds <= 0) {
      Alert.alert('Lỗi', 'Thời gian đã chọn đã qua');
      return;
    }

    try {
      const message = `Nhắc: ${selectedDate} ${selectedTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      const res = await scheduleNotification(diffSeconds, message);
      Alert.alert('Hoàn tất', res);
    } catch (err) {
      Alert.alert('Lỗi khi lên lịch', err.message || String(err));
    }
  };

  return (
    <View>
      <CalendarList
        horizontal={true}
        pagingEnabled={true}
        onDayPress={day => {
          setSelectedDate(day.dateString);
          setMarkedDates({
            [day.dateString]: { selected: true, selectedColor: 'blue' },
          });
        }}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: 'red',
          dotColor: 'white',
          todayDotColor: 'white',
          todayTextColor: 'white',
          todayBackgroundColor: 'red',
          textMonthFontWeight: 'bold',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
          monthTextColor: '#1e90ff',
        }}
      />

      <Text>
        Ngày đã chọn: {selectedDate} - {selectedTime ? selectedTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa chọn'}
      </Text>

      <Button title="Show Date Picker" onPress={showDatePicker} />
      <Button title="Lên lịch thông báo" onPress={scheduleSelected} />

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="time"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
        themeVariant='dark'
        is24Hour={true}
        locale="vi-VN"
      />
    </View>
  );
};

export default Calendars;

const styles = StyleSheet.create({});
