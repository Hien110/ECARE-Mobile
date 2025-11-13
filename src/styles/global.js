import { StyleSheet } from 'react-native';

export const Colors = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  info: '#5AC8FA',
  light: '#F2F2F7',
  dark: '#1C1C1E',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#8E8E93',
};

export const Typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.dark,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark,
  },
  body: {
    fontSize: 16,
    color: Colors.dark,
  },
  caption: {
    fontSize: 14,
    color: Colors.gray,
  },
});

export const Containers = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    margin: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});