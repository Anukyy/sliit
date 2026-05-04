import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useStaffAuth } from '../context/StaffAuthContext';

export default function ReviewManagerDashboardScreen() {
  const { profile, logout } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedReviewId, setSelectedReviewId] = useState('');
  const [edit, setEdit] = useState({
    rating: '5',
    adminReply: '',
  });

  const roleName = String(profile?.roleName || '').toLowerCase();
  const isReviewManager = roleName === 'review manager' || roleName === 'review_manager';

  const loadAll = useCallback(async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [r, a] = await Promise.all([
        api.get('/staff-portal/reviews'),
        api.get('/staff-portal/reviews/analytics'),
      ]);
      setReviews(Array.isArray(r.data) ? r.data : []);
      setAnalytics(a.data || null);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load review manager data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll({ silent: true });
    }, [loadAll])
  );

  const selectedReview = useMemo(
    () => reviews.find((r) => r._id === selectedReviewId) || null,
    [reviews, selectedReviewId]
  );

  useEffect(() => {
    if (!selectedReview) return;
    setEdit({
      rating: String(selectedReview.rating ?? 5),
      adminReply: selectedReview.adminReply || '',
    });
  }, [selectedReview]);

  const patchReview = async (id, body) => {
    try {
      await api.patch(`/staff-portal/reviews/${id}`, body);
      loadAll({ silent: true });
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update review');
    }
  };

  const saveSelectedReview = async () => {
    if (!selectedReview) return;
    await patchReview(selectedReview._id, {
      rating: Number(edit.rating) || 5,
      adminReply: edit.adminReply,
    });
  };

  const removeReview = async (id) => {
    try {
      await api.delete(`/staff-portal/reviews/${id}`);
      if (selectedReviewId === id) setSelectedReviewId('');
      loadAll({ silent: true });
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not delete review');
    }
  };

  const toggleReviewVisibility = (r) => {
    if (r.status === 'active') {
      patchReview(r._id, { status: 'removed', removedReason: 'Moderation action' });
    } else {
      patchReview(r._id, { status: 'active', removedReason: '' });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a96e" />
      </View>
    );
  }

  if (!isReviewManager) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access denied</Text>
        <Text style={styles.subtle}>This dashboard is only for Review Manager role.</Text>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Review Manager Dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Analytics overview</Text>
        <Text style={styles.itemSub}>Total: {analytics?.total ?? 0} | Active: {analytics?.activeCount ?? 0} | Removed: {analytics?.removedCount ?? 0}</Text>
        <Text style={styles.itemSub}>Avg Rating: {analytics?.avgRating ?? 0}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All reviews</Text>
        {reviews.map((r) => (
          <View key={r._id} style={styles.item}>
            <View style={styles.reviewRow}>
              <TouchableOpacity
                style={styles.reviewRowMain}
                onPress={() => setSelectedReviewId(r._id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select review ${r.customerNumber || ''}`}
              >
                <Text style={styles.itemTitle}>
                  #{r.customerNumber}
                  {typeof r.customer === 'object' && r.customer?.name ? ` · ${r.customer.name}` : ''}
                  {' · '}
                  {r.rating}★ · {r.status}
                </Text>
                <Text style={styles.itemSub}>{r.text}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reviewHideBtn}
                onPress={() => toggleReviewVisibility(r)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={r.status === 'active' ? 'Hide review' : 'Show review'}
              >
                <Text style={styles.reviewHideBtnText}>
                  {r.status === 'active' ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {selectedReview && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Selected Review</Text>
          <TextInput style={styles.input} placeholder="Rating 1-5" keyboardType="numeric" value={edit.rating} onChangeText={(v) => setEdit((s) => ({ ...s, rating: v }))} />
          <TextInput style={styles.input} placeholder="Admin reply" value={edit.adminReply} onChangeText={(v) => setEdit((s) => ({ ...s, adminReply: v }))} />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={saveSelectedReview}>
              <Text style={styles.btnText}>Save Update</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => patchReview(selectedReview._id, { status: selectedReview.status === 'active' ? 'removed' : 'active', removedReason: 'Moderation action' })}>
              <Text style={styles.secondaryBtnText}>{selectedReview.status === 'active' ? 'Hide Review' : 'Restore Review'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={() => removeReview(selectedReview._id)}>
              <Text style={styles.btnText}>Delete Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 16, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f0e8', padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#3d2b1f', marginBottom: 6 },
  subtle: { color: '#6b6b6b', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3d2b1f', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  btn: { backgroundColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center' },
  secondaryBtn: { borderWidth: 1, borderColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center' },
  dangerBtn: { backgroundColor: '#b42318', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnText: { color: '#c9a96e', fontWeight: '700' },
  secondaryBtnText: { color: '#3d2b1f', fontWeight: '700' },
  item: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8 },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reviewRowMain: { flex: 1, minWidth: 0 },
  reviewHideBtn: {
    borderWidth: 1,
    borderColor: '#3d2b1f',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  reviewHideBtnText: { color: '#3d2b1f', fontWeight: '800', fontSize: 12 },
  itemTitle: { color: '#2a2a2a', fontWeight: '700' },
  itemSub: { color: '#6b6b6b', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
});
