import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

const InputEmail = ({ label = 'Email', value, onChangeText, error }) => {
  return (
    <View style={{ width: '100%', marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !!error && { borderColor: '#EF4444' }]}
        placeholder="Nhập email của bạn"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

export default InputEmail;

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    width: '100%',
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  error: { marginTop: 6, color: '#EF4444', fontSize: 12 },
});
