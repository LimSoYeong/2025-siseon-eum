import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

interface LoadingImageProps {
  onBack?: () => void;
  onRetry?: () => void;
}

const LoadingImage: React.FC<LoadingImageProps> = ({ onBack, onRetry }) => {
  return (
    <View style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.retryText}>다시 찍기</Text>
        </TouchableOpacity>
      </View>
      {/* 중앙 로딩 인디케이터 */}
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#222" />
        <Text style={styles.loadingText}>잠시만 기다려주세요</Text>
      </View>
      {/* 하단 버튼 스타일 안내 */}
      <View style={styles.loadingButton}>
        <Text style={styles.loadingButtonText}>문서 분석중...</Text>
      </View>
    </View>
  );
};

export default LoadingImage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 60,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    justifyContent: 'flex-start',
  },
  backButton: {
    marginRight: 10,
    padding: 8,
  },
  backArrow: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  retryText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 32,
    fontSize: 18,
    color: '#888',
  },
  loadingButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#111',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 