import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api, { setAuthToken } from '../api/axios';
import { useCustomerAuth } from '../context/CustomerAuthContext';

const toLabel = (v) => {
  const s = String(v || 'menu');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function FoodScreen({ navigation }) {
  const { customer, isAuthenticated, token: customerToken } = useCustomerAuth();
  const [foodItems, setFoodItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchFood();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (customerToken) setAuthToken('customer', customerToken);
    }, [customerToken])
  );

  const fetchFood = async () => {
    try {
      const response = await api.get('/public/food-items');
      setFoodItems(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch food items');
    } finally {
      setLoading(false);
    }
  };

  const lines = useMemo(() => {
    return Object.entries(quantities)
      .map(([foodItemId, quantity]) => ({ foodItemId, quantity: Number(quantity) || 0 }))
      .filter((x) => x.quantity > 0);
  }, [quantities]);

  const total = useMemo(() => {
    const byId = new Map(foodItems.map((f) => [String(f._id), f]));
    return lines.reduce((sum, line) => {
      const item = byId.get(String(line.foodItemId));
      return sum + (Math.round(Number(item?.price) || 0) * line.quantity);
    }, 0);
  }, [foodItems, lines]);

  const updateQty = (id, delta) => {
    setQuantities((prev) => {
      const current = Number(prev[id] || 0);
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const placeOrder = async () => {
    if (!isAuthenticated || !customer) {
      Alert.alert('Sign in required', 'You can browse meals, but please sign in before ordering.');
      navigation.navigate('Login');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('Cart empty', 'Select at least one menu item.');
      return;
    }

    setSubmitting(true);
    try {
      if (!customerToken) {
        Alert.alert('Sign in required', 'Your session expired. Please sign in again.');
        navigation.navigate('Login');
        return;
      }
      setAuthToken('customer', customerToken);
      await api.post('/customer-auth/food-orders', {
        lines,
        // Allow ordering even before check-in; kitchen will still receive the order.
        paymentMethod: 'cash',
      });
      setQuantities({});
      navigation.navigate('Home');
    } catch (error) {
      const msg =
        error?.response?.data?.error ||
        error?.message ||
        (error?.request ? 'Could not reach server. Check Wi‑Fi / API URL.' : null) ||
        'Failed to place order';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardBadge}>{toLabel(item.category)}</Text>
      </View>
      <Text style={styles.cardText}>{item.description}</Text>
      <Text style={styles.cardText}>Price: LKR {Math.round(Number(item.price) || 0)}</Text>

      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item._id, -1)}>
          <Text style={styles.qtyBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{Number(quantities[item._id] || 0)}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item._id, 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerStrip}>
        <Text style={styles.headerText}>Restaurant Menu</Text>
        <Text style={styles.helperText}>
          {isAuthenticated ? 'Signed in - you can place orders.' : 'Browse meals. Sign in required before ordering.'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#c9a96e" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={foodItems}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Menu is empty.</Text>}
        />
      )}
      <View style={styles.checkoutBar}>
        <Text style={styles.checkoutText}>Items: {lines.length} | Total: LKR {total}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={placeOrder} disabled={submitting}>
          <Text style={styles.saveBtnText}>{submitting ? 'Placing...' : 'Place Order'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  headerStrip: { backgroundColor: '#3d2b1f', paddingHorizontal: 16, paddingVertical: 12 },
  headerText: { color: '#c9a96e', fontWeight: '800', fontSize: 18 },
  helperText: { color: '#e8e0d5', marginTop: 4, fontSize: 12 },
  list: { padding: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6b6b6b', fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#3d2b1f' },
  cardBadge: { backgroundColor: '#e8e0d5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, color: '#3d2b1f', fontSize: 12, overflow: 'hidden' },
  cardText: { fontSize: 14, color: '#6b6b6b', marginBottom: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#3d2b1f', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: '#c9a96e', fontWeight: '700', fontSize: 18, lineHeight: 20 },
  qtyValue: { minWidth: 20, textAlign: 'center', color: '#3d2b1f', fontWeight: '700' },
  checkoutBar: {
    borderTopWidth: 1,
    borderTopColor: '#e8e0d5',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  checkoutText: { color: '#3d2b1f', fontWeight: '700', marginBottom: 8 },
  saveBtn: { padding: 14, alignItems: 'center', backgroundColor: '#3d2b1f', borderRadius: 8 },
  saveBtnText: { color: '#c9a96e', fontWeight: 'bold' },
});
