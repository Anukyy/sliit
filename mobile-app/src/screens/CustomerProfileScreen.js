import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import api, { setAuthToken } from '../api/axios';

const C = {
  warmWhite: '#faf8f5',
  darkBrown: '#3d2b1f',
  gold: '#c9a96e',
  textGray: '#6b6b6b',
  lightGray: '#e8e0d5',
  brown: '#8b6f5e',
};

export default function CustomerProfileScreen({ navigation }) {
  const { customer, isAuthenticated, fetchMe, logout, token: customerToken } = useCustomerAuth();
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editSpecialRequests, setEditSpecialRequests] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingId, setCancellingId] = useState('');

  const loadBookings = useCallback(async () => {
    if (!isAuthenticated || !customerToken) {
      setBookings([]);
      return;
    }
    try {
      setBookingsLoading(true);
      setAuthToken('customer', customerToken);
      const res = await api.get('/customer-auth/bookings');
      setBookings(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      Alert.alert('Bookings error', e?.response?.data?.error || 'Could not load your bookings');
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, [isAuthenticated, customerToken]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      if (customerToken) {
        setAuthToken('customer', customerToken);
      }
      await fetchMe();
      await loadBookings();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not load your profile');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchMe, customerToken, loadBookings]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const normalizedBookings = useMemo(
    () => bookings.map((b) => ({ ...b, _id: String(b?._id || b?.id || '') })),
    [bookings]
  );

  const doSignOut = useCallback(() => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [logout, navigation]);

  const onSignOut = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm('Sign out of your guest account?')) {
        doSignOut();
      }
      return;
    }
    Alert.alert('Sign out', 'Sign out of your guest account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: doSignOut },
    ]);
  };

  const openEditSpecial = (booking) => {
    setEditingBooking(booking);
    setEditSpecialRequests(String(booking?.specialRequests || ''));
  };

  const closeEditSpecial = () => {
    setEditingBooking(null);
    setEditSpecialRequests('');
    setSavingEdit(false);
  };

  const saveEditSpecial = async () => {
    const bookingId = String(editingBooking?._id || '');
    if (!bookingId || !customerToken) return;
    try {
      setSavingEdit(true);
      setAuthToken('customer', customerToken);
      await api.patch(`/customer-auth/bookings/${bookingId}`, {
        specialRequests: editSpecialRequests.trim(),
      });
      closeEditSpecial();
      await loadBookings();
      Alert.alert('Updated', 'Special requests updated successfully.');
    } catch (e) {
      Alert.alert('Update failed', e?.response?.data?.error || 'Could not update special requests');
    } finally {
      setSavingEdit(false);
    }
  };

  const onDeleteReservation = (booking) => {
    const bookingId = String(booking?._id || '');
    if (!bookingId) return;
    if (!customerToken) {
      Alert.alert('Sign in required', 'Please sign in again and try.');
      return;
    }
    const status = String(booking?.status || '').toLowerCase();
    const cancelStatus = String(booking?.cancellationRequestStatus || 'none').toLowerCase();
    if (status === 'cancelled') {
      Alert.alert('Not allowed', 'This reservation is already cancelled.');
      return;
    }
    if (cancelStatus === 'pending') {
      Alert.alert('Not allowed', 'Cancellation request is already pending staff review.');
      return;
    }
    if (booking?.checkedInAt) {
      Alert.alert('Not allowed', 'You cannot delete a reservation after check-in.');
      return;
    }

    const performCancel = async () => {
      try {
        setCancellingId(bookingId);
        setAuthToken('customer', customerToken);
        await api.post(`/customer-auth/bookings/${bookingId}/cancel`, {
          cancellationReason: 'Guest requested cancellation from profile.',
        });
        await loadBookings();
        Alert.alert('Requested', 'Cancellation request sent.');
      } catch (e) {
        Alert.alert('Delete failed', e?.response?.data?.error || 'Could not delete reservation');
      } finally {
        setCancellingId('');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm('Delete this reservation? This sends a cancellation request.')) {
        performCancel();
      }
      return;
    }

    Alert.alert('Delete reservation', 'This sends a cancellation request for this reservation.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performCancel },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in to see your profile</Text>
        <Text style={styles.emptySub}>View your guest details, ID, and preferences.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryBtnText}>Guest Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.ghostBtnText}>Create account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !customer) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.darkBrown} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Maison Velour</Text>
        <Text style={styles.name}>{customer?.name || 'Guest'}</Text>
        <Text style={styles.guestId}>Guest ID · #{customer?.customerNumber ?? '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Contact</Text>
        <Row label="Email" value={customer?.email || '—'} />
        <Row label="Phone" value={customer?.phone || '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Loyalty</Text>
        <Row label="Points" value={String(customer?.loyaltyPoints ?? 0)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>My Reservations</Text>
        {bookingsLoading ? (
          <View style={styles.resLoadingWrap}>
            <ActivityIndicator size="small" color={C.darkBrown} />
            <Text style={styles.resMeta}>Loading your reservations...</Text>
          </View>
        ) : normalizedBookings.length === 0 ? (
          <Text style={styles.resMeta}>No reservations yet.</Text>
        ) : (
          normalizedBookings.map((b) => {
            const isCancelled = String(b.status || '').toLowerCase() === 'cancelled';
            const pendingCancel = String(b.cancellationRequestStatus || '').toLowerCase() === 'pending';
            const canMutate = !isCancelled && !pendingCancel && !b.checkedInAt;
            return (
              <View key={b._id} style={styles.resCard}>
                <Text style={styles.resTitle}>{b.summaryLine || 'Reservation'}</Text>
                <Text style={styles.resMeta}>ID: {b._id}</Text>
                <Text style={styles.resMeta}>
                  {String(b.checkIn || '').slice(0, 10)} to {String(b.checkOut || '').slice(0, 10)}
                </Text>
                <Text style={styles.resMeta}>Status: {b.status || 'pending'}</Text>
                <Text style={styles.resMeta}>
                  Special request: {b.specialRequests?.trim() ? b.specialRequests : 'None'}
                </Text>
                <View style={styles.resActions}>
                  <TouchableOpacity
                    style={[styles.resBtn, !canMutate && styles.resBtnDisabled]}
                    disabled={!canMutate}
                    onPress={() => openEditSpecial(b)}
                  >
                    <Text style={styles.resBtnText}>Edit Special Info</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.resDeleteBtn, cancellingId === b._id && styles.resBtnDisabled]}
                    disabled={cancellingId === b._id}
                    onPress={() => onDeleteReservation(b)}
                  >
                    <Text style={styles.resDeleteBtnText}>
                      {cancellingId === b._id ? 'Deleting...' : 'Delete Reservation'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {pendingCancel && <Text style={styles.pendingNote}>Cancellation request pending staff review.</Text>}
              </View>
            );
          })
        )}
      </View>

      {(customer?.profileFirstName || customer?.profileLastName) && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Profile</Text>
          {!!customer?.profileFirstName && <Row label="First name" value={customer.profileFirstName} />}
          {!!customer?.profileLastName && <Row label="Last name" value={customer.profileLastName} />}
        </View>
      )}

      <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.homeBtnText}>Back to home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Modal visible={Boolean(editingBooking)} transparent animationType="fade" onRequestClose={closeEditSpecial}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Special Info</Text>
            <Text style={styles.modalSub}>Update your reservation special requests.</Text>
            <TextInput
              style={styles.modalInput}
              value={editSpecialRequests}
              onChangeText={setEditSpecialRequests}
              placeholder="Any special request..."
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={closeEditSpecial} disabled={savingEdit}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingEdit && styles.resBtnDisabled]}
                onPress={saveEditSpecial}
                disabled={savingEdit}
              >
                <Text style={styles.modalSaveText}>{savingEdit ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f0e8',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.darkBrown, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: C.textGray, textAlign: 'center', marginBottom: 24 },
  loadingText: { marginTop: 12, color: C.textGray },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.lightGray,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.brown,
    fontWeight: '700',
    marginBottom: 8,
  },
  name: { fontSize: 26, fontWeight: '800', color: C.darkBrown },
  guestId: { fontSize: 14, color: C.textGray, marginTop: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.darkBrown,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: { marginBottom: 12 },
  rowLabel: { fontSize: 12, color: C.textGray, marginBottom: 4 },
  rowValue: { fontSize: 16, color: '#2a2a2a', fontWeight: '600' },
  resLoadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resCard: {
    borderWidth: 1,
    borderColor: C.lightGray,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  resTitle: { fontSize: 15, fontWeight: '700', color: C.darkBrown, marginBottom: 4 },
  resMeta: { fontSize: 13, color: C.textGray, marginBottom: 4 },
  resActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  resBtn: {
    flex: 1,
    backgroundColor: C.darkBrown,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resBtnText: { color: C.gold, fontWeight: '700', fontSize: 12 },
  resDeleteBtn: {
    flex: 1,
    backgroundColor: '#b42318',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resDeleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  resBtnDisabled: { opacity: 0.55 },
  pendingNote: { marginTop: 6, color: '#92400e', fontSize: 12, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: C.darkBrown,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryBtnText: { color: C.gold, fontWeight: '700', fontSize: 16 },
  ghostBtn: { paddingVertical: 10 },
  ghostBtnText: { color: C.brown, fontWeight: '600', fontSize: 15 },
  homeBtn: {
    backgroundColor: C.darkBrown,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  homeBtnText: { color: C.gold, fontWeight: '700', fontSize: 16 },
  signOutBtn: { alignItems: 'center', padding: 16, marginTop: 8 },
  signOutText: { color: '#b42318', fontWeight: '700', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.darkBrown },
  modalSub: { fontSize: 13, color: C.textGray, marginTop: 4, marginBottom: 10 },
  modalInput: {
    borderWidth: 1,
    borderColor: C.lightGray,
    borderRadius: 8,
    padding: 10,
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: C.warmWhite,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  modalGhostBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  modalGhostText: { color: C.brown, fontWeight: '700' },
  modalSaveBtn: {
    backgroundColor: C.darkBrown,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalSaveText: { color: C.gold, fontWeight: '700' },
});
