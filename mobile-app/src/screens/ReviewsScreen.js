import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api, { setAuthToken } from '../api/axios';
import { useCustomerAuth } from '../context/CustomerAuthContext';

function StarRating({ rating, onRate, size = 26 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRate?.(star)} activeOpacity={0.7}>
          <Text style={{ fontSize: size, color: star <= rating ? '#c9a96e' : '#e8e0d5' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const navigation = useNavigation();
  const { customer, isAuthenticated, token: customerToken } = useCustomerAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const customerId = customer?._id != null ? String(customer._id) : customer?.id != null ? String(customer.id) : '';

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/public/reviews', { params: { limit: 100 } });
      setReviews(Array.isArray(res.data) ? res.data : []);
    } catch {
      Alert.alert('Error', 'Could not load reviews.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (customerToken) setAuthToken('customer', customerToken);
      fetchReviews();
    }, [customerToken, fetchReviews])
  );

  const openAddModal = () => {
    if (!isAuthenticated || !customerToken) {
      Alert.alert('Sign in required', 'Please sign in as a guest to write a review.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    setReviewName(String(customer?.name || '').trim());
    setReviewRating(0);
    setReviewText('');
    setModalVisible(true);
  };

  const submitReview = async () => {
    const text = reviewText.trim();
    const name = reviewName.trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (!name) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }
    if (!reviewRating) {
      Alert.alert('Rating', 'Please choose a star rating.');
      return;
    }
    if (words.length < 5) {
      Alert.alert('Too short', 'Please write at least 5 words.');
      return;
    }
    try {
      setAuthToken('customer', customerToken);
      await api.post('/customer-auth/reviews', {
        text,
        rating: reviewRating,
        reviewerName: name,
        category: 'other',
      });
      Alert.alert('Thanks!', 'Your review was submitted.');
      setModalVisible(false);
      fetchReviews();
    } catch (e) {
      Alert.alert('Could not submit', e?.response?.data?.error || 'Try again later.');
    }
  };

  const deleteMine = (item) => {
    const id = item._id;
    Alert.alert('Remove review', 'Hide this review from guests?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setAuthToken('customer', customerToken);
            await api.delete(`/customer-auth/reviews/${id}`);
            fetchReviews();
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.error || 'Could not remove review.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const cid = item.customer != null ? String(item.customer) : '';
    const isMine = Boolean(customerId && cid === customerId);
    const displayName =
      (item.reviewerName && String(item.reviewerName).trim()) || `Guest #${item.customerNumber ?? ''}`;
    const filled = '★'.repeat(Number(item.rating) || 0);
    const empty = '☆'.repeat(5 - (Number(item.rating) || 0));
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{displayName}</Text>
          <Text style={styles.cardBadge}>Guest</Text>
        </View>
        <Text style={styles.cardStars}>{filled}{empty}</Text>
        <Text style={styles.cardText}>"{item.text}"</Text>
        <Text style={styles.cardDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</Text>
        {isMine ? (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteMine(item)}>
            <Text style={styles.deleteBtnText}>Remove my review</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
        <Text style={styles.addBtnText}>+ Write a review</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#c9a96e" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={reviews}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No reviews yet.</Text>}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Write a review</Text>
              <Text style={styles.label}>Your name</Text>
              <TextInput style={styles.input} value={reviewName} onChangeText={setReviewName} placeholder="Name" />
              <Text style={styles.label}>Rating</Text>
              <StarRating rating={reviewRating} onRate={setReviewRating} />
              <Text style={styles.label}>Your experience</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="At least 5 words…"
                multiline
                textAlignVertical="top"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={submitReview}>
                  <Text style={styles.saveBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  addBtn: { backgroundColor: '#3d2b1f', padding: 16, alignItems: 'center' },
  addBtnText: { color: '#c9a96e', fontWeight: 'bold', fontSize: 16 },
  list: { padding: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6b6b6b', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#3d2b1f', flex: 1 },
  cardBadge: {
    backgroundColor: '#e8e0d5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: '#3d2b1f',
    fontSize: 11,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  cardStars: { color: '#c9a96e', fontSize: 14, marginBottom: 6 },
  cardText: { fontSize: 15, color: '#6b6b6b', marginBottom: 8, fontStyle: 'italic' },
  cardDate: { fontSize: 12, color: '#aaa' },
  deleteBtn: { marginTop: 12, alignSelf: 'flex-end' },
  deleteBtnText: { color: '#dc3545', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#3d2b1f', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: '#3d2b1f', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#e8e0d5', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 16 },
  textarea: { minHeight: 100 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e0d5',
    borderRadius: 8,
    marginRight: 8,
  },
  cancelBtnText: { color: '#6b6b6b', fontWeight: 'bold' },
  saveBtn: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#3d2b1f',
    borderRadius: 8,
    marginLeft: 8,
  },
  saveBtnText: { color: '#c9a96e', fontWeight: 'bold' },
});
