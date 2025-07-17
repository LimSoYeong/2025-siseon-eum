import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SplashScreen = ({ navigation }: any) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Camera'); // 2초 후 카메라로 이동
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>시선이음</Text>
      <Text style={styles.subtitle}>보는 것에서, 이해로. 시선을 잇다.</Text>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 48, fontWeight: 'bold', color: '#111', marginBottom: 32 },
  subtitle: { fontSize: 18, color: '#222' },
});