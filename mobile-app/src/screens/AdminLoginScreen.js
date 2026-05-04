import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLoginScreen({ navigation }) {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    try {
      if (!username || !password) {
        Alert.alert('Error', 'Please fill in username and password');
        return;
      }
      await login(username.trim().toLowerCase(), password);
      Alert.alert('Success', 'Signed in to admin portal');
      navigation.replace('AdminDashboard');
    } catch (error) {
      Alert.alert('Login Failed', error?.response?.data?.error || error?.message || 'Could not sign in');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Sign In</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 14, fontSize: 16 },
  button: { backgroundColor: '#3d2b1f', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#c9a96e', fontWeight: 'bold', fontSize: 18 },
});
