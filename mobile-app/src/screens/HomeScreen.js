/**
 * Maison Velour — React Native Landing Page
 *
 * Dependencies (install before use):
 *   @react-navigation/native
 *   react-native-safe-area-context
 *   react-native-screens
 *
 * Usage in your navigator:
 *   <Stack.Screen name="Landing" component={LandingPage} />
 *   The component expects `navigation` prop from React Navigation.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import api, { setAuthToken } from '../api/axios';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  cream:     '#f5f0e8',
  warmWhite: '#faf8f5',
  brown:     '#8b6f5e',
  darkBrown: '#3d2b1f',
  gold:      '#c9a96e',
  charcoal:  '#2a2a2a',
  lightGray: '#e8e0d5',
  textGray:  '#6b6b6b',
  overlay:   'rgba(30,15,5,0.58)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fades + slides up when the element is first laid out. */
function RevealView({ children, style, delay = 0 }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(22)).current;
  const started    = useRef(false);

  const onLayout = useCallback(() => {
    if (started.current) return;
    started.current = true;
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 520, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 520, delay, useNativeDriver: true }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View onLayout={onLayout} style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/** Interactive star-rating row (highest → lowest, left → right). */
function StarRating({ rating, onRate, size = 28 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity key={star} onPress={() => onRate?.(star)} activeOpacity={0.7}>
          <Text style={{ fontSize: size, color: star <= rating ? C.gold : C.lightGray }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Individual review card; shows edit/delete controls for user-authored reviews. */
function ReviewCard({ review, onEdit, onDelete }) {
  const filled = '★'.repeat(review.rating);
  const empty  = '☆'.repeat(5 - review.rating);
  return (
    <View style={s.reviewCard}>
      {review.isUser && (
        <View style={s.reviewActions}>
          <TouchableOpacity onPress={onEdit} style={s.reviewActionBtn}>
            <Text style={s.reviewActionText}>✎ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={s.reviewActionBtn}>
            <Text style={s.reviewActionText}>✕ Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={s.reviewStars}>{filled}{empty}</Text>
      <Text style={s.reviewText}>"{review.text}"</Text>
      <View style={s.reviewer}>
        <View style={s.reviewerAvatar}>
          <Text style={s.reviewerAvatarText}>{String(review.name || '?')[0].toUpperCase()}</Text>
        </View>
        <View>
          <Text style={s.reviewerName}>{review.name}</Text>
          <Text style={s.reviewerMeta}>{review.location}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Gallery data ─────────────────────────────────────────────────────────────
const GALLERY = [
  { uri: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80', label: 'Presidential Suite' },
  { uri: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=700&q=80', label: 'The Lobby' },
  { uri: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80', label: 'Fine Dining' },
  { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80', label: 'Spa & Wellness' },
  { uri: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=700&q=80', label: 'Infinity Pool' },
];

function categoryLabel(cat) {
  return 'Guest';
}

/** Maps `/api/public/reviews` documents to landing-page cards (only `active` reviews are returned by API). */
function mapPublicReviewToCard(r, currentCustomerId) {
  const cid = r.customer != null ? String(r.customer) : '';
  const isUser = Boolean(currentCustomerId && cid === String(currentCustomerId));
  const name =
    (r.reviewerName && String(r.reviewerName).trim()) || `Guest #${r.customerNumber ?? ''}`;
  return {
    id: String(r._id),
    name,
    location: categoryLabel(),
    rating: Number(r.rating) || 5,
    text: String(r.text || ''),
    isUser,
  };
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { isAuthenticated, customer, token: customerToken } = useCustomerAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const scrollRef    = useRef(null);
  const gallerySectionY = useRef(0);

  // ── Reviews (public API — moderated/hidden reviews use status `removed` and are not listed) ──
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const loadPublicReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await api.get('/public/reviews', { params: { limit: 50 } });
      const list = Array.isArray(res.data) ? res.data : [];
      const customerId = customer?._id ?? customer?.id;
      setReviews(list.map((r) => mapPublicReviewToCard(r, customerId)));
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [customer]);

  useFocusEffect(
    useCallback(() => {
      // Staff/admin login sets axios active scope to staff; restore guest JWT so review APIs work from Home.
      if (customerToken) {
        setAuthToken('customer', customerToken);
      }
      loadPublicReviews();
    }, [customerToken, loadPublicReviews])
  );

  useEffect(() => {
    loadPublicReviews();
  }, [customer?._id, loadPublicReviews]);

  // ── Add-review modal ──
  const [addOpen,     setAddOpen]     = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newText,     setNewText]     = useState('');
  const [newRating,   setNewRating]   = useState(0);

  // ── Edit-review modal ──
  const [editOpen,    setEditOpen]    = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [editText,    setEditText]    = useState('');
  const [editRating,  setEditRating]  = useState(0);

  // ── Scroll tracking (nav background) ──
  const handleScroll = useCallback(e => {
    setNavScrolled(e.nativeEvent.contentOffset.y > 60);
  }, []);

  const scrollTo = useCallback(yRef => {
    scrollRef.current?.scrollTo({ y: yRef.current, animated: true });
  }, []);

  // ── Submit new review (persisted when signed in; appears on landing after moderation rules / API success) ──
  const handleSubmit = async () => {
    if (!newName.trim() || !newText.trim()) {
      Alert.alert('Missing info', 'Please enter your name and review.');
      return;
    }
    if (!newRating) {
      Alert.alert('Missing rating', 'Please select a star rating.');
      return;
    }
    const words = newText.trim().split(/\s+/).filter(Boolean);
    if (words.length < 5) {
      Alert.alert('Review too short', 'Please write at least 5 words (hotel policy).');
      return;
    }
    if (!isAuthenticated || !customerToken) {
      Alert.alert('Sign in required', 'Please sign in as a guest to submit a review.');
      return;
    }
    try {
      setAuthToken('customer', customerToken);
      await api.post('/customer-auth/reviews', {
        text: newText.trim(),
        rating: newRating,
        reviewerName: newName.trim(),
        category: 'other',
      });
      setAddOpen(false);
      setNewName('');
      setNewText('');
      setNewRating(0);
      await loadPublicReviews();
    } catch (e) {
      Alert.alert('Could not submit', e?.response?.data?.error || e.message || 'Try again later.');
    }
  };

  // ── Open edit modal ──
  const openEdit = useCallback(review => {
    setEditing(review);
    setEditText(review.text);
    setEditRating(review.rating);
    setEditOpen(true);
  }, []);

  const isMongoReviewId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

  // ── Save edit (API allows updating rating on your own review; text changes need backend support) ──
  const handleSaveEdit = async () => {
    if (!editText.trim()) {
      Alert.alert('Missing info', 'Please write your review.');
      return;
    }
    if (!editRating) {
      Alert.alert('Missing rating', 'Please select a rating.');
      return;
    }
    if (!editing) return;
    if (isMongoReviewId(editing.id)) {
      try {
        if (customerToken) setAuthToken('customer', customerToken);
        await api.patch(`/customer-auth/reviews/${editing.id}`, { rating: editRating });
        setEditOpen(false);
        setEditing(null);
        await loadPublicReviews();
      } catch (e) {
        Alert.alert('Could not update', e?.response?.data?.error || e.message || 'Try again.');
      }
      return;
    }
    setReviews((prev) =>
      prev.map((r) =>
        r.id === editing.id ? { ...r, text: editText.trim(), rating: editRating } : r
      )
    );
    setEditOpen(false);
    setEditing(null);
  };

  // ── Delete review ──
  const handleDelete = useCallback(
    (review) => {
      const { id } = review;
      Alert.alert('Delete review', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isMongoReviewId(id)) {
              try {
                if (customerToken) setAuthToken('customer', customerToken);
                await api.delete(`/customer-auth/reviews/${id}`);
                await loadPublicReviews();
              } catch (e) {
                Alert.alert('Error', e?.response?.data?.error || 'Could not delete review.');
              }
            } else {
              setReviews((prev) => prev.filter((r) => r.id !== id));
            }
          },
        },
      ]);
    },
    [loadPublicReviews]
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Floating Navigation ─────────────────────────────────── */}
      <View style={[s.nav, navScrolled && s.navScrolled]}>
        <TouchableOpacity onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}>
          <Text style={s.navLogo}>Maison Velour</Text>
        </TouchableOpacity>
        <View style={s.navRight}>
          <TouchableOpacity
            onPress={() =>
              isAuthenticated ? navigation?.navigate('MyProfile') : navigation?.navigate('Login')
            }
          >
            <Text style={s.navLink}>My Profile</Text>
          </TouchableOpacity>
          {!isAuthenticated && (
            <TouchableOpacity onPress={() => navigation?.navigate('Login')}>
              <Text style={s.navLink}>Guest Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Scrollable content ──────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >

        {/* ── HERO ──────────────────────────────────────────── */}
        <View style={s.hero}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80' }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View style={s.heroOverlay} />
          <View style={s.heroContent}>
            <RevealView>
              <Text style={s.heroTag}>Est. 1987 · Luxury Collection</Text>
            </RevealView>
            <RevealView delay={100}>
              <Text style={s.heroTitle}>
                Where every stay{'\n'}becomes a{' '}
                <Text style={s.heroTitleItalic}>story</Text>
              </Text>
            </RevealView>
            <RevealView delay={200}>
              <Text style={s.heroSub}>
                Nestled in the heart of the city, Maison Velour offers an intimate
                escape — timeless interiors, exceptional service, and a warmth that
                feels like home.
              </Text>
            </RevealView>
            <RevealView delay={300}>
              <View style={s.heroBtns}>
                <TouchableOpacity
                  style={s.btnGhost}
                  onPress={() => scrollTo(gallerySectionY)}
                  activeOpacity={0.75}
                >
                  <Text style={s.btnGhostText}>Discover More</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.btnGhost}
                  onPress={() => navigation?.navigate('Food')}
                  activeOpacity={0.75}
                >
                  <Text style={s.btnGhostText}>Restaurant</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.btnGhost}
                  onPress={() => navigation?.navigate('Bookings')}
                  activeOpacity={0.75}
                >
                  <Text style={s.btnGhostText}>Reserve Room</Text>
                </TouchableOpacity>
              </View>
            </RevealView>
          </View>
        </View>

        {/* ── GALLERY ───────────────────────────────────────── */}
        <View
          style={s.section}
          onLayout={e => { gallerySectionY.current = e.nativeEvent.layout.y; }}
        >
          <RevealView style={s.galleryHeader}>
            <View>
              <Text style={s.sectionLabel}>Visual Journey</Text>
              <Text style={s.sectionTitle}>
                Crafted <Text style={s.em}>spaces</Text>,{'\n'}curated moments
              </Text>
            </View>
          </RevealView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.galleryScroll}
          >
            {GALLERY.map((item, i) => (
              <RevealView key={i} delay={i * 80}>
                <View style={s.galleryCard}>
                  <Image source={{ uri: item.uri }} style={s.galleryImg} resizeMode="cover" />
                  <View style={s.galleryLabelWrap}>
                    <Text style={s.galleryLabel}>{item.label}</Text>
                  </View>
                </View>
              </RevealView>
            ))}
          </ScrollView>
        </View>

        {/* ── ABOUT ─────────────────────────────────────────── */}
        <View style={[s.section, s.aboutBg]}>
          <RevealView>
            <View style={s.aboutImgWrap}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80' }}
                style={s.aboutImg}
                resizeMode="cover"
              />
              <View style={s.aboutBadge}>
                <Text style={s.aboutBadgeNum}>36</Text>
                <Text style={s.aboutBadgeSub}>Years of{'\n'}Excellence</Text>
              </View>
            </View>
          </RevealView>

          <RevealView delay={120}>
            <Text style={s.sectionLabel}>Our Story</Text>
            <Text style={s.sectionTitle}>
              A legacy of <Text style={s.em}>refined</Text>{'\n'}hospitality
            </Text>
            <View style={s.divider} />
            <Text style={s.body}>
              Maison Velour was founded on a simple belief: that true luxury lies not
              in opulence, but in the warmth of genuine care. Our team of dedicated
              professionals ensures that every guest is treated as a cherished friend.
            </Text>
            <Text style={[s.body, { marginTop: 12 }]}>
              From our thoughtfully designed rooms to our award-winning restaurant,
              every detail has been considered with intention. We blend the charm of
              heritage architecture with the ease of modern comfort.
            </Text>
            <View style={s.statsRow}>
              {[['50', 'Rooms & Suites'], ['4.9', 'Guest Rating'], ['18k+', 'Stays Hosted']].map(
                ([val, lbl]) => (
                  <View key={lbl} style={s.stat}>
                    <Text style={s.statNum}>{val}</Text>
                    <Text style={s.statLbl}>{lbl}</Text>
                  </View>
                )
              )}
            </View>
          </RevealView>
        </View>

        {/* ── TESTIMONIALS ──────────────────────────────────── */}
        <View style={[s.section, s.testimonialsBg]}>
          <RevealView>
            <Text style={[s.sectionLabel, { color: C.gold }]}>Guest Voices</Text>
            <Text style={[s.sectionTitle, { color: C.cream }]}>
              Stories from <Text style={[s.em, { color: C.gold }]}>our guests</Text>
            </Text>
            <View style={[s.divider, { backgroundColor: C.gold }]} />
          </RevealView>

          {reviewsLoading ? (
            <ActivityIndicator color={C.gold} style={{ marginVertical: 28 }} />
          ) : reviews.length === 0 ? (
            <RevealView>
              <Text style={{ color: 'rgba(245,240,232,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                No guest reviews yet — share yours after your stay.
              </Text>
            </RevealView>
          ) : (
            reviews.map((review, i) => (
              <RevealView key={review.id} delay={i * 80}>
                <ReviewCard
                  review={review}
                  onEdit={() => openEdit(review)}
                  onDelete={() => handleDelete(review)}
                />
              </RevealView>
            ))
          )}

          <RevealView style={s.addReviewWrap}>
            <TouchableOpacity
              style={s.btnAddReview}
              onPress={() => setAddOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={s.btnAddReviewText}>+ Share Your Experience</Text>
            </TouchableOpacity>
            <Text style={s.addReviewNote}>Your review helps future guests discover the magic</Text>
          </RevealView>
        </View>

        {/* ── FOOTER ────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerLogo}>Maison Velour</Text>
          <View style={s.footerLinks}>
            <TouchableOpacity onPress={() => navigation?.navigate('StaffLogin')}>
              <Text style={s.footerLink}>Staff Login</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation?.navigate('AdminLogin')}>
              <Text style={s.footerLink}>Admin Login</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.footerCopy}>© 2026 Maison Velour. All rights reserved.</Text>
        </View>

      </ScrollView>

      {/* ── ADD REVIEW MODAL ──────────────────────────────────── */}
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAddOpen(false)}
          />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <TouchableOpacity style={s.modalCloseBtn} onPress={() => setAddOpen(false)}>
              <Text style={s.modalCloseText}>×</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Share your stay</Text>
            <Text style={s.modalSub}>We'd love to hear about your experience at Maison Velour</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
              <View style={s.formGroup}>
                <Text style={s.label}>Name</Text>
                <TextInput style={s.input} placeholder="Your name" placeholderTextColor={C.lightGray}
                  value={newName} onChangeText={setNewName} />
              </View>

              <View style={s.formGroup}>
                <Text style={s.label}>Rating</Text>
                <StarRating rating={newRating} onRate={setNewRating} />
              </View>

              <View style={s.formGroup}>
                <Text style={s.label}>Your Review</Text>
                <TextInput
                  style={[s.input, s.textarea]}
                  placeholder="Tell us about your experience…"
                  placeholderTextColor={C.lightGray}
                  multiline
                  textAlignVertical="top"
                  value={newText}
                  onChangeText={setNewText}
                />
              </View>

              <TouchableOpacity style={s.btnSubmit} onPress={handleSubmit} activeOpacity={0.85}>
                <Text style={s.btnSubmitText}>Submit Review</Text>
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT REVIEW MODAL ─────────────────────────────────── */}
      <Modal
        visible={editOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setEditOpen(false)}
          />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <TouchableOpacity style={s.modalCloseBtn} onPress={() => setEditOpen(false)}>
              <Text style={s.modalCloseText}>×</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Edit your review</Text>
            <Text style={s.modalSub}>Update your star rating or rewrite your experience</Text>

            <View style={s.formGroup}>
              <Text style={s.label}>Rating</Text>
              <StarRating rating={editRating} onRate={setEditRating} />
            </View>

            <View style={s.formGroup}>
              <Text style={s.label}>Your Review</Text>
              <TextInput
                style={[s.input, s.textarea]}
                placeholder="Rewrite your experience…"
                placeholderTextColor={C.lightGray}
                multiline
                textAlignVertical="top"
                value={editText}
                onChangeText={setEditText}
              />
            </View>

            <View style={s.editActions}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setEditOpen(false)}>
                <Text style={s.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSave} onPress={handleSaveEdit} activeOpacity={0.85}>
                <Text style={s.btnSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const NAV_HEIGHT = Platform.OS === 'ios' ? 94 : 72;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.warmWhite },

  // ── Nav ──────────────────────────────────────────────────────────
  nav: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
    paddingBottom: 14,
  },
  navScrolled: { backgroundColor: C.darkBrown, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  navLogo: { color: C.cream, fontSize: 16, fontWeight: '800', letterSpacing: 0.6 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  navLink: { color: C.cream, fontSize: 12, opacity: 0.9 },

  // ── Hero ─────────────────────────────────────────────────────────
  hero: { height: height * 0.88, justifyContent: 'center', overflow: 'hidden' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay },
  heroContent: { paddingHorizontal: 28, paddingTop: NAV_HEIGHT },
  heroTag: { color: C.gold, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 18 },
  heroTitle: { color: C.cream, fontSize: 40, fontWeight: '900', lineHeight: 48, marginBottom: 18, letterSpacing: -0.5 },
  heroTitleItalic: { color: C.gold, fontStyle: 'italic' },
  heroSub: { color: 'rgba(245,240,232,0.78)', fontSize: 15, lineHeight: 25, marginBottom: 36, maxWidth: 310 },
  heroBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  btnGhost: { borderWidth: 1.5, borderColor: 'rgba(245,240,232,0.55)', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 5 },
  btnGhostText: { color: C.cream, fontSize: 14 },

  // ── Shared section layout ─────────────────────────────────────────
  section: { paddingVertical: 64, paddingHorizontal: 24 },
  sectionLabel: { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.brown, fontWeight: '700', marginBottom: 10 },
  sectionTitle: { fontSize: 30, fontWeight: '900', color: C.darkBrown, lineHeight: 38, marginBottom: 18, letterSpacing: -0.3 },
  em: { fontStyle: 'italic', color: C.brown },
  divider: { width: 40, height: 2, backgroundColor: C.brown, marginBottom: 22 },
  body: { color: C.charcoal, fontSize: 15, lineHeight: 26, opacity: 0.78 },

  // ── Gallery ───────────────────────────────────────────────────────
  galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  galleryScroll: { paddingLeft: 24, paddingRight: 8, gap: 12 },
  galleryCard: { width: 220, height: 290, borderRadius: 10, overflow: 'hidden', marginRight: 0 },
  galleryImg: { width: '100%', height: '100%' },
  galleryLabelWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end', padding: 14 },
  galleryLabel: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },

  // ── About ─────────────────────────────────────────────────────────
  aboutBg: { backgroundColor: C.cream },
  aboutImgWrap: { borderRadius: 10, overflow: 'hidden', marginBottom: 36 },
  aboutImg: { width: '100%', height: 270, borderRadius: 10 },
  aboutBadge: {
    position: 'absolute', bottom: 16, right: 16,
    backgroundColor: C.gold, width: 82, height: 82, borderRadius: 41,
    justifyContent: 'center', alignItems: 'center',
  },
  aboutBadgeNum: { color: C.darkBrown, fontSize: 22, fontWeight: '900' },
  aboutBadgeSub: { color: C.darkBrown, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  statsRow: { flexDirection: 'row', marginTop: 30, gap: 0, justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 28, fontWeight: '900', color: C.darkBrown },
  statLbl: { fontSize: 11, color: C.textGray, marginTop: 3, textAlign: 'center' },

  // ── Testimonials ─────────────────────────────────────────────────
  testimonialsBg: { backgroundColor: C.darkBrown },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.18)',
  },
  reviewActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  reviewActionBtn: { borderWidth: 1, borderColor: 'rgba(201,169,110,0.45)', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  reviewActionText: { color: C.gold, fontSize: 12 },
  reviewStars: { color: C.gold, fontSize: 16, marginBottom: 10, letterSpacing: 1 },
  reviewText: { color: C.cream, fontSize: 14, lineHeight: 22, fontStyle: 'italic', marginBottom: 18, opacity: 0.9 },
  reviewer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brown, justifyContent: 'center', alignItems: 'center' },
  reviewerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  reviewerName: { color: C.cream, fontWeight: '700', fontSize: 14 },
  reviewerMeta: { color: 'rgba(245,240,232,0.5)', fontSize: 12, marginTop: 2 },
  addReviewWrap: { alignItems: 'center', marginTop: 20 },
  btnAddReview: { borderWidth: 1.5, borderColor: C.gold, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 5 },
  btnAddReviewText: { color: C.gold, fontWeight: '700', fontSize: 14 },
  addReviewNote: { color: 'rgba(245,240,232,0.38)', fontSize: 12, marginTop: 12 },

  // ── Footer ────────────────────────────────────────────────────────
  footer: { backgroundColor: '#180d08', paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center' },
  footerLogo: { color: C.cream, fontSize: 22, fontWeight: '800', letterSpacing: 0.8, marginBottom: 22 },
  footerLinks: { flexDirection: 'row', gap: 22, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { color: 'rgba(245,240,232,0.45)', fontSize: 13 },
  footerCopy: { color: 'rgba(245,240,232,0.25)', fontSize: 11 },

  // ── Modal shared ──────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 24, paddingTop: 12, maxHeight: height * 0.9,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: C.lightGray, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalCloseBtn: { position: 'absolute', top: 16, right: 20, zIndex: 10, padding: 4 },
  modalCloseText: { fontSize: 28, color: C.textGray, lineHeight: 28 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: C.darkBrown, marginBottom: 4, marginTop: 4 },
  modalSub: { fontSize: 13, color: C.textGray, marginBottom: 20 },
  formRow: { flexDirection: 'row' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: C.darkBrown, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 },
  input: {
    borderWidth: 1, borderColor: C.lightGray, borderRadius: 7,
    paddingHorizontal: 13, paddingVertical: 11, fontSize: 14,
    color: C.charcoal, backgroundColor: C.warmWhite,
  },
  textarea: { height: 110, textAlignVertical: 'top', paddingTop: 11 },
  btnSubmit: { backgroundColor: C.brown, padding: 16, borderRadius: 7, alignItems: 'center', marginTop: 6 },
  btnSubmitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 },
  btnCancel: { flex: 1, borderWidth: 1, borderColor: C.lightGray, padding: 15, borderRadius: 7, alignItems: 'center' },
  btnCancelText: { color: C.textGray, fontWeight: '600', fontSize: 14 },
  btnSave: { flex: 1, backgroundColor: C.brown, padding: 15, borderRadius: 7, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
