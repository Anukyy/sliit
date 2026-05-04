import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../api/axios';
import { useStaffAuth } from '../context/StaffAuthContext';

export default function RoomManagerDashboardScreen() {
  const { profile, logout } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [offers, setOffers] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [detail, setDetail] = useState(null);

  const [newOffer, setNewOffer] = useState({
    title: '',
    description: '',
    packagePrice: '0',
    roomIdsCsv: '',
  });
  const [selectedOfferRoomIds, setSelectedOfferRoomIds] = useState([]);
  const [editingOfferId, setEditingOfferId] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  const roleName = String(profile?.roleName || '').toLowerCase();
  const isRoomManager = roleName === 'room manager' || roleName === 'room_manager';

  const loadAll = useCallback(async () => {
    try {
      const [roomsRes, offersRes] = await Promise.all([
        api.get('/staff-portal/rooms'),
        api.get('/staff-portal/offers'),
      ]);
      setRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);
      setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load room manager data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      const res = await api.get(`/staff-portal/rooms/${roomId}`);
      setDetail(res.data || null);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load room detail');
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selectedRoomId) loadDetail(selectedRoomId);
  }, [selectedRoomId, loadDetail]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r._id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  );

  const updateSelectedRoom = async () => {
    if (!selectedRoom) return;
    try {
      await api.patch(`/staff-portal/rooms/${selectedRoom._id}`, {
        status: selectedRoom.status,
        description: selectedRoom.description || '',
        basePricePerNight: Number(selectedRoom.basePricePerNight) || 0,
      });
      loadAll();
      loadDetail(selectedRoom._id);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update room');
    }
  };

  const createOrUpdateOffer = async () => {
    try {
      const title = newOffer.title.trim();
      if (!title) {
        Alert.alert('Error', 'Offer title is required');
        return;
      }
      const roomIdsFromCsv = newOffer.roomIdsCsv
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const roomIds = selectedOfferRoomIds.length > 0 ? selectedOfferRoomIds : roomIdsFromCsv;
      if (roomIds.length === 0) {
        Alert.alert('Error', 'Select at least one room for the offer');
        return;
      }

      if (editingOfferId) {
        await api.patch(`/staff-portal/offers/${editingOfferId}`, {
          title,
          description: newOffer.description.trim(),
          packagePrice: Number(newOffer.packagePrice) || 0,
          roomIds,
        });
      } else {
        await api.post('/staff-portal/offers', {
          title,
          description: newOffer.description.trim(),
          packagePrice: Number(newOffer.packagePrice) || 0,
          roomIds,
        });
      }
      setNewOffer({ title: '', description: '', packagePrice: '0', roomIdsCsv: '' });
      setSelectedOfferRoomIds([]);
      setEditingOfferId('');
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not save offer');
    }
  };

  const editOffer = (offer) => {
    const ids = Array.isArray(offer?.rooms)
      ? offer.rooms.map((r) => (typeof r === 'string' ? r : r?._id)).filter(Boolean)
      : [];
    setEditingOfferId(String(offer._id || ''));
    setSelectedOfferRoomIds(ids);
    setNewOffer({
      title: offer.title || '',
      description: offer.description || '',
      packagePrice: String(Math.round(Number(offer.packagePrice) || 0)),
      roomIdsCsv: ids.join(','),
    });
  };

  const deleteOffer = async (offerId) => {
    try {
      await api.delete(`/staff-portal/offers/${offerId}`);
      if (editingOfferId === String(offerId)) {
        setEditingOfferId('');
        setSelectedOfferRoomIds([]);
        setNewOffer({ title: '', description: '', packagePrice: '0', roomIdsCsv: '' });
      }
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not delete offer');
    }
  };

  const addRoomPhotoByUrl = async () => {
    if (!selectedRoomId) return;
    try {
      if (!newPhotoUrl.trim()) {
        Alert.alert('Error', 'Photo URL is required');
        return;
      }
      await api.post(`/staff-portal/rooms/${selectedRoomId}/photos-by-url`, {
        url: newPhotoUrl.trim(),
      });
      setNewPhotoUrl('');
      loadDetail(selectedRoomId);
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not add room photo');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#c9a96e" />
      </View>
    );
  }

  if (!isRoomManager) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Access denied</Text>
        <Text style={styles.subtle}>This dashboard is for Room Manager role only.</Text>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Room Manager Dashboard</Text>
      <Text style={styles.subtle}>Manage rooms and room packages.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Offer (LKR)</Text>
        <TextInput style={styles.input} placeholder="Offer title" value={newOffer.title} onChangeText={(v) => setNewOffer((s) => ({ ...s, title: v }))} />
        <TextInput style={styles.input} placeholder="Description" value={newOffer.description} onChangeText={(v) => setNewOffer((s) => ({ ...s, description: v }))} />
        <Text style={styles.subHeader}>Price per night</Text>
        <View style={styles.priceRow}>
          <Text style={styles.pricePrefix}>LKR</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="0"
            value={newOffer.packagePrice}
            onChangeText={(v) => setNewOffer((s) => ({ ...s, packagePrice: v }))}
            keyboardType="numeric"
          />
        </View>
        <Text style={styles.subHeader}>Select Rooms</Text>
        <View style={styles.rowWrap}>
          {rooms.map((r) => {
            const selected = selectedOfferRoomIds.includes(r._id);
            return (
              <TouchableOpacity
                key={r._id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() =>
                  setSelectedOfferRoomIds((prev) =>
                    prev.includes(r._id) ? prev.filter((x) => x !== r._id) : [...prev, r._id]
                  )
                }
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {r.roomNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Or Room IDs CSV (id1,id2,...)"
          value={newOffer.roomIdsCsv}
          onChangeText={(v) => setNewOffer((s) => ({ ...s, roomIdsCsv: v }))}
        />
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={createOrUpdateOffer}>
            <Text style={styles.btnText}>{editingOfferId ? 'Update Offer' : 'Create Offer'}</Text>
          </TouchableOpacity>
          {editingOfferId ? (
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => {
                setEditingOfferId('');
                setSelectedOfferRoomIds([]);
                setNewOffer({ title: '', description: '', packagePrice: '0', roomIdsCsv: '' });
              }}
            >
              <Text style={styles.ghostBtnText}>Cancel Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {offers.map((o) => (
          <View key={o._id} style={styles.item}>
            <Text style={styles.itemTitle}>{o.title}</Text>
            <Text style={styles.itemSub}>Price: LKR {Math.round(Number(o.packagePrice) || 0)}</Text>
            <Text style={styles.itemSub}>Rooms: {(o.rooms || []).length} | Active: {o.active ? 'Yes' : 'No'}</Text>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => editOffer(o)}>
                <Text style={styles.linkText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteOffer(o._id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rooms</Text>
        <Text style={styles.subtle}>Tap a room ID to select and manage.</Text>
        {rooms.map((r) => (
          <TouchableOpacity key={r._id} style={styles.item} onPress={() => setSelectedRoomId(r._id)}>
            <Text style={styles.itemTitle}>Room {r.roomNumber} · {r.variant}</Text>
            <Text style={styles.itemSub}>Status: {r.status} | Price: {r.basePricePerNight}</Text>
            <Text style={styles.itemSub}>ID: {r._id}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedRoom && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected Room: {selectedRoom.roomNumber}</Text>
          <TextInput style={styles.input} placeholder="Status" value={selectedRoom.status || ''} onChangeText={(v) => setRooms((prev) => prev.map((x) => (x._id === selectedRoom._id ? { ...x, status: v } : x)))} />
          <TextInput style={styles.input} placeholder="Description" value={selectedRoom.description || ''} onChangeText={(v) => setRooms((prev) => prev.map((x) => (x._id === selectedRoom._id ? { ...x, description: v } : x)))} />
          <TextInput style={styles.input} placeholder="Base price" value={String(selectedRoom.basePricePerNight ?? 0)} onChangeText={(v) => setRooms((prev) => prev.map((x) => (x._id === selectedRoom._id ? { ...x, basePricePerNight: v } : x)))} />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={updateSelectedRoom}><Text style={styles.btnText}>Update Room</Text></TouchableOpacity>
          </View>
          <Text style={styles.subHeader}>Room Photos</Text>
          <TextInput
            style={styles.input}
            placeholder="Add photo URL (https://...)"
            value={newPhotoUrl}
            onChangeText={setNewPhotoUrl}
          />
          <TouchableOpacity style={styles.btn} onPress={addRoomPhotoByUrl}>
            <Text style={styles.btnText}>Add Photo URL</Text>
          </TouchableOpacity>
          {(detail?.photos || []).map((p) => (
            <Text key={p._id} style={styles.itemSub}>- {p.url}</Text>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f0e8', padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#3d2b1f', marginBottom: 8 },
  subtle: { color: '#6b6b6b', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3d2b1f', marginBottom: 8 },
  subHeader: { marginTop: 8, marginBottom: 6, color: '#3d2b1f', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    gap: 8,
  },
  pricePrefix: { color: '#3d2b1f', fontWeight: '700' },
  priceInput: { flex: 1, paddingVertical: 10, color: '#2a2a2a' },
  btn: { backgroundColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4 },
  ghostBtn: { borderWidth: 1, borderColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#c9a96e', fontWeight: '700' },
  ghostBtnText: { color: '#3d2b1f', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rowWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#d6d6d6',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#3d2b1f', borderColor: '#3d2b1f' },
  chipText: { color: '#3d2b1f', fontWeight: '600', fontSize: 12 },
  chipTextSelected: { color: '#c9a96e' },
  item: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8 },
  itemTitle: { color: '#2a2a2a', fontWeight: '700' },
  itemSub: { color: '#6b6b6b', marginTop: 2 },
  linkText: { color: '#1f6feb', fontWeight: '700', marginTop: 6 },
  deleteText: { color: '#b42318', fontWeight: '700', marginTop: 6 },
});
