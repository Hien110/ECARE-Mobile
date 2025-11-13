import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function InputPhonenumber({
  label = 'Số điện thoại',
  placeholder = 'Nhập số điện thoại của bạn',
  value,
  onChangeText,
  keyboardType = 'phone-pad',
  error,
}) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, !!error && styles.inputError]}
        placeholder={placeholder}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    width: '100%',
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  errorText: {
    marginTop: 6,
    color: '#ff6b6b',
    fontSize: 12,
  },
});
