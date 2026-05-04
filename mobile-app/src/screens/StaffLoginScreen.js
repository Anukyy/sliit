import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useStaffAuth } from '../context/StaffAuthContext';

const FORM_MAX_WIDTH = 380;

export default function StaffLoginScreen({ navigation }) {
  const { login } = useStaffAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    try {
      if (!username || !password) {
        Alert.alert('Error', 'Please fill in username and password');
        return;
      }
      const data = await login(username.trim().toLowerCase(), password);
      Alert.alert('Success', 'Signed in to staff portal');
      const roleName = String(data?.roleName || '').toLowerCase();
      if (roleName === 'room manager' || roleName === 'room_manager') {
        navigation.replace('RoomManagerDashboard');
      } else if (roleName === 'kitchen manager' || roleName === 'kitchen_manager') {
        navigation.replace('KitchenManagerDashboard');
      } else if (roleName === 'customer manager' || roleName === 'customer_manager') {
        navigation.replace('CustomerManagerDashboard');
      } else if (roleName === 'review manager' || roleName === 'review_manager') {
        navigation.replace('ReviewManagerDashboard');
      } else if (roleName === 'receptionist') {
        navigation.replace('ReceptionistDashboard');
      } else {
        navigation.replace('Staff');
      }
    } catch (error) {
      Alert.alert('Login Failed', error?.response?.data?.error || error?.message || 'Could not sign in');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Staff Sign In</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#888"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.button} onPress={onSubmit}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 22,
    textAlign: 'center',
    color: '#3d2b1f',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#3d2b1f',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: { color: '#c9a96e', fontWeight: 'bold', fontSize: 17 },
});
