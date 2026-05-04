import DateTimePicker from '@react-native-community/datetimepicker';
import React, { createElement, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../api/axios';
import { useAdminAuth } from '../context/AdminAuthContext';

const ISSUE_STATUS_OPTIONS = ['submitted', 'assigned', 'in_progress', 'resolved'];

/** Portal demo logins — must stay in sync with `backend/seed/bootstrap.js` PORTAL_TEAM. */
const PORTAL_TEAM_REFERENCE = [
  { role: 'Room Manager', username: 'room_manager', password: 'room_manager123' },
  { role: 'Kitchen Manager', username: 'kitchen_manager', password: 'kitchen_manager123' },
  { role: 'Review Manager', username: 'review_manager', password: 'review_manager123' },
  { role: 'Receptionist', username: 'receptionist', password: 'receptionist123' },
  { role: 'Customer Manager', username: 'customer_manager', password: 'customer_manager123' },
];

const DEMO_PASSWORD_BY_USERNAME = Object.fromEntries(
  PORTAL_TEAM_REFERENCE.map((r) => [r.username, r.password])
);

/** Expected portal manager roles (matches backend `reports.js`). */
const PORTAL_MANAGER_ROLE_NAMES = ['Room Manager', 'Kitchen Manager', 'Review Manager', 'Customer Manager'];

const PORTAL_USERNAME_ORDER = PORTAL_TEAM_REFERENCE.map((r) => r.username);

function portalUsernameSort(a, b) {
  const ua = a.username || '';
  const ub = b.username || '';
  const ia = PORTAL_USERNAME_ORDER.indexOf(ua);
  const ib = PORTAL_USERNAME_ORDER.indexOf(ub);
  if (ia === -1 && ib === -1) return ua.localeCompare(ub);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function formatShiftDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  } catch {
    return String(value);
  }
}

/** Display format (fallback for locale errors). */
function formatDdMmYyyyHm(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function makeTimeDate(hours, minutes) {
  const t = new Date();
  t.setHours(hours, minutes, 0, 0);
  return t;
}

function combineDayAndTime(day, timeDate) {
  const out = startOfDay(day);
  out.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
  return out;
}

function shiftBoundsFromParts(day, startTime, endTime) {
  const start = combineDayAndTime(day, startTime);
  let end = combineDayAndTime(day, endTime);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function clockFromDate(d) {
  return makeTimeDate(d.getHours(), d.getMinutes());
}

function formatLocaleDateShort(d) {
  if (!d || Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return formatDdMmYyyyHm(d).split(' ')[0] || '—';
  }
}

function formatTimeHm(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatYyyyMmDd(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYyyyMmDd(str) {
  const m = String(str ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const dt = new Date(y, mo, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
  return dt;
}

function initialShiftDay() {
  return startOfDay(new Date());
}

const USE_DOM_SCHEDULE_INPUTS = Platform.OS === 'web';
const SHIFT_NATIVE_PICKER = Platform.OS === 'ios' || Platform.OS === 'android';

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const scheduleWideLayout = windowWidth >= 560;
  const { username, logout } = useAdminAuth();

  const handleSignOut = useCallback(() => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
  }, [logout, navigation]);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState(null);
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [issues, setIssues] = useState([]);
  const [assignableStaff, setAssignableStaff] = useState([]);

  const [newShiftStaffId, setNewShiftStaffId] = useState('');
  const [newShiftDay, setNewShiftDay] = useState(initialShiftDay);
  const [newShiftStartTime, setNewShiftStartTime] = useState(() => makeTimeDate(9, 0));
  const [newShiftEndTime, setNewShiftEndTime] = useState(() => makeTimeDate(17, 0));
  const [newShiftLabel, setNewShiftLabel] = useState('');
  const [newShiftNotes, setNewShiftNotes] = useState('');

  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [staffDropdownVisible, setStaffDropdownVisible] = useState(false);

  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false);
  const [schedulePickerTarget, setSchedulePickerTarget] = useState(null);
  const [schedulePickerValue, setSchedulePickerValue] = useState(() => new Date());
  const schedulePickerTargetRef = useRef(null);

  const [editShiftModalVisible, setEditShiftModalVisible] = useState(false);
  const [editStaffDropdownVisible, setEditStaffDropdownVisible] = useState(false);
  const [editShiftId, setEditShiftId] = useState(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editShiftDay, setEditShiftDay] = useState(initialShiftDay);
  const [editStartTime, setEditStartTime] = useState(() => makeTimeDate(9, 0));
  const [editEndTime, setEditEndTime] = useState(() => makeTimeDate(17, 0));
  const [editLabel, setEditLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const closePwdModal = useCallback(() => {
    setPwdModalVisible(false);
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
  }, []);

  /** Anyone with a portal username (matches “Team” table in admin reference). */
  const portalTeamRows = useMemo(
    () => staff.filter((s) => s.username && String(s.username).trim()),
    [staff]
  );

  /** Only active portal staff can be assigned new shifts. */
  const shiftEligibleStaff = useMemo(
    () => portalTeamRows.filter((s) => s.active !== false),
    [portalTeamRows]
  );

  /** Include current assignee when editing if they are inactive / off-portal-list. */
  const editStaffPickList = useMemo(() => {
    const eligible = shiftEligibleStaff;
    if (!editStaffId) return eligible;
    if (eligible.some((s) => String(s._id) === String(editStaffId))) return eligible;
    const extra = staff.find((s) => String(s._id) === String(editStaffId));
    return extra ? [...eligible, extra] : eligible;
  }, [shiftEligibleStaff, staff, editStaffId]);

  const selectedEditStaff = useMemo(
    () => editStaffPickList.find((s) => String(s._id) === String(editStaffId)) || null,
    [editStaffPickList, editStaffId]
  );

  const selectedShiftStaff = useMemo(
    () => shiftEligibleStaff.find((s) => s._id === newShiftStaffId) || null,
    [shiftEligibleStaff, newShiftStaffId]
  );

  const portalDisplayRows = useMemo(() => {
    if (portalTeamRows.length === 0) {
      return PORTAL_TEAM_REFERENCE.map((r) => ({
        key: `ref-${r.username}`,
        role: r.role,
        username: r.username,
        password: r.password,
        inactive: false,
      }));
    }
    return [...portalTeamRows].sort(portalUsernameSort).map((s) => ({
      key: s._id,
      role: s.role?.name || '—',
      username: s.username || '—',
      password: DEMO_PASSWORD_BY_USERNAME[s.username] || '—',
      inactive: s.active === false,
    }));
  }, [portalTeamRows]);

  /** Merge `/reports/summary` with loaded lists so counts refresh after bootstrap / create shift even if responses diverge. */
  const dashboardMetrics = useMemo(() => {
    const derivedStaffTotal = staff.length;
    const derivedStaffActive = staff.filter((s) => s.active !== false).length;

    const roleNamesPresent = new Set(
      staff.map((s) => (s.role && typeof s.role === 'object' ? s.role.name : null)).filter(Boolean)
    );
    const derivedRolesManagers = PORTAL_MANAGER_ROLE_NAMES.filter((n) => roleNamesPresent.has(n)).length;

    const derivedShifts = shifts.length;

    const apiTotal = summary?.staff?.total;
    const apiActive = summary?.staff?.active;
    const apiRolesManagers = summary?.rolesManagers;
    const apiShifts = summary?.shifts;

    return {
      staffTotal: Math.max(apiTotal ?? 0, derivedStaffTotal),
      staffActive: Math.max(apiActive ?? 0, derivedStaffActive),
      rolesManagers: Math.max(apiRolesManagers ?? 0, derivedRolesManagers),
      shifts: Math.max(apiShifts ?? 0, derivedShifts),
    };
  }, [summary, staff, shifts]);

  const refreshAll = useCallback(async () => {
    try {
      const [summaryRes, staffRes, shiftsRes, issuesRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/staff'),
        api.get('/shifts'),
        api.get('/admin/issues'),
      ]);
      setSummary(summaryRes.data);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
      setShifts(Array.isArray(shiftsRes.data) ? shiftsRes.data : []);
      setIssues(Array.isArray(issuesRes.data?.issues) ? issuesRes.data.issues : []);
      setAssignableStaff(Array.isArray(issuesRes.data?.assignableStaff) ? issuesRes.data.assignableStaff : []);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  const commitSchedulePicker = useCallback((target, date) => {
    if (!target || !date) return;
    const { form, part } = target;
    if (part === 'day') {
      const day = startOfDay(date);
      if (form === 'create') setNewShiftDay(day);
      else setEditShiftDay(day);
      return;
    }
    const clock = clockFromDate(date);
    if (part === 'start') {
      if (form === 'create') setNewShiftStartTime(clock);
      else setEditStartTime(clock);
    } else {
      if (form === 'create') setNewShiftEndTime(clock);
      else setEditEndTime(clock);
    }
  }, []);

  const openSchedulePicker = useCallback(
    (form, part) => {
      const target = { form, part };
      schedulePickerTargetRef.current = target;
      setSchedulePickerTarget(target);
      let d = new Date();
      if (form === 'create') {
        if (part === 'day') d = new Date(newShiftDay);
        else if (part === 'start') d = combineDayAndTime(newShiftDay, newShiftStartTime);
        else d = combineDayAndTime(newShiftDay, newShiftEndTime);
      } else {
        if (part === 'day') d = new Date(editShiftDay);
        else if (part === 'start') d = combineDayAndTime(editShiftDay, editStartTime);
        else d = combineDayAndTime(editShiftDay, editEndTime);
      }
      setSchedulePickerValue(d);
      setSchedulePickerOpen(true);
    },
    [newShiftDay, newShiftStartTime, newShiftEndTime, editShiftDay, editStartTime, editEndTime]
  );

  const closeSchedulePicker = useCallback(() => {
    setSchedulePickerOpen(false);
    setSchedulePickerTarget(null);
    schedulePickerTargetRef.current = null;
  }, []);

  const onSchedulePickerAndroidChange = useCallback(
    (event, date) => {
      if (event.type === 'set' && date) {
        const target = schedulePickerTargetRef.current;
        if (target) commitSchedulePicker(target, date);
      }
      closeSchedulePicker();
    },
    [commitSchedulePicker, closeSchedulePicker]
  );

  const applyNewShiftDurationHours = useCallback((hours) => {
    const base = new Date(newShiftStartTime);
    base.setHours(base.getHours() + hours);
    setNewShiftEndTime(clockFromDate(base));
  }, [newShiftStartTime]);

  const onCreateShift = async () => {
    try {
      const { start, end } = shiftBoundsFromParts(newShiftDay, newShiftStartTime, newShiftEndTime);
      if (!newShiftStaffId) {
        Alert.alert('Error', 'Choose a staff member.');
        return;
      }
      await api.post('/shifts', {
        staff: newShiftStaffId.trim(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        label: newShiftLabel.trim(),
        notes: newShiftNotes.trim(),
      });
      setNewShiftStaffId('');
      setNewShiftDay(initialShiftDay());
      setNewShiftStartTime(makeTimeDate(9, 0));
      setNewShiftEndTime(makeTimeDate(17, 0));
      setNewShiftLabel('');
      setNewShiftNotes('');
      refreshAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not create shift');
    }
  };

  const onDeleteShift = useCallback(async (id) => {
    const sid = String(id ?? '').trim();
    if (!sid) return;
    try {
      await api.delete(`/shifts/${encodeURIComponent(sid)}`);
      refreshAll();
    } catch (error) {
      const msg = error?.response?.data?.error || 'Could not delete shift';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  }, [refreshAll]);

  const confirmDeleteShift = useCallback((sh) => {
    const id = sh?._id != null ? String(sh._id) : '';
    if (!id) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Cannot delete: invalid shift.');
      } else {
        Alert.alert('Error', 'Cannot delete this shift.');
      }
      return;
    }
    const name = sh.staff?.name || 'this shift';
    const message = `Remove the scheduled shift for ${name}?`;

    /** RN Web often breaks multi-button `Alert.alert`; use DOM confirm on web. */
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(message)) {
        onDeleteShift(id);
      }
      return;
    }

    Alert.alert('Delete shift', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteShift(id),
      },
    ]);
  }, [onDeleteShift]);

  const openEditShift = useCallback((sh) => {
    const sid = sh.staff && typeof sh.staff === 'object' ? sh.staff._id : sh.staff;
    setEditShiftId(sh._id);
    setEditStaffId(String(sid || ''));
    const startD = new Date(sh.startAt);
    const endD = new Date(sh.endAt);
    if (!Number.isNaN(startD.getTime())) {
      setEditShiftDay(startOfDay(startD));
      setEditStartTime(clockFromDate(startD));
    } else {
      setEditShiftDay(initialShiftDay());
      setEditStartTime(makeTimeDate(9, 0));
    }
    if (!Number.isNaN(endD.getTime())) {
      setEditEndTime(clockFromDate(endD));
    } else {
      setEditEndTime(makeTimeDate(17, 0));
    }
    setEditLabel(sh.label || '');
    setEditNotes(sh.notes || '');
    setEditStaffDropdownVisible(false);
    setEditShiftModalVisible(true);
  }, []);

  const closeEditShiftModal = useCallback(() => {
    setEditShiftModalVisible(false);
    setEditStaffDropdownVisible(false);
    setEditShiftId(null);
    setEditStaffId('');
    setEditShiftDay(initialShiftDay());
    setEditStartTime(makeTimeDate(9, 0));
    setEditEndTime(makeTimeDate(17, 0));
    setEditLabel('');
    setEditNotes('');
  }, []);

  const saveEditedShift = async () => {
    try {
      const { start, end } = shiftBoundsFromParts(editShiftDay, editStartTime, editEndTime);
      if (!editShiftId || !editStaffId) {
        Alert.alert('Error', 'Staff is required.');
        return;
      }
      await api.patch(`/shifts/${editShiftId}`, {
        staff: editStaffId.trim(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        label: editLabel.trim(),
        notes: editNotes.trim(),
      });
      closeEditShiftModal();
      refreshAll();
      Alert.alert('Success', 'Shift updated');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update shift');
    }
  };

  const onAssignIssue = async (issueId, staffId) => {
    try {
      await api.patch(`/admin/issues/${issueId}`, { assignedStaff: staffId || null });
      refreshAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not assign issue');
    }
  };

  const onChangeAdminPassword = async () => {
    try {
      if (!pwdCurrent || !pwdNew) {
        Alert.alert('Error', 'Enter current and new password');
        return;
      }
      if (pwdNew.length < 6) {
        Alert.alert('Error', 'New password must be at least 6 characters');
        return;
      }
      if (pwdNew !== pwdConfirm) {
        Alert.alert('Error', 'New password and confirmation do not match');
        return;
      }
      await api.post('/auth/change-password', {
        currentPassword: pwdCurrent,
        newPassword: pwdNew,
      });
      closePwdModal();
      Alert.alert('Success', 'Password updated');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not change password');
    }
  };

  const onAdvanceIssueStatus = async (issue) => {
    try {
      const current = issue.status || 'submitted';
      const currentIndex = ISSUE_STATUS_OPTIONS.indexOf(current);
      const nextStatus = ISSUE_STATUS_OPTIONS[Math.min(currentIndex + 1, ISSUE_STATUS_OPTIONS.length - 1)];
      await api.patch(`/admin/issues/${issue._id}`, { status: nextStatus });
      refreshAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update issue status');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#c9a96e" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Admin Dashboard</Text>
              <Text style={styles.subTitle}>Signed in as {username || 'admin'}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setPwdModalVisible(true)}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>Change password</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleSignOut} accessibilityRole="button">
                <Text style={styles.secondaryBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dashboard</Text>
        <Text style={styles.dashboardHint}>Counts refresh after load and when you create shifts.</Text>
        <Text style={styles.rowText}>Staff total: {dashboardMetrics.staffTotal}</Text>
        <Text style={styles.rowText}>Staff active: {dashboardMetrics.staffActive}</Text>
        <Text style={styles.rowText}>Roles (portal managers): {dashboardMetrics.rolesManagers}</Text>
        <Text style={styles.rowText}>Shifts: {dashboardMetrics.shifts}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Staff & shifts · Team (portal logins)</Text>
        <Text style={styles.sectionHint}>
          Role · username · default password (bootstrap seed). Change passwords after go-live.
        </Text>
        {portalTeamRows.length === 0 ? (
          <Text style={styles.teamBootstrapNote}>No portal staff from API — showing seeded defaults.</Text>
        ) : null}
        <View style={styles.teamTable}>
          <View style={styles.teamTableHeader}>
            <Text style={[styles.teamTh, styles.teamColRole]}>Role</Text>
            <Text style={[styles.teamTh, styles.teamColUser]}>Username</Text>
            <Text style={[styles.teamTh, styles.teamColPwd]}>Password</Text>
          </View>
          {portalDisplayRows.map((row, idx) => (
            <View
              key={row.key}
              style={[styles.teamTableRow, idx === portalDisplayRows.length - 1 && styles.teamTableRowLast]}
            >
              <View style={[styles.teamColRole, styles.teamRoleCell]}>
                <Text style={styles.teamTd} numberOfLines={2}>
                  {row.role}
                  {row.inactive ? ' · inactive' : ''}
                </Text>
              </View>
              <View style={styles.teamColUser}>
                <View style={styles.teamCodeChip}>
                  <Text style={styles.teamCodeChipText} selectable>
                    {row.username}
                  </Text>
                </View>
              </View>
              <View style={styles.teamColPwd}>
                <View style={styles.teamCodeChip}>
                  <Text style={styles.teamCodeChipText} selectable>
                    {row.password}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule shift</Text>
        <Text style={styles.sectionHint}>
          Choose staff, one shift date, then start and end time. If end is earlier on the clock, it counts as the next day.
        </Text>
        {shiftEligibleStaff.length === 0 ? (
          <Text style={styles.rowSub}>No active portal staff to assign.</Text>
        ) : (
          <>
            <View style={[styles.scheduleGridTop, !scheduleWideLayout && styles.scheduleGridTopStacked]}>
              <View
                style={[styles.scheduleField, scheduleWideLayout ? styles.scheduleStaffWide : styles.scheduleFieldFull]}
              >
                <Text style={styles.scheduleLabel}>STAFF MEMBER</Text>
                <TouchableOpacity
                  style={styles.scheduleSelect}
                  onPress={() => setStaffDropdownVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choose staff member"
                >
                  <Text style={styles.scheduleSelectText} numberOfLines={1}>
                    {selectedShiftStaff
                      ? `${selectedShiftStaff.name} (${selectedShiftStaff.role?.name || ''})`
                      : 'Select staff member'}
                  </Text>
                  <Text style={styles.scheduleChevron}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.scheduleDateTimeRow, !scheduleWideLayout && styles.scheduleDateTimeRowStacked]}>
              <View
                style={[styles.scheduleField, scheduleWideLayout ? styles.scheduleFieldTimeWide : styles.scheduleFieldFull]}
              >
                <Text style={styles.scheduleLabel}>SHIFT DATE</Text>
                {USE_DOM_SCHEDULE_INPUTS ? (
                  <View style={styles.scheduleWebInputShell}>
                    {createElement('input', {
                      type: 'date',
                      value: formatYyyyMmDd(newShiftDay),
                      onChange: (e) => {
                        const v = e?.target?.value;
                        const d = parseYyyyMmDd(v);
                        if (d) setNewShiftDay(startOfDay(d));
                      },
                      style: styles.scheduleWebInput,
                    })}
                  </View>
                ) : SHIFT_NATIVE_PICKER ? (
                  <TouchableOpacity
                    style={[
                      styles.scheduleInputRow,
                      schedulePickerOpen &&
                        schedulePickerTarget?.form === 'create' &&
                        schedulePickerTarget?.part === 'day' &&
                        styles.scheduleInputRowFocused,
                    ]}
                    onPress={() => openSchedulePicker('create', 'day')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.scheduleInputLikeText} numberOfLines={2}>
                      {formatLocaleDateShort(newShiftDay)}
                    </Text>
                    <Text style={styles.scheduleCalendarGlyph}>📅</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View
                style={[styles.scheduleField, scheduleWideLayout ? styles.scheduleFieldTimeWide : styles.scheduleFieldFull]}
              >
                <Text style={styles.scheduleLabel}>START TIME</Text>
                {USE_DOM_SCHEDULE_INPUTS ? (
                  <View style={styles.scheduleWebInputShell}>
                    {createElement('input', {
                      type: 'time',
                      value: formatTimeHm(newShiftStartTime),
                      onChange: (e) => {
                        const v = e?.target?.value;
                        if (!v) return;
                        const parts = v.split(':');
                        const h = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        if (Number.isFinite(h) && Number.isFinite(m)) setNewShiftStartTime(makeTimeDate(h, m));
                      },
                      style: styles.scheduleWebInput,
                    })}
                  </View>
                ) : SHIFT_NATIVE_PICKER ? (
                  <TouchableOpacity
                    style={[
                      styles.scheduleInputRow,
                      schedulePickerOpen &&
                        schedulePickerTarget?.form === 'create' &&
                        schedulePickerTarget?.part === 'start' &&
                        styles.scheduleInputRowFocused,
                    ]}
                    onPress={() => openSchedulePicker('create', 'start')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.scheduleInputLikeText} numberOfLines={1}>
                      {formatTimeHm(newShiftStartTime)}
                    </Text>
                    <Text style={styles.scheduleCalendarGlyph}>🕐</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View
                style={[styles.scheduleField, scheduleWideLayout ? styles.scheduleFieldTimeWide : styles.scheduleFieldFull]}
              >
                <Text style={styles.scheduleLabel}>END TIME</Text>
                {USE_DOM_SCHEDULE_INPUTS ? (
                  <View style={styles.scheduleWebInputShell}>
                    {createElement('input', {
                      type: 'time',
                      value: formatTimeHm(newShiftEndTime),
                      onChange: (e) => {
                        const v = e?.target?.value;
                        if (!v) return;
                        const parts = v.split(':');
                        const h = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        if (Number.isFinite(h) && Number.isFinite(m)) setNewShiftEndTime(makeTimeDate(h, m));
                      },
                      style: styles.scheduleWebInput,
                    })}
                  </View>
                ) : SHIFT_NATIVE_PICKER ? (
                  <TouchableOpacity
                    style={[
                      styles.scheduleInputRow,
                      schedulePickerOpen &&
                        schedulePickerTarget?.form === 'create' &&
                        schedulePickerTarget?.part === 'end' &&
                        styles.scheduleInputRowFocused,
                    ]}
                    onPress={() => openSchedulePicker('create', 'end')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.scheduleInputLikeText} numberOfLines={1}>
                      {formatTimeHm(newShiftEndTime)}
                    </Text>
                    <Text style={styles.scheduleCalendarGlyph}>🕐</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.scheduleQuickRow}>
              <Text style={styles.scheduleQuickLabel}>Shift length</Text>
              <View style={styles.scheduleQuickChips}>
                {[4, 8, 12].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={styles.scheduleQuickChip}
                    onPress={() => applyNewShiftDurationHours(h)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set end time ${h} hours after start`}
                  >
                    <Text style={styles.scheduleQuickChipText}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.scheduleGridTop, !scheduleWideLayout && styles.scheduleGridTopStacked]}>
              <View
                style={[styles.scheduleField, scheduleWideLayout ? styles.scheduleFieldLabelWide : styles.scheduleFieldFull]}
              >
                <Text style={styles.scheduleLabel}>LABEL</Text>
                <View style={styles.scheduleInputBorder}>
                  <TextInput
                    style={[styles.scheduleInput, styles.scheduleInputFlex]}
                    placeholder=""
                    value={newShiftLabel}
                    onChangeText={setNewShiftLabel}
                  />
                </View>
              </View>
            </View>
            <View style={[styles.scheduleNotesRow, !scheduleWideLayout && styles.scheduleNotesRowStacked]}>
              <View style={styles.scheduleNotesField}>
                <Text style={styles.scheduleLabel}>NOTES</Text>
                <TextInput
                  style={styles.scheduleNotesMultiline}
                  placeholder=""
                  value={newShiftNotes}
                  onChangeText={setNewShiftNotes}
                  multiline
                />
              </View>
              <TouchableOpacity
                style={[styles.scheduleCreateBtn, !scheduleWideLayout && styles.scheduleCreateBtnFull]}
                onPress={onCreateShift}
              >
                <Text style={styles.scheduleCreateBtnText}>CREATE SHIFT</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.scheduleFootnote}>
              Defaults: 09:00–17:00 on today&apos;s date. Tap chips to set length from start. Overnight shifts: end time earlier than start time rolls to the next calendar day.
            </Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All shifts</Text>
        <Text style={styles.sectionHint}>Staff · Start · End · Label</Text>
        {shifts.length === 0 ? (
          <Text style={styles.rowSub}>No shifts scheduled.</Text>
        ) : (
          shifts.map((sh) => (
            <View key={sh._id} style={styles.shiftBlock}>
              <View style={styles.listRow}>
                <Text style={styles.rowText}>{sh.staff?.name || 'Unknown'}</Text>
                <View style={styles.shiftRowActions}>
                  <TouchableOpacity onPress={() => openEditShift(sh)} accessibilityRole="button">
                    <Text style={styles.linkText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteShift(sh)} accessibilityRole="button">
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.rowSub}>Start: {formatShiftDate(sh.startAt)}</Text>
              <Text style={styles.rowSub}>End: {formatShiftDate(sh.endAt)}</Text>
              <Text style={styles.rowSub}>Label: {sh.label || '—'}</Text>
              {sh.notes ? <Text style={styles.rowSub}>Notes: {sh.notes}</Text> : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reported Issues</Text>
        {issues.map((issue) => (
          <View key={issue._id} style={styles.itemBox}>
            <Text style={styles.rowText}>Room {issue.room?.roomNumber || '?'} · {issue.issueType}</Text>
            <Text style={styles.rowSub}>Priority: {issue.priority} | Status: {issue.status}</Text>
            <Text style={styles.rowSub}>Assigned: {issue.assignedStaff?.name || 'Unassigned'}</Text>
            <View style={styles.rowActions}>
              <TouchableOpacity onPress={() => onAdvanceIssueStatus(issue)}>
                <Text style={styles.linkText}>Advance Status</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onAssignIssue(issue._id, assignableStaff[0]?._id || null)}
              >
                <Text style={styles.linkText}>Assign First Staff</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
      </ScrollView>

      <Modal
        visible={staffDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStaffDropdownVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setStaffDropdownVisible(false)}
          />
          <View style={styles.dropdownSheet}>
            <Text style={styles.dropdownTitle}>Staff member</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
              {shiftEligibleStaff.map((s) => (
                <TouchableOpacity
                  key={s._id}
                  style={styles.dropdownRow}
                  onPress={() => {
                    setNewShiftStaffId(s._id);
                    setStaffDropdownVisible(false);
                  }}
                >
                  <Text style={styles.rowText}>{s.name}</Text>
                  <Text style={styles.rowSub}>
                    {s.role?.name || ''} · {s.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editShiftModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditShiftModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeEditShiftModal} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.editShiftScroll}
            contentContainerStyle={styles.editShiftScrollContent}
          >
            <View style={[styles.modalSheet, styles.editShiftSheet]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit shift</Text>
                <TouchableOpacity
                  onPress={closeEditShiftModal}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.modalClose}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Staff member</Text>
              <TouchableOpacity
                style={[styles.scheduleSelect, editStaffPickList.length === 0 && styles.scheduleSelectDisabled]}
                onPress={() => setEditStaffDropdownVisible(true)}
                disabled={editStaffPickList.length === 0}
              >
                <Text style={styles.scheduleSelectText} numberOfLines={1}>
                  {selectedEditStaff
                    ? `${selectedEditStaff.name} (${selectedEditStaff.role?.name || ''})`
                    : 'Select staff member'}
                </Text>
                <Text style={styles.scheduleChevron}>▼</Text>
              </TouchableOpacity>
              <Text style={styles.fieldLabel}>Shift date</Text>
              {USE_DOM_SCHEDULE_INPUTS ? (
                <View style={styles.scheduleWebInputShell}>
                  {createElement('input', {
                    type: 'date',
                    value: formatYyyyMmDd(editShiftDay),
                    onChange: (e) => {
                      const v = e?.target?.value;
                      const d = parseYyyyMmDd(v);
                      if (d) setEditShiftDay(startOfDay(d));
                    },
                    style: styles.scheduleWebInput,
                  })}
                </View>
              ) : SHIFT_NATIVE_PICKER ? (
                <TouchableOpacity
                  style={styles.scheduleInputRow}
                  onPress={() => openSchedulePicker('edit', 'day')}
                  activeOpacity={0.88}
                >
                  <Text style={styles.scheduleInputLikeText}>{formatLocaleDateShort(editShiftDay)}</Text>
                  <Text style={styles.scheduleCalendarGlyph}>📅</Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.fieldLabel}>Start time</Text>
              {USE_DOM_SCHEDULE_INPUTS ? (
                <View style={styles.scheduleWebInputShell}>
                  {createElement('input', {
                    type: 'time',
                    value: formatTimeHm(editStartTime),
                    onChange: (e) => {
                      const v = e?.target?.value;
                      if (!v) return;
                      const parts = v.split(':');
                      const h = parseInt(parts[0], 10);
                      const m = parseInt(parts[1], 10);
                      if (Number.isFinite(h) && Number.isFinite(m)) setEditStartTime(makeTimeDate(h, m));
                    },
                    style: styles.scheduleWebInput,
                  })}
                </View>
              ) : SHIFT_NATIVE_PICKER ? (
                <TouchableOpacity
                  style={styles.scheduleInputRow}
                  onPress={() => openSchedulePicker('edit', 'start')}
                  activeOpacity={0.88}
                >
                  <Text style={styles.scheduleInputLikeText}>{formatTimeHm(editStartTime)}</Text>
                  <Text style={styles.scheduleCalendarGlyph}>🕐</Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.fieldLabel}>End time</Text>
              {USE_DOM_SCHEDULE_INPUTS ? (
                <View style={styles.scheduleWebInputShell}>
                  {createElement('input', {
                    type: 'time',
                    value: formatTimeHm(editEndTime),
                    onChange: (e) => {
                      const v = e?.target?.value;
                      if (!v) return;
                      const parts = v.split(':');
                      const h = parseInt(parts[0], 10);
                      const m = parseInt(parts[1], 10);
                      if (Number.isFinite(h) && Number.isFinite(m)) setEditEndTime(makeTimeDate(h, m));
                    },
                    style: styles.scheduleWebInput,
                  })}
                </View>
              ) : SHIFT_NATIVE_PICKER ? (
                <TouchableOpacity
                  style={styles.scheduleInputRow}
                  onPress={() => openSchedulePicker('edit', 'end')}
                  activeOpacity={0.88}
                >
                  <Text style={styles.scheduleInputLikeText}>{formatTimeHm(editEndTime)}</Text>
                  <Text style={styles.scheduleCalendarGlyph}>🕐</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.fieldLabel}>Label</Text>
              <TextInput style={styles.input} value={editLabel} onChangeText={setEditLabel} />
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.editNotesInput]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
              />
              <View style={styles.editShiftFooter}>
                <TouchableOpacity style={[styles.secondaryBtn, styles.editShiftFooterBtn]} onPress={closeEditShiftModal}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.editShiftFooterBtn]} onPress={saveEditedShift}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {schedulePickerOpen && Platform.OS === 'android' && schedulePickerTarget ? (
        <DateTimePicker
          value={schedulePickerValue}
          mode={schedulePickerTarget.part === 'day' ? 'date' : 'time'}
          display="default"
          onChange={onSchedulePickerAndroidChange}
        />
      ) : null}

      <Modal
        visible={schedulePickerOpen && Platform.OS === 'ios' && schedulePickerTarget}
        transparent
        animationType="slide"
        onRequestClose={closeSchedulePicker}
      >
        <View style={styles.shiftPickerOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeSchedulePicker} />
          <View style={styles.shiftPickerIosSheet}>
            <View style={styles.shiftPickerToolbar}>
              <TouchableOpacity onPress={closeSchedulePicker} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
                <Text style={styles.shiftPickerToolbarBtn}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const target = schedulePickerTargetRef.current;
                  if (target) commitSchedulePicker(target, schedulePickerValue);
                  closeSchedulePicker();
                }}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              >
                <Text style={[styles.shiftPickerToolbarBtn, styles.shiftPickerToolbarDone]}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={schedulePickerValue}
              mode={schedulePickerTarget?.part === 'day' ? 'date' : 'time'}
              display="spinner"
              themeVariant="light"
              onChange={(_, date) => {
                if (date) setSchedulePickerValue(date);
              }}
              style={styles.shiftPickerSpinner}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={editStaffDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditStaffDropdownVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditStaffDropdownVisible(false)}
          />
          <View style={styles.dropdownSheet}>
            <Text style={styles.dropdownTitle}>Staff member</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
              {editStaffPickList.map((s) => (
                <TouchableOpacity
                  key={s._id}
                  style={styles.dropdownRow}
                  onPress={() => {
                    setEditStaffId(String(s._id));
                    setEditStaffDropdownVisible(false);
                  }}
                >
                  <Text style={styles.rowText}>{s.name}</Text>
                  <Text style={styles.rowSub}>
                    {s.role?.name || ''} · {s.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pwdModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePwdModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closePwdModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change password</Text>
              <TouchableOpacity onPress={closePwdModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionHint}>Administrator account</Text>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              value={pwdCurrent}
              onChangeText={setPwdCurrent}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="New password (min 6 chars)"
              value={pwdNew}
              onChangeText={setPwdNew}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              value={pwdConfirm}
              onChangeText={setPwdConfirm}
              secureTextEntry
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={onChangeAdminPassword}>
              <Text style={styles.primaryBtnText}>Update password</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f0e8' },
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f0e8' },
  headerSection: { marginBottom: 14 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: { alignItems: 'flex-end', gap: 8 },
  headerLeft: { flex: 1, paddingRight: 12 },
  title: { fontSize: 30, fontWeight: '800', color: '#3d2b1f' },
  subTitle: { marginTop: 4, color: '#6b6b6b' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3d2b1f', marginBottom: 10 },
  dashboardHint: { fontSize: 12, color: '#6b6b6b', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 11, marginBottom: 8, backgroundColor: '#fff' },
  primaryBtn: { backgroundColor: '#3d2b1f', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  primaryBtnText: { color: '#c9a96e', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#3d2b1f', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  secondaryBtnText: { color: '#3d2b1f', fontWeight: '700' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  shiftRowActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  rowText: { color: '#2a2a2a', fontWeight: '600' },
  rowSub: { color: '#6b6b6b', marginTop: 2 },
  itemBox: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, marginBottom: 8 },
  rowActions: { flexDirection: 'row', gap: 14, marginTop: 8 },
  linkText: { color: '#1f6feb', fontWeight: '600' },
  deleteText: { color: '#b42318', fontWeight: '700' },
  sectionHint: { fontSize: 12, color: '#6b6b6b', marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#3d2b1f', marginBottom: 6 },
  scheduleGridTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  scheduleGridTopStacked: { flexDirection: 'column' },
  scheduleDateTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  scheduleDateTimeRowStacked: { flexDirection: 'column' },
  scheduleField: {},
  scheduleFieldFull: { width: '100%' },
  scheduleStaffWide: {
    flexGrow: 1.25,
    flexShrink: 1,
    minWidth: 170,
  },
  scheduleFieldTimeWide: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 136,
  },
  scheduleFieldLabelWide: {
    flexGrow: 0.85,
    flexShrink: 1,
    minWidth: 104,
  },
  scheduleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b6b6b',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  scheduleSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d5cfc6',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  scheduleSelectText: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#2a2a2a',
  },
  scheduleChevron: { fontSize: 11, color: '#6b6b6b' },
  scheduleSelectDisabled: { opacity: 0.55 },
  scheduleInputBorder: {
    borderWidth: 1,
    borderColor: '#d5cfc6',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
  },
  scheduleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d5cfc6',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  scheduleInput: {
    borderWidth: 0,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 0,
    fontSize: 14,
    color: '#2a2a2a',
    backgroundColor: 'transparent',
  },
  scheduleInputFlex: { flex: 1 },
  scheduleInputLikeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#2a2a2a',
    paddingVertical: Platform.OS === 'ios' ? 11 : 10,
  },
  schedulePlaceholderText: {
    color: '#9a9490',
    fontWeight: '400',
  },
  scheduleInputRowFocused: {
    borderColor: '#1a1a1a',
    borderWidth: 2,
  },
  scheduleCalendarGlyph: { fontSize: 16, marginLeft: 6, opacity: 0.85 },
  scheduleNotesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  scheduleNotesRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  scheduleNotesField: {
    flex: 1,
    minWidth: 0,
  },
  scheduleNotesMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#d5cfc6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#2a2a2a',
  },
  scheduleCreateBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: '#f5f0e8',
    borderWidth: 1,
    borderColor: '#3d2b1f',
    alignSelf: 'flex-end',
  },
  scheduleCreateBtnFull: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  scheduleCreateBtnText: {
    color: '#3d2b1f',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  scheduleFootnote: {
    fontSize: 11,
    color: '#8a827a',
    marginTop: 10,
  },
  scheduleWebInputShell: {
    width: '100%',
  },
  scheduleWebInput: {
    width: '100%',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d5cfc6',
    borderRadius: 8,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#2a2a2a',
  },
  scheduleQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  scheduleQuickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b6b6b',
    marginRight: 4,
  },
  scheduleQuickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scheduleQuickChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c9a96e',
    backgroundColor: '#faf7f2',
  },
  scheduleQuickChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3d2b1f',
  },
  dropdownSheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    maxWidth: 440,
    width: '100%',
    maxHeight: '72%',
    alignSelf: 'center',
    zIndex: 2,
    elevation: 4,
  },
  dropdownTitle: { fontSize: 17, fontWeight: '700', color: '#3d2b1f', marginBottom: 10 },
  dropdownScroll: { flexGrow: 0 },
  dropdownRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e3dc',
  },
  teamTable: {
    marginTop: 4,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0d9cf',
    backgroundColor: '#fff',
  },
  teamTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d2b1f',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  teamTh: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f5f0e8',
  },
  teamTableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    backgroundColor: '#faf9f7',
  },
  teamTableRowLast: {
    borderBottomWidth: 0,
  },
  teamBootstrapNote: {
    fontSize: 12,
    color: '#7a5c45',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  teamTd: { fontSize: 13, fontWeight: '600', color: '#2a2a2a' },
  teamTdMuted: { fontSize: 13, color: '#4a4540' },
  teamRoleCell: { justifyContent: 'center', paddingRight: 6 },
  teamColRole: { flex: 1.05, paddingRight: 4 },
  teamColUser: { flex: 1.05, paddingRight: 6 },
  teamColPwd: { flex: 1.15 },
  teamCodeChip: {
    backgroundColor: '#ece8e2',
    borderWidth: 1,
    borderColor: '#d8d2c9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignSelf: 'stretch',
  },
  teamCodeChipText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#2a241f',
    fontWeight: '600',
  },
  shiftBlock: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  editShiftScroll: {
    width: '100%',
    maxHeight: '88%',
  },
  editShiftScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editShiftSheet: {
    marginVertical: 8,
  },
  editNotesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editShiftFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  editShiftFooterBtn: {
    marginTop: 0,
    marginBottom: 0,
    minWidth: 112,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#3d2b1f' },
  modalClose: { fontSize: 26, color: '#6b6b6b', lineHeight: 28 },
  shiftPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  shiftPickerIosSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    overflow: 'hidden',
  },
  shiftPickerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0d9cf',
  },
  shiftPickerToolbarBtn: {
    fontSize: 17,
    color: '#6b6b6b',
  },
  shiftPickerToolbarDone: {
    fontWeight: '700',
    color: '#3d2b1f',
  },
  shiftPickerSpinner: {
    width: '100%',
    height: 216,
    alignSelf: 'center',
  },
});
