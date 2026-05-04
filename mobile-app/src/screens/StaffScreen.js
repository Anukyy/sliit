import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import api from '../api/axios';

export default function StaffScreen() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await api.get('/staff');
      setStaffList(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch staff directory');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!name || !position || !email || !phone || !salary) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      const newStaff = {
        name,
        position,
        email,
        phone,
        salary: Number(salary)
      };
      
      await api.post('/staff', newStaff);
      Alert.alert('Success', 'Staff member added');
      setModalVisible(false);
      
      // Reset form
      setName('');
      setPosition('');
      setEmail('');
      setPhone('');
      setSalary('');
      
      fetchStaff();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add staff');
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Remove Staff', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/staff/${id}`);
            fetchStaff();
          } catch (error) {
            Alert.alert('Error', 'Failed to remove staff');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardBadge}>{item.position}</Text>
      </View>
      <Text style={styles.cardText}>Email: {item.email}</Text>
      <Text style={styles.cardText}>Phone: {item.phone}</Text>
      <Text style={styles.cardText}>Salary: ${item.salary}</Text>
      
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item._id)}>
        <Text style={styles.deleteBtnText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.addBtnText}>+ Add Staff Member</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#c9a96e" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={staffList}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No staff members listed.</Text>}
        />
      )}

      {/* ADD STAFF MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>
            
            <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Position (e.g. Manager)" value={position} onChangeText={setPosition} />
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Salary" value={salary} onChangeText={setSalary} keyboardType="numeric" />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddStaff}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#3d2b1f' },
  cardBadge: { backgroundColor: '#e8e0d5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, color: '#3d2b1f', fontSize: 12, overflow: 'hidden' },
  cardText: { fontSize: 14, color: '#6b6b6b', marginBottom: 4 },
  deleteBtn: { marginTop: 12, alignItems: 'flex-end' },
  deleteBtnText: { color: '#dc3545', fontWeight: 'bold' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#3d2b1f', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e8e0d5', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e8e0d5', borderRadius: 8, marginRight: 8 },
  cancelBtnText: { color: '#6b6b6b', fontWeight: 'bold' },
  saveBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#3d2b1f', borderRadius: 8, marginLeft: 8 },
  saveBtnText: { color: '#c9a96e', fontWeight: 'bold' },
});
