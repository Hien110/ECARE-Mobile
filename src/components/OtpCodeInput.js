import React, { useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

export default function OtpCodeInput({
  length = 4,
  value = [],
  onChange,         // (digitsArray) => void
  onComplete,       // (codeString) => void
  autoFocus = true,
  inputStyle,
  containerStyle,
}) {
  const inputRefs = useRef([]);

  const handleChange = (text, index) => {
    if (text.length > 1) return;
    const next = [...value];
    next[index] = text;
    onChange?.(next);

    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (text && index === length - 1) {
      const code = next.join('');
      if (code.length === length) {
        setTimeout(() => onComplete?.(code), 80);
      }
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[styles.otpWrapper, containerStyle]}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={r => (inputRefs.current[i] = r)}
          style={[styles.otpInput, inputStyle]}
          value={value[i] || ''}
          keyboardType="number-pad"
          maxLength={1}
          onChangeText={t => handleChange(t, i)}
          onKeyPress={e => handleKeyPress(e, i)}
          autoFocus={autoFocus && i === 0}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  otpWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 20,
    marginTop: 20,
  },
  otpInput: {
    width: 55,
    height: 55,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    backgroundColor: '#fff',
  },
});
