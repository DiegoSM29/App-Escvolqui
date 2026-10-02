import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import ListaJugadores from './screens/ListaJugadores';
import RegistroJugador from './screens/RegistroJugador';
import ReportesScreen from './screens/ReportesScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Inicio"
        screenOptions={{
          headerStyle: { backgroundColor: '#1E88E5' },
          headerTintColor: '#FFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen 
          name="Inicio" 
          component={ListaJugadores} 
          options={{ title: 'Club Escvolqui 🏆' }} 
        />
        <Stack.Screen 
          name="Registro" 
          component={RegistroJugador}
          options={{ title: 'Jugador' }} 
        />
        <Stack.Screen 
          name="Reportes" 
          component={ReportesScreen} 
          options={{ title: 'Reporte de Ingresos 📊' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}