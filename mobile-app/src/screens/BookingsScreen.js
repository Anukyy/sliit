import React, { useState, useEffect, createElement, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api, { setAuthToken } from '../api/axios';
import { useCustomerAuth } from '../context/CustomerAuthContext';

const USE_WEB_DATE = Platform.OS === 'web';

function stripTime(d) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = stripTime(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d) {
  const x = stripTime(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLongDate(d) {
  try {
    return stripTime(d).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return toYmd(d);
  }
}

function defaultCheckIn() {
  return stripTime(new Date());
}

function defaultCheckOut(from) {
  return addDays(from || defaultCheckIn(), 1);
}

function bookingCanUpdate(item) {
  if (!item) return false;
  if (item.status === 'cancelled') return false;
  if (item.cancellationRequestStatus === 'pending') return false;
  return true;
}

function bookingCanChangeDates(item) {
  return bookingCanUpdate(item) && !item.checkedInAt;
}

function bookingCanRequestCancel(item) {
  return bookingCanUpdate(item) && !item.checkedInAt;
}

/** Normalize `_id` / `id` from API JSON (handles rare `{ $oid }` shapes). */
function normalizeBookingMongoId(raw) {
  if (raw == null) return '';
  if (typeof raw === 'object' && '$oid' in raw && typeof raw.$oid === 'string') {
    return raw.$oid.trim();
  }
  return String(raw).trim();
}

function routeLooksMissing(err) {
  const status = err.response?.status;
  const msg = String(err.response?.data?.error || '').toLowerCase();
  return status === 404 && (!msg || msg === 'not found');
}

/** Prefer body-only URL first — some hosts block paths containing `/update`. */
async function postGuestBookingUpdate(bookingId, body) {
  const payload = { bookingId, ...body };
  try {
    return await api.post('/customer-auth/booking-update', payload);
  } catch (err) {
    if (!routeLooksMissing(err)) throw err;
    try {
      return await api.post(`/customer-auth/bookings/${bookingId}/update`, body);
    } catch (err2) {
      if (!routeLooksMissing(err2)) throw err2;
      return await api.put(`/customer-auth/bookings/${bookingId}`, body);
    }
  }
}

export default function BookingsScreen() {
  const navigation = useNavigation();
  const { customer, isAuthenticated, token: customerToken } = useCustomerAuth();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);

  const [roomId, setRoomId] = useState('');
  const [offerId, setOfferId] = useState('');
  const [checkInDate, setCheckInDate] = useState(defaultCheckIn);
  const [checkOutDate, setCheckOutDate] = useState(() => defaultCheckOut(defaultCheckIn()));
  const [newSpecialRequests, setNewSpecialRequests] = useState('');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editCheckInDate, setEditCheckInDate] = useState(defaultCheckIn);
  const [editCheckOutDate, setEditCheckOutDate] = useState(() => defaultCheckOut(defaultCheckIn()));
  const [editSpecialRequests, setEditSpecialRequests] = useState('');

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [dateTarget, setDateTarget] = useState(null);
  const [pickerFlow, setPickerFlow] = useState('create');
  const [iosDraftDate, setIosDraftDate] = useState(new Date());
  const pendingPickerFlowRef = useRef('create');

  const resolvePhotoUrl = (room) => {
    const raw = room?.photos?.[0]?.url;
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (customerToken) setAuthToken('customer', customerToken);
    }, [customerToken])
  );

  useEffect(() => {
    if (!modalVisible) return;
    const in0 = defaultCheckIn();
    setCheckInDate(in0);
    setCheckOutDate(defaultCheckOut(in0));
    setRoomId('');
    setOfferId('');
    setNewSpecialRequests('');
    setDateTarget(null);
  }, [modalVisible]);

  const activeCheckIn = pickerFlow === 'edit' ? editCheckInDate : checkInDate;
  const activeCheckOut = pickerFlow === 'edit' ? editCheckOutDate : checkOutDate;

  /** New bookings only use rooms staff marked Available (full catalog can include Reserved/Occupied). */
  const bookableRooms = useMemo(
    () => rooms.filter((r) => String(r.status || '').toLowerCase() === 'available'),
    [rooms]
  );

  const renderRoomsCatalog = () => {
    return (
      <View style={styles.catalogCard}>
        <View style={styles.catalogHeader}>
          <Text style={styles.catalogTitle}>Rooms</Text>
          <Text style={styles.catalogSub}>Tap a room to start a reservation (only rooms marked Available can be booked).</Text>
        </View>
        <ScrollView style={styles.roomCatalog} keyboardShouldPersistTaps="handled">
          {rooms.map((r) => {
            const isAvailable = String(r.status || '').toLowerCase() === 'available';
            const img = resolvePhotoUrl(r);
            return (
              <TouchableOpacity
                key={r._id}
                style={[styles.roomOption, !isAvailable && styles.roomOptionDisabled]}
                activeOpacity={0.85}
                onPress={() => {
                  if (!isAvailable) {
                    Alert.alert('Not available', `Room ${r.roomNumber} is currently ${r.status}.`);
                    return;
                  }
                  if (!isAuthenticated || !customer) {
                    promptGuestLogin(false);
                    return;
                  }
                  setRoomId(r._id);
                  setOfferId('');
                  setModalVisible(true);
                }}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.roomImage} />
                ) : (
                  <View style={styles.roomImageFallback}>
                    <Text style={styles.roomImageFallbackText}>No Photo</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.catalogRoomHeader}>
                    <Text style={styles.roomTitle}>Room {r.roomNumber}</Text>
                    <Text style={styles.catalogStatusBadge}>{r.status}</Text>
                  </View>
                  <Text style={styles.roomMeta}>{r.variant || r.roomType || 'Room'}</Text>
                  <Text style={styles.roomMeta}>LKR {Math.round(Number(r.basePricePerNight || 0))} / night</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {rooms.length === 0 && (
            <Text style={styles.emptyText}>No rooms in the catalog.</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderOffersCatalog = () => {
    return (
      <View style={styles.catalogCard}>
        <View style={styles.catalogHeader}>
          <Text style={styles.catalogTitle}>Offers</Text>
          <Text style={styles.catalogSub}>Reserve by package offers created by the Room Manager.</Text>
        </View>
        <ScrollView style={styles.roomCatalog} keyboardShouldPersistTaps="handled">
          {offers.map((o) => (
            <TouchableOpacity
              key={o._id}
              style={styles.roomOption}
              activeOpacity={0.85}
              onPress={() => {
                if (!isAuthenticated || !customer) {
                  promptGuestLogin(false);
                  return;
                }
                setOfferId(o._id);
                setRoomId('');
                setModalVisible(true);
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.catalogRoomHeader}>
                  <Text style={styles.roomTitle}>{o.title || 'Offer'}</Text>
                  <Text style={styles.catalogStatusBadge}>Offer</Text>
                </View>
                <Text style={styles.roomMeta}>{o.description || 'Package offer'}</Text>
                <Text style={styles.roomMeta}>
                  LKR {Math.round(Number(o.packagePrice || 0))} / night
                </Text>
                <Text style={styles.roomMeta}>
                  Rooms: {Array.isArray(o.rooms) ? o.rooms.length : 0}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {offers.length === 0 && (
            <Text style={styles.emptyText}>No active offers in the catalog.</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  const applyPickedDate = (target, raw) => {
    const d = stripTime(raw);
    const flow = pendingPickerFlowRef.current;
    if (flow === 'create') {
      if (target === 'checkIn') {
        setCheckInDate(d);
        setCheckOutDate((prev) => (stripTime(prev).getTime() <= d.getTime() ? addDays(d, 1) : stripTime(prev)));
      } else {
        if (d.getTime() <= stripTime(checkInDate).getTime()) {
          Alert.alert('Invalid dates', 'Check-out must be after check-in.');
          return;
        }
        setCheckOutDate(d);
      }
    } else {
      if (target === 'checkIn') {
        setEditCheckInDate(d);
        setEditCheckOutDate((prev) => (stripTime(prev).getTime() <= d.getTime() ? addDays(d, 1) : stripTime(prev)));
      } else {
        if (d.getTime() <= stripTime(editCheckInDate).getTime()) {
          Alert.alert('Invalid dates', 'Check-out must be after check-in.');
          return;
        }
        setEditCheckOutDate(d);
      }
    }
  };

  const openNativeDatePick = (flow, target) => {
    Keyboard.dismiss();
    pendingPickerFlowRef.current = flow;
    setPickerFlow(flow);
    setDateTarget(target);
    if (flow === 'create') {
      setIosDraftDate(target === 'checkIn' ? checkInDate : checkOutDate);
    } else {
      setIosDraftDate(target === 'checkIn' ? editCheckInDate : editCheckOutDate);
    }
  };

  /** iOS: nested root Modal + Modal(date picker) breaks touches — render picker inside the same Modal as the form. */
  const renderIosPickerOverlay = () => {
    if (Platform.OS !== 'ios' || !dateTarget) return null;
    return (
      <View style={styles.iosInlinePickerRoot} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setDateTarget(null)} />
        <View style={styles.iosPickerSheet}>
          <View style={styles.iosPickerToolbar}>
            <TouchableOpacity onPress={() => setDateTarget(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.iosPickerToolbarBtn}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (dateTarget) applyPickedDate(dateTarget, iosDraftDate);
                setDateTarget(null);
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.iosPickerToolbarBtn, styles.iosPickerToolbarDone]}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={iosDraftDate}
            mode="date"
            display="spinner"
            themeVariant="light"
            minimumDate={dateTarget === 'checkOut' ? addDays(activeCheckIn, 1) : undefined}
            onChange={(_, d) => {
              if (d) setIosDraftDate(stripTime(d));
            }}
            style={styles.iosPickerSpinner}
          />
        </View>
      </View>
    );
  };

  const fetchData = async () => {
    try {
      const [bookingsRes, roomsRes, offersRes] = await Promise.allSettled([
        api.get('/customer-auth/bookings'),
        api.get('/public/rooms'),
        api.get('/public/offers'),
      ]);

      if (roomsRes.status === 'fulfilled') {
        setRooms(Array.isArray(roomsRes.value.data) ? roomsRes.value.data : []);
      } else {
        setRooms([]);
      }
      if (offersRes.status === 'fulfilled') {
        setOffers(Array.isArray(offersRes.value.data) ? offersRes.value.data : []);
      } else {
        setOffers([]);
      }

      if (bookingsRes.status === 'fulfilled') {
        setBookings(Array.isArray(bookingsRes.value.data) ? bookingsRes.value.data : []);
        setRequiresLogin(false);
      } else {
        const status = bookingsRes.reason?.response?.status;
        if (status === 401) {
          setBookings([]);
          setRequiresLogin(true);
        } else {
          Alert.alert('Error', 'Failed to fetch bookings');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const promptGuestLogin = (closeModal = false) => {
    if (closeModal) setModalVisible(false);
    Alert.alert('Sign in required', 'Please sign in as a guest before you can confirm a booking.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign In', onPress: () => navigation.navigate('Login') },
    ]);
  };

  const openBookingModal = () => {
    if (!isAuthenticated || !customer) {
      promptGuestLogin(false);
      return;
    }
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    if (!bookingCanUpdate(item)) return;
    setEditingBooking(item);
    const from = item.checkIn ?? item.startDate;
    const to = item.checkOut ?? item.endDate;
    setEditCheckInDate(from ? stripTime(new Date(from)) : defaultCheckIn());
    setEditCheckOutDate(to ? stripTime(new Date(to)) : defaultCheckOut(from ? stripTime(new Date(from)) : defaultCheckIn()));
    setEditSpecialRequests(String(item.specialRequests || ''));
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    const bookingId = normalizeBookingMongoId(editingBooking?._id ?? editingBooking?.id);
    if (!bookingId || !/^[a-f0-9]{24}$/i.test(bookingId)) {
      Alert.alert('Error', 'Invalid booking. Close this screen and try again.');
      return;
    }
    if (!customerToken) {
      Alert.alert('Sign in required', 'Your session token is missing. Please sign in again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    if (!isAuthenticated) {
      promptGuestLogin(true);
      return;
    }
    if (editSaving) return;
    try {
      setEditSaving(true);
      Keyboard.dismiss();
      setAuthToken('customer', customerToken);
      const body = { specialRequests: editSpecialRequests.trim() };
      if (bookingCanChangeDates(editingBooking)) {
        const ci = toYmd(editCheckInDate);
        const co = toYmd(editCheckOutDate);
        if (co <= ci) {
          Alert.alert('Error', 'Check-out must be after check-in');
          return;
        }
        body.checkIn = ci;
        body.checkOut = co;
      }
      const res = await postGuestBookingUpdate(bookingId, body);
      const updated = res?.data;
      if (updated && (updated._id || updated.id)) {
        const uid = normalizeBookingMongoId(updated._id ?? updated.id);
        setBookings((prev) =>
          prev.map((b) => (normalizeBookingMongoId(b._id ?? b.id) === uid ? { ...b, ...updated } : b))
        );
      }
      Alert.alert('Saved', 'Your booking was updated.');
      setEditModalVisible(false);
      setEditingBooking(null);
      fetchData();
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.message ||
        (error.request ? 'Could not reach the server. Check Wi‑Fi and EXPO_PUBLIC_API_URL on a real device.' : null) ||
        'Could not update booking';
      Alert.alert('Error', msg);
    } finally {
      setEditSaving(false);
    }
  };

  const openCancelModal = (id) => {
    setCancelTargetId(id);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const submitCancelRequest = async () => {
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      Alert.alert('Reason needed', 'Please explain why you want to cancel (at least 5 characters).');
      return;
    }
    if (!cancelTargetId || !customerToken) return;
    try {
      setAuthToken('customer', customerToken);
      await api.post(`/customer-auth/bookings/${cancelTargetId}/cancel`, {
        cancellationReason: reason,
      });
      Alert.alert('Request sent', 'Staff will review your cancellation request.');
      setCancelModalVisible(false);
      setCancelTargetId(null);
      setCancelReason('');
      fetchData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Could not submit cancellation');
    }
  };

  const handleAddBooking = async () => {
    if (!isAuthenticated || !customer) {
      promptGuestLogin(true);
      return;
    }
    if (!roomId && !offerId) {
      Alert.alert('Error', 'Please select a room or an offer');
      return;
    }
    const checkIn = toYmd(checkInDate);
    const checkOut = toYmd(checkOutDate);
    if (checkOut <= checkIn) {
      Alert.alert('Error', 'Check-out must be after check-in');
      return;
    }

    try {
      if (customerToken) setAuthToken('customer', customerToken);
      const newBooking = {
        ...(roomId ? { roomId } : { offerId }),
        checkIn,
        checkOut,
        fullName: customer.name || 'Guest',
        contactEmail: customer.email || '',
        phone: customer.phone || '',
        address: '',
        specialRequests: newSpecialRequests.trim(),
        mealsAddLater: false,
        advanceAcknowledged: true,
        advancePaymentCompleted: true,
        restaurantFolioSubtotal: 0,
      };

      await api.post('/customer-auth/bookings', newBooking);
      Alert.alert('Success', 'Booking added successfully');
      setModalVisible(false);

      setRequiresLogin(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add booking');
    }
  };

  const renderItem = ({ item }) => {
    const from = item.checkIn ?? item.startDate;
    const to = item.checkOut ?? item.endDate;
    const canEdit = bookingCanUpdate(item);
    const canDates = bookingCanChangeDates(item);
    const canCancel = bookingCanRequestCancel(item);
    const pendingCancel = item.cancellationRequestStatus === 'pending';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Booking #{String(item._id ?? item.id ?? '')}</Text>
          <Text style={styles.cardBadge}>{item.status}</Text>
        </View>
        {pendingCancel ? (
          <Text style={styles.cardNotice}>Cancellation request pending staff review.</Text>
        ) : null}
        <Text style={styles.cardText}>Room: {item.room?.roomNumber || item.offer?.title || '—'}</Text>
        <Text style={styles.cardText}>From: {from ? new Date(from).toLocaleDateString() : '—'}</Text>
        <Text style={styles.cardText}>To: {to ? new Date(to).toLocaleDateString() : '—'}</Text>
        {item.specialRequests ? (
          <Text style={styles.cardDesc}>
            <Text style={styles.cardDescLabel}>Notes: </Text>
            {item.specialRequests}
          </Text>
        ) : null}

        <View style={styles.cardActions}>
          {canEdit ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {canCancel ? (
            <TouchableOpacity
              style={styles.cancelReqBtn}
              onPress={() => openCancelModal(normalizeBookingMongoId(item._id ?? item.id))}
            >
              <Text style={styles.cancelReqBtnText}>Request cancellation</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderDateRow = (flow, target, label) => {
    const ci = flow === 'create' ? checkInDate : editCheckInDate;
    const co = flow === 'create' ? checkOutDate : editCheckOutDate;
    const value = target === 'checkIn' ? ci : co;
    const minOut = toYmd(addDays(ci, 1));

    if (USE_WEB_DATE) {
      return (
        <>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.dateWebShell}>
            {createElement('input', {
              type: 'date',
              value: toYmd(value),
              min: target === 'checkOut' ? minOut : undefined,
              onChange: (e) => {
                const v = e?.target?.value;
                if (!v) return;
                const [y, m, d] = v.split('-').map((x) => parseInt(x, 10));
                if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return;
                const next = new Date(y, m - 1, d, 12, 0, 0, 0);
                if (target === 'checkIn') {
                  if (flow === 'create') {
                    setCheckInDate(next);
                    setCheckOutDate((prev) =>
                      stripTime(prev).getTime() <= next.getTime() ? addDays(next, 1) : stripTime(prev)
                    );
                  } else {
                    setEditCheckInDate(next);
                    setEditCheckOutDate((prev) =>
                      stripTime(prev).getTime() <= next.getTime() ? addDays(next, 1) : stripTime(prev)
                    );
                  }
                } else if (next.getTime() <= stripTime(ci).getTime()) {
                  Alert.alert('Invalid dates', 'Check-out must be after check-in.');
                } else if (flow === 'create') {
                  setCheckOutDate(next);
                } else {
                  setEditCheckOutDate(next);
                }
              },
              style: styles.dateWebInput,
            })}
          </View>
        </>
      );
    }

    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.datePickRow}
          onPress={() => openNativeDatePick(flow, target)}
          activeOpacity={0.85}
        >
          <Text style={styles.datePickText}>{formatLongDate(value)}</Text>
          <Text style={styles.datePickGlyph}>📅</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={openBookingModal}>
        <Text style={styles.addBtnText}>Reserve Room</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#c9a96e" style={{ marginTop: 50 }} />
      ) : (
        <>
          {requiresLogin && (
            <Text style={styles.noticeText}>Sign in to view and manage your bookings.</Text>
          )}
          <FlatList
            data={[]}
            renderItem={renderItem}
            keyExtractor={(item, index) =>
              normalizeBookingMongoId(item._id ?? item.id) || `booking-row-${index}`
            }
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View>
                {renderRoomsCatalog()}
                {renderOffersCatalog()}
              </View>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>Select a room or offer above to place a reservation.</Text>}
          />
        </>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalRootFill}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.createModalScrollContent}
              >
                <Text style={styles.modalTitle}>Reserve Room / Offer</Text>

                <Text style={styles.label}>Select available room</Text>
                <ScrollView style={styles.roomPicker} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {bookableRooms.map((r) => {
                    const selected = roomId === r._id;
                    const img = resolvePhotoUrl(r);
                    return (
                      <TouchableOpacity
                        key={r._id}
                        style={[styles.roomOption, selected && styles.roomOptionSelected]}
                        onPress={() => {
                          setRoomId(r._id);
                          setOfferId('');
                        }}
                      >
                        {img ? (
                          <Image source={{ uri: img }} style={styles.roomImage} />
                        ) : (
                          <View style={styles.roomImageFallback}>
                            <Text style={styles.roomImageFallbackText}>No Photo</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.roomTitle}>Room {r.roomNumber}</Text>
                          <Text style={styles.roomMeta}>{r.variant || r.roomType || 'Room'}</Text>
                          <Text style={styles.roomMeta}>LKR {Math.round(Number(r.basePricePerNight || 0))} / night</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {bookableRooms.length === 0 && (
                    <Text style={styles.emptyText}>No rooms marked Available right now — try again later or contact reception.</Text>
                  )}
                </ScrollView>

                <Text style={styles.label}>Or select offer package</Text>
                <Text style={styles.offerHelpText}>Tap a package below to reserve with offer pricing.</Text>
                <ScrollView style={styles.offerPicker} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {offers.map((o) => {
                    const selected = offerId === o._id;
                    const isActive = o?.active !== false;
                    return (
                      <TouchableOpacity
                        key={o._id}
                        style={[
                          styles.offerOption,
                          !isActive && styles.offerOptionDisabled,
                          selected && styles.offerOptionSelected,
                        ]}
                        onPress={() => {
                          if (!isActive) {
                            Alert.alert('Offer inactive', 'This offer is currently inactive and cannot be reserved.');
                            return;
                          }
                          setOfferId(o._id);
                          setRoomId('');
                        }}
                      >
                        <View style={styles.offerHeaderRow}>
                          <Text style={styles.offerBadge}>{isActive ? 'OFFER' : 'INACTIVE'}</Text>
                          <Text style={styles.offerPrice}>LKR {Math.round(Number(o.packagePrice || 0))} / night</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.offerTitle}>{o.title || 'Offer package'}</Text>
                          <Text style={styles.offerDescription}>{o.description || 'Package offer'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {offers.length === 0 && (
                    <Text style={styles.emptyText}>No active offers right now.</Text>
                  )}
                </ScrollView>

                {renderDateRow('create', 'checkIn', 'Check-in')}
                {renderDateRow('create', 'checkOut', 'Check-out')}

                <Text style={styles.label}>Special requests (optional)</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Dietary needs, arrival time, etc."
                  placeholderTextColor="#9a9a9a"
                  value={newSpecialRequests}
                  onChangeText={setNewSpecialRequests}
                  multiline
                  textAlignVertical="top"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleAddBooking}>
                    <Text style={styles.saveBtnText}>Confirm Book</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
        </KeyboardAvoidingView>
          {pickerFlow === 'create' ? renderIosPickerOverlay() : null}
        </View>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalRootFill}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.editModalScrollContent}
              >
                <Text style={styles.modalTitle}>Edit booking</Text>
                {editingBooking ? (
                  <>
                    <Text style={styles.cardText}>
                      Room: {editingBooking.room?.roomNumber || editingBooking.offer?.title || '—'}
                    </Text>
                    {bookingCanChangeDates(editingBooking) ? (
                      <>
                        {renderDateRow('edit', 'checkIn', 'Check-in')}
                        {renderDateRow('edit', 'checkOut', 'Check-out')}
                      </>
                    ) : (
                      <Text style={styles.cardNotice}>
                        Dates are locked after check-in. You can still update notes below.
                      </Text>
                    )}
                    <Text style={styles.label}>Notes / special requests</Text>
                    <TextInput
                      style={styles.textArea}
                      placeholder="Update your requests or notes for the hotel"
                      placeholderTextColor="#9a9a9a"
                      value={editSpecialRequests}
                      onChangeText={setEditSpecialRequests}
                      multiline
                      textAlignVertical="top"
                    />
                  </>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [styles.cancelBtn, pressed && styles.modalBtnPressed]}
                    onPress={() => {
                      setDateTarget(null);
                      setEditModalVisible(false);
                      setEditingBooking(null);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.saveBtn,
                      editSaving && styles.saveBtnDisabled,
                      pressed && !editSaving && styles.modalBtnPressed,
                    ]}
                    onPress={handleSaveEdit}
                    disabled={editSaving}
                  >
                    {editSaving ? (
                      <ActivityIndicator color="#c9a96e" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save changes</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
          {pickerFlow === 'edit' ? renderIosPickerOverlay() : null}
        </View>
      </Modal>

      <Modal visible={cancelModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request cancellation</Text>
            <Text style={styles.subtleHelp}>
              Staff will review your request. Please give a short reason (at least 5 characters).
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Why do you need to cancel?"
              placeholderTextColor="#9a9a9a"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setCancelModalVisible(false);
                  setCancelTargetId(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submitCancelRequest}>
                <Text style={styles.saveBtnText}>Submit request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {dateTarget && Platform.OS === 'android' ? (
        <DateTimePicker
          value={dateTarget === 'checkIn' ? activeCheckIn : activeCheckOut}
          mode="date"
          display="default"
          minimumDate={dateTarget === 'checkOut' ? addDays(activeCheckIn, 1) : undefined}
          onChange={(e, selected) => {
            setDateTarget(null);
            if (e.type === 'dismissed') return;
            if (selected) applyPickedDate(dateTarget, selected);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  addBtn: { backgroundColor: '#3d2b1f', padding: 16, alignItems: 'center' },
  addBtnText: { color: '#c9a96e', fontWeight: 'bold', fontSize: 16 },
  list: { padding: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6b6b6b', fontSize: 16 },
  noticeText: { textAlign: 'center', marginTop: 12, color: '#8b6f5e', fontSize: 14, paddingHorizontal: 16 },
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
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#3d2b1f' },
  cardBadge: {
    backgroundColor: '#e8e0d5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: '#3d2b1f',
    fontSize: 12,
    overflow: 'hidden',
  },
  cardText: { fontSize: 14, color: '#6b6b6b', marginBottom: 4 },
  cardNotice: { fontSize: 13, color: '#8b5a2b', marginBottom: 8, fontWeight: '600' },
  cardDesc: { fontSize: 14, color: '#4a4a4a', marginTop: 6, marginBottom: 4 },
  cardDescLabel: { fontWeight: '700', color: '#3d2b1f' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, alignItems: 'center' },
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#3d2b1f',
  },
  editBtnText: { color: '#c9a96e', fontWeight: '700', fontSize: 14 },
  cancelReqBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b42318',
  },
  cancelReqBtnText: { color: '#b42318', fontWeight: '700', fontSize: 14 },

  modalRootFill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  iosInlinePickerRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 50,
    elevation: 50,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '92%' },
  createModalScrollContent: { paddingBottom: 8 },
  editModalScrollContent: { flexGrow: 1, paddingBottom: 8 },
  modalBtnPressed: { opacity: 0.85 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#3d2b1f', marginBottom: 12, textAlign: 'center' },
  subtleHelp: { fontSize: 13, color: '#6b6b6b', marginBottom: 12 },
  label: { color: '#3d2b1f', fontWeight: '700', marginBottom: 8, marginTop: 4 },
  catalogCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  catalogHeader: { marginBottom: 8 },
  catalogTitle: { fontSize: 18, fontWeight: '800', color: '#3d2b1f' },
  catalogSub: { fontSize: 12, color: '#6b6b6b', marginTop: 4 },
  roomCatalog: { maxHeight: 340 },
  catalogRoomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catalogStatusBadge: {
    backgroundColor: '#e8e0d5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    color: '#3d2b1f',
    fontSize: 11,
    overflow: 'hidden',
  },
  roomPicker: { maxHeight: 180, marginBottom: 8 },
  offerPicker: { maxHeight: 220, marginBottom: 12 },
  offerHelpText: { color: '#6b6b6b', fontSize: 12, marginTop: -4, marginBottom: 8 },
  roomOption: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e8e0d5',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  roomOptionDisabled: { opacity: 0.6 },
  roomOptionSelected: { borderColor: '#3d2b1f', backgroundColor: '#f5f0e8' },
  offerOption: {
    borderWidth: 1.5,
    borderColor: '#d8cab5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fffdf9',
  },
  offerOptionSelected: {
    borderColor: '#3d2b1f',
    backgroundColor: '#f5f0e8',
  },
  offerOptionDisabled: {
    opacity: 0.65,
    borderStyle: 'dashed',
  },
  offerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  offerBadge: {
    backgroundColor: '#3d2b1f',
    color: '#c9a96e',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  offerPrice: { color: '#3d2b1f', fontSize: 15, fontWeight: '800' },
  offerTitle: { color: '#3d2b1f', fontWeight: '800', fontSize: 17, marginBottom: 4 },
  offerDescription: { color: '#5f5f5f', fontSize: 13, lineHeight: 18 },
  roomImage: { width: 72, height: 72, borderRadius: 6, backgroundColor: '#eee' },
  roomImageFallback: {
    width: 72,
    height: 72,
    borderRadius: 6,
    backgroundColor: '#e8e0d5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomImageFallbackText: { color: '#6b6b6b', fontSize: 12 },
  roomTitle: { color: '#3d2b1f', fontWeight: '700', fontSize: 15 },
  roomMeta: { color: '#6b6b6b', fontSize: 12, marginTop: 2 },
  textArea: {
    borderWidth: 1,
    borderColor: '#e8e0d5',
    borderRadius: 8,
    padding: 12,
    minHeight: 88,
    fontSize: 15,
    color: '#2a2a2a',
    marginBottom: 12,
    backgroundColor: '#faf8f5',
  },
  dateWebShell: { width: '100%', marginBottom: 12 },
  dateWebInput: {
    width: '100%',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e8e0d5',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#2a2a2a',
  },
  datePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8e0d5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  datePickText: { fontSize: 16, color: '#3d2b1f', fontWeight: '600' },
  datePickGlyph: { fontSize: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
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
    minHeight: 48,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#c9a96e', fontWeight: 'bold' },
  iosPickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosPickerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e0d5',
  },
  iosPickerToolbarBtn: { fontSize: 17, color: '#6b6b6b' },
  iosPickerToolbarDone: { fontWeight: '700', color: '#3d2b1f' },
  iosPickerSpinner: { alignSelf: 'center', height: 200 },
});
