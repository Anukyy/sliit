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

const FORM_MAX_WIDTH = 380;

function normalizePhoneDigits(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 9 && /^7\d{8}$/.test(d)) d = `0${d}`;
  return d;
}

function validatePasswordLocal(p) {
  const pwd = String(p ?? '');
  if (pwd.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(pwd)) return 'Password must include at least one letter';
  if (!/[0-9]/.test(pwd)) return 'Password must include at least one number';
  return null;
}

const RegisterScreen = ({ navigation }) => {
  const { register } = useCustomerAuth();
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    setSubmitError('');
    try {
      if (!name.trim() || !phone || !email.trim() || !password || !confirmPassword) {
        const msg = 'Please fill in all fields';
        setSubmitError(msg);
        Alert.alert('Error', msg);
        return;
      }

      const phoneNorm = normalizePhoneDigits(phone);
      if (phoneNorm.length !== 10) {
        const msg =
          'Enter a valid mobile number (10 digits with leading 0, e.g. 0712345678)';
        setSubmitError(msg);
        Alert.alert('Invalid phone', msg);
        return;
      }

      const pwdErr = validatePasswordLocal(password);
      if (pwdErr) {
        setSubmitError(pwdErr);
        Alert.alert('Invalid password', pwdErr);
        return;
      }

      if (password !== confirmPassword) {
        const msg = 'Passwords do not match';
        setSubmitError(msg);
        Alert.alert('Error', msg);
        return;
      }

      setSubmitting(true);

      await register({
        name: name.trim(),
        phone: phoneNorm,
        email: email.trim(),
        password,
        confirmPassword,
      });

      navigation.replace('MyProfile');
    } catch (error) {
      let apiMsg =
        error?.response?.data?.error ||
        error?.message ||
        'Something went wrong. Check your connection and API URL.';
      if (!error?.response && /network/i.test(String(apiMsg))) {
        apiMsg =
          'Cannot reach the hotel API. Start the backend (node backend, port 5000). On web use localhost; on a phone set EXPO_PUBLIC_API_URL in mobile-app/.env and restart Expo. Check the console for [api] baseURL.';
      }
      setSubmitError(apiMsg);
      Alert.alert('Registration Failed', apiMsg);
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
            <Text style={styles.title}>Create Guest Account</Text>
            <Text style={styles.subtitle}>Register to manage bookings, orders, and your profile.</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={C.textGray}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="Mobile (10 digits, e.g. 0712345678)"
              placeholderTextColor={C.textGray}
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={C.textGray}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <TextInput
              style={styles.input}
              placeholder="Password (min 8 chars, letter + number)"
              placeholderTextColor={C.textGray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
              textContentType="newPassword"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={C.textGray}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="password-new"
              textContentType="newPassword"
            />

            {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.gold} />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Already have an account? Sign In</Text>
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
  errorText: {
    color: '#b3261e',
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  buttonDisabled: { opacity: 0.75 },
});

export default RegisterScreen;
