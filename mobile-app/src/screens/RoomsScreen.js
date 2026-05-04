import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';

/**
 * Guest-facing room browse — uses GET /public/rooms (same catalog as booking flow).
 * Creating/editing rooms belongs on Room Manager (staff); legacy /rooms CRUD had no backend route.
 */
export default function RoomsScreen() {
  const navigation = useNavigation();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const resolvePhotoUrl = (room) => {
    const raw = room?.photos?.[0]?.url;
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/public/rooms');
      setRooms(Array.isArray(response.data) ? response.data : []);
    } catch {
      Alert.alert('Error', 'Could not load rooms.');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, [fetchRooms])
  );

  const renderItem = ({ item }) => {
    const img = resolvePhotoUrl(item);
    const nightly = Math.round(Number(item.basePricePerNight || 0));
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          {img ? (
            <Image source={{ uri: img }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <Text style={styles.thumbFallbackText}>No photo</Text>
            </View>
          )}
          <View style={styles.cardMain}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Room {item.roomNumber}</Text>
              <Text style={styles.cardBadge}>{item.status}</Text>
            </View>
            <Text style={styles.cardText}>{item.variant || item.roomType || 'Room'}</Text>
            <Text style={styles.cardPrice}>LKR {nightly} / night</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Full room list — badge shows status (bookings use rooms marked Available). Staff manage inventory from Room Manager.
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('StaffLogin')} activeOpacity={0.85}>
          <Text style={styles.bannerLink}>Staff login →</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#c9a96e" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rooms}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No rooms in the catalog.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  banner: {
    backgroundColor: '#fff',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e0d5',
  },
  bannerText: { fontSize: 13, color: '#6b6b6b', marginBottom: 8 },
  bannerLink: { fontSize: 14, fontWeight: '700', color: '#3d2b1f' },
  list: { padding: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6b6b6b', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8e0d5' },
  thumbFallbackText: { fontSize: 11, color: '#6b6b6b' },
  cardMain: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#3d2b1f' },
  cardBadge: {
    backgroundColor: '#e8e0d5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: '#3d2b1f',
    fontSize: 11,
    overflow: 'hidden',
  },
  cardText: { fontSize: 14, color: '#6b6b6b', marginBottom: 4 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#3d2b1f' },
});
