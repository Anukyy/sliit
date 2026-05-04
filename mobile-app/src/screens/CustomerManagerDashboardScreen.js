import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../api/axios';
import { useStaffAuth } from '../context/StaffAuthContext';

export default function CustomerManagerDashboardScreen() {
  const { profile, logout } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedDetails, setSelectedDetails] = useState(null);

  const [profileEdit, setProfileEdit] = useState({
    name: '',
    phone: '',
    email: '',
    preferredRoomType: '',
    preferredFood: '',
  });
  const [pointsDelta, setPointsDelta] = useState('10');

  const roleName = String(profile?.roleName || '').toLowerCase();
  const isCustomerManager = roleName === 'customer manager' || roleName === 'customer_manager';

  const loadBase = useCallback(async () => {
    try {
      const c = await api.get('/staff-portal/customers');
      setCustomers(Array.isArray(c.data) ? c.data : []);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load customer manager data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetails = useCallback(async (customerId) => {
    if (!customerId) return;
    try {
      const res = await api.get(`/staff-portal/customers/${customerId}/details`);
      setSelectedDetails(res.data || null);
      const c = res.data?.customer;
      if (c) {
        setProfileEdit({
          name: c.name || '',
          phone: c.phone || '',
          email: c.email || '',
          preferredRoomType: c.preferredRoomType || '',
          preferredFood: c.preferredFood || '',
        });
      }
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load customer details');
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (selectedCustomerId) {
      loadDetails(selectedCustomerId);
    }
  }, [selectedCustomerId, loadDetails]);

  const setCustomerActive = async (id, active) => {
    try {
      await api.patch(`/staff-portal/customers/${id}`, { active });
      loadBase();
      if (selectedCustomerId === id) loadDetails(id);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update customer status');
    }
  };

  const updateCustomerProfile = async () => {
    if (!selectedCustomerId) return;
    try {
      await api.patch(`/staff-portal/customers/${selectedCustomerId}`, profileEdit);
      loadBase();
      loadDetails(selectedCustomerId);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update profile');
    }
  };

  const addLoyaltyPoints = async () => {
    if (!selectedCustomerId) return;
    try {
      await api.post(`/staff-portal/customers/${selectedCustomerId}/loyalty-points`, {
        pointsDelta: Number(pointsDelta) || 0,
      });
      loadBase();
      loadDetails(selectedCustomerId);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update loyalty points');
    }
  };

  const removePreferences = async () => {
    if (!selectedCustomerId) return;
    try {
      await api.delete(`/staff-portal/customers/${selectedCustomerId}/preferences`);
      loadDetails(selectedCustomerId);
      loadBase();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not remove preferences');
    }
  };

  const deleteCustomer = async (id) => {
    try {
      await api.delete(`/staff-portal/customers/${id}`);
      if (selectedCustomerId === id) {
        setSelectedCustomerId('');
        setSelectedDetails(null);
      }
      loadBase();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not delete customer account');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a96e" />
      </View>
    );
  }

  if (!isCustomerManager) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access denied</Text>
        <Text style={styles.subtle}>This dashboard is only for Customer Manager role.</Text>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Customer Manager Dashboard</Text>
      <Text style={styles.subtle}>Manage customer accounts, preferences, issues, notifications, and loyalty points.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer Accounts</Text>
        {customers.map((c) => (
          <TouchableOpacity key={c._id} style={styles.item} onPress={() => setSelectedCustomerId(c._id)}>
            <Text style={styles.itemTitle}>#{c.customerNumber} · {c.email}</Text>
            <Text style={styles.itemSub}>{c.active ? 'Active' : 'Disabled'} | Loyalty: {Number(c.loyaltyPoints) || 0}</Text>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setCustomerActive(c._id, !c.active)}>
                <Text style={styles.link}>{c.active ? 'Disable' : 'Enable'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteCustomer(c._id)}>
                <Text style={styles.delete}>Delete account</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {selectedDetails && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected Profile</Text>
          <TextInput style={styles.input} placeholder="Name" value={profileEdit.name} onChangeText={(v) => setProfileEdit((s) => ({ ...s, name: v }))} />
          <TextInput style={styles.input} placeholder="Phone" value={profileEdit.phone} onChangeText={(v) => setProfileEdit((s) => ({ ...s, phone: v }))} />
          <TextInput style={styles.input} placeholder="Email" value={profileEdit.email} onChangeText={(v) => setProfileEdit((s) => ({ ...s, email: v }))} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Preferred room type" value={profileEdit.preferredRoomType} onChangeText={(v) => setProfileEdit((s) => ({ ...s, preferredRoomType: v }))} />
          <TextInput style={styles.input} placeholder="Preferred food" value={profileEdit.preferredFood} onChangeText={(v) => setProfileEdit((s) => ({ ...s, preferredFood: v }))} />
          <TouchableOpacity style={styles.btn} onPress={updateCustomerProfile}>
            <Text style={styles.btnText}>Update Profile</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Points delta (+/-)" keyboardType="numeric" value={pointsDelta} onChangeText={setPointsDelta} />
            <TouchableOpacity style={styles.btnSmall} onPress={addLoyaltyPoints}>
              <Text style={styles.btnText}>Add Points</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.secondaryBtn} onPress={removePreferences}>
            <Text style={styles.secondaryBtnText}>Remove Saved Preferences</Text>
          </TouchableOpacity>

          <Text style={styles.subHeader}>Bookings & Payments / Invoices</Text>
          {(selectedDetails.bookings || []).map((b) => (
            <Text key={b._id} style={styles.itemSub}>
              Booking #{String(b._id)} · Room {b.room?.roomNumber || '-'} · LKR {Math.round(Number(b.totalAmount) || 0)} · {b.status}
            </Text>
          ))}
          <Text style={styles.itemSub}>
            Invoice Total: LKR {Math.round(Number(selectedDetails?.invoices?.grandTotal) || 0)}
          </Text>

          <Text style={styles.subHeader}>Issue Status</Text>
          {(selectedDetails.issues || []).map((i) => (
            <Text key={i._id} style={styles.itemSub}>
              Room {i.room?.roomNumber || '-'} · {i.issueType} · {i.priority} · {i.status}
            </Text>
          ))}

          <Text style={styles.subHeader}>Notifications</Text>
          {(selectedDetails.notifications || []).slice(0, 20).map((n) => (
            <Text key={n._id} style={styles.itemSub}>
              {n.title}: {n.message}
            </Text>
          ))}
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
  subHeader: { marginTop: 10, marginBottom: 6, color: '#3d2b1f', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  btn: { backgroundColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 2 },
  btnSmall: { backgroundColor: '#3d2b1f', borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  btnText: { color: '#c9a96e', fontWeight: '700' },
  secondaryBtn: { marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3d2b1f' },
  secondaryBtnText: { color: '#3d2b1f', fontWeight: '700', textAlign: 'center' },
  item: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8 },
  itemTitle: { color: '#2a2a2a', fontWeight: '700' },
  itemSub: { color: '#6b6b6b', marginTop: 2 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' },
  link: { color: '#1f6feb', fontWeight: '600' },
  delete: { color: '#b42318', fontWeight: '700' },
});
