import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminAuthProvider } from './src/context/AdminAuthContext';
import { CustomerAuthProvider } from './src/context/CustomerAuthContext';
import { StaffAuthProvider } from './src/context/StaffAuthContext';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import StaffLoginScreen from './src/screens/StaffLoginScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import RoomManagerDashboardScreen from './src/screens/RoomManagerDashboardScreen';
import KitchenManagerDashboardScreen from './src/screens/KitchenManagerDashboardScreen';
import CustomerManagerDashboardScreen from './src/screens/CustomerManagerDashboardScreen';
import ReviewManagerDashboardScreen from './src/screens/ReviewManagerDashboardScreen';
import ReceptionistDashboardScreen from './src/screens/ReceptionistDashboardScreen';
import HomeScreen from './src/screens/HomeScreen';
import RoomsScreen from './src/screens/RoomsScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import FoodScreen from './src/screens/FoodScreen';
import ReviewsScreen from './src/screens/ReviewsScreen';
import StaffScreen from './src/screens/StaffScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AdminAuthProvider>
        <StaffAuthProvider>
          <CustomerAuthProvider>
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                  headerTintColor: '#3d2b1f',
                  headerTitleStyle: { fontWeight: '700' },
                  headerBackTitle: 'Back',
                }}
              >
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="StaffLogin"
                component={StaffLoginScreen}
                options={{ title: 'Staff Sign In' }}
              />
              <Stack.Screen
                name="AdminLogin"
                component={AdminLoginScreen}
                options={{ title: 'Admin Sign In' }}
              />
              <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{ title: 'Admin Dashboard' }}
              />
              <Stack.Screen
                name="RoomManagerDashboard"
                component={RoomManagerDashboardScreen}
                options={{ title: 'Room Manager Dashboard' }}
              />
              <Stack.Screen
                name="KitchenManagerDashboard"
                component={KitchenManagerDashboardScreen}
                options={{ title: 'Kitchen Manager Dashboard' }}
              />
              <Stack.Screen
                name="CustomerManagerDashboard"
                component={CustomerManagerDashboardScreen}
                options={{ title: 'Customer Manager Dashboard' }}
              />
              <Stack.Screen
                name="ReviewManagerDashboard"
                component={ReviewManagerDashboardScreen}
                options={{ title: 'Review Manager Dashboard' }}
              />
              <Stack.Screen
                name="ReceptionistDashboard"
                component={ReceptionistDashboardScreen}
                options={{ title: 'Receptionist Dashboard' }}
              />
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen name="Rooms" component={RoomsScreen} options={{ title: 'Room Management' }} />
              <Stack.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />
              <Stack.Screen name="Food" component={FoodScreen} options={{ title: 'Restaurant Menu' }} />
              <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ title: 'Reviews' }} />
              <Stack.Screen name="Staff" component={StaffScreen} options={{ title: 'Staff Directory' }} />
              <Stack.Screen name="MyProfile" component={CustomerProfileScreen} options={{ title: 'My Profile' }} />
              </Stack.Navigator>
            </NavigationContainer>
          </CustomerAuthProvider>
        </StaffAuthProvider>
      </AdminAuthProvider>
    </SafeAreaProvider>
  );
}
