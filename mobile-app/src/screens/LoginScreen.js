import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomerAuth } from '../context/CustomerAuthContext';

const C = {
  cream: '#f5f0e8',
  warmWhite: '#faf8f5',
  brown: '#8b6f5e',
  darkBrown: '#3d2b1f',
  gold: '#c9a96e',
  lightGray: '#e8e0d5',
  textGray: '#6b6b6b',
};

/** Keeps the form a normal width on web / large screens */
const FORM_MAX_WIDTH = 380;

const LoginScreen = ({ navigation }) => {
  const { login } = useCustomerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const handleLogin = async () => {
    if (submitting) return;
    try {
      if (!email || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      setSubmitting(true);
      await login(email.trim(), password);
      navigation.replace('MyProfile');
    } catch (error) {
      const status = error?.response?.status;
      const apiMessage = error?.response?.data?.error;
      if (status === 401) {
        Alert.alert('Login Failed', 'Invalid email or password. Use your registered guest account.');
      } else if (status === 503) {
        Alert.alert('Server Unavailable', apiMessage || 'Database is not connected. Start MongoDB and try again.');
      } else {
        Alert.alert('Login Failed', apiMessage || error?.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.bg}>
      <View style={styles.overlay} />
      <SafeAreaView edges={['top']} style={styles.backBar}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.backLabel}>← Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.kicker}>Maison Velour</Text>
            <Text style={styles.title}>Guest Sign In</Text>
            <Text style={styles.subtitle}>Continue your booking, orders, and profile access.</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={C.textGray}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={C.textGray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.gold} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Don't have an account? Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.darkBrown },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,15,5,0.45)' },
  backBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backLabel: { color: 'rgba(245,240,232,0.95)', fontSize: 16, fontWeight: '600' },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  card: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: C.warmWhite,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.lightGray,
  },
  kicker: {
    color: C.brown,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
    color: C.darkBrown,
  },
  subtitle: {
    fontSize: 14,
    color: C.textGray,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: C.lightGray,
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: C.darkBrown,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  buttonText: {
    color: C.gold,
    fontWeight: 'bold',
    fontSize: 17,
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: C.brown,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoginScreen;
