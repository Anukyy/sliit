import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useStaffAuth } from '../context/StaffAuthContext';

export default function ReceptionistDashboardScreen() {
  const { profile, logout } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const roleName = String(profile?.roleName || '').toLowerCase();
  const isReceptionist = roleName === 'receptionist';

  const loadBookings = useCallback(async () => {
    try {
      const res = await api.get('/staff-portal/bookings');
      setBookings(Array.isArray(res.data) ? res.data : []);
      setLastLoadedAt(new Date());
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a96e" />
      </View>
    );
  }

  if (!isReceptionist) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access denied</Text>
        <Text style={styles.subtle}>This dashboard is only for Receptionist role.</Text>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Receptionist Dashboard</Text>
      <Text style={styles.subtle}>All reservations are listed here.</Text>
      <View style={styles.topRow}>
        <Text style={styles.countText}>Total reservations loaded: {bookings.length}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadBookings}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {!!lastLoadedAt && (
        <Text style={styles.lastLoadedText}>Last updated: {lastLoadedAt.toLocaleString()}</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All Bookings</Text>
        {bookings.length === 0 ? (
          <Text style={styles.itemSub}>No reservations found.</Text>
        ) : (
          bookings.map((b) => (
            <View key={b._id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Booking #{String(b._id)}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    String(b.status || '').toLowerCase() === 'cancelled'
                      ? styles.statusCancelled
                      : String(b.cancellationRequestStatus || '').toLowerCase() === 'pending'
                        ? styles.statusCancelPending
                        : styles.statusNormal,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {String(b.status || '').toLowerCase() === 'cancelled'
                      ? 'CANCELLED'
                      : String(b.cancellationRequestStatus || '').toLowerCase() === 'pending'
                        ? 'CANCELLATION REQUESTED'
                        : String(b.status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemSub}>
                Guest: {b.fullName || b.customer?.email || 'Guest'} | {b.contactEmail || b.customer?.email || '-'}
              </Text>
              <Text style={styles.itemSub}>
                Stay: {b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '-'} to {b.checkOut ? new Date(b.checkOut).toLocaleDateString() : '-'}
              </Text>
              <Text style={styles.itemSub}>
                Room/Offer: {b.room?.roomNumber ? `Room ${b.room.roomNumber}` : b.offer?.title || '-'}
              </Text>
              {String(b.cancellationRequestStatus || '').toLowerCase() === 'pending' && (
                <Text style={styles.cancelInfo}>
                  Cancellation reason: {b.cancellationReason || 'No reason provided'}
                </Text>
              )}
              {String(b.status || '').toLowerCase() === 'cancelled' && (
                <Text style={styles.cancelInfo}>
                  Cancelled at: {b.cancelledAt ? new Date(b.cancelledAt).toLocaleString() : 'N/A'}
                </Text>
              )}
              <Text style={styles.itemSub}>Total: LKR {Math.round(Number(b.totalAmount) || 0)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f0e8', padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#3d2b1f', marginBottom: 6 },
  subtle: { color: '#6b6b6b', marginBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  countText: { color: '#3d2b1f', fontWeight: '700' },
  refreshBtn: { backgroundColor: '#3d2b1f', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  refreshBtnText: { color: '#c9a96e', fontWeight: '700' },
  lastLoadedText: { color: '#6b6b6b', marginBottom: 10, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3d2b1f', marginBottom: 8 },
  item: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { color: '#2a2a2a', fontWeight: '700' },
  itemSub: { color: '#6b6b6b', marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusNormal: { backgroundColor: '#e8e0d5' },
  statusCancelPending: { backgroundColor: '#fef3c7' },
  statusCancelled: { backgroundColor: '#fee2e2' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', color: '#3d2b1f' },
  cancelInfo: { color: '#9a3412', marginTop: 4, fontWeight: '600' },
  btn: { backgroundColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnText: { color: '#c9a96e', fontWeight: '700' },
});

