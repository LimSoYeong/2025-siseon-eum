import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView } from 'expo-camera';
import { PinchGestureHandler, PinchGestureHandlerGestureEvent } from 'react-native-gesture-handler';
// @ts-ignore
import Animated, { useSharedValue, useAnimatedGestureHandler, useAnimatedProps } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);

export default function CameraScreen({ navigation }: any) {
  const cameraRef = useRef<any>(null);
  const zoom = useSharedValue(0);

  // 핀치 줌 이벤트 핸들러 (reanimated)
  const onPinchGestureEvent = useAnimatedGestureHandler({
    onActive: (event) => {
      let newZoom = zoom.value + (event.scale - 1) * 0.05;
      if (newZoom < 0) newZoom = 0;
      if (newZoom > 1) newZoom = 1;
      zoom.value = newZoom;
    },
  });

  const animatedProps = useAnimatedProps(() => ({
    zoom: zoom.value,
  }));

  // 촬영 함수
  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      navigation.navigate('LoadingImage');
    }
  };

  return (
    <View style={styles.container}>
      <PinchGestureHandler onGestureEvent={onPinchGestureEvent}>
        <Animated.View style={{ flex: 1 }}>
          <AnimatedCameraView
            ref={cameraRef}
            style={styles.camera}
            animatedProps={animatedProps}
            ratio="16:9"
          >
            <View style={styles.overlay}>
              <Text style={styles.guideText}>읽고 싶은 문서를 찍어주세요</Text>
            </View>
          </AnimatedCameraView>
        </Animated.View>
      </PinchGestureHandler>
      <View style={styles.buttonContainer}>
        {/* 바깥 테두리 원 */}
        <View style={styles.outerCircle} />
        {/* 촬영 버튼 */}
        <TouchableOpacity style={styles.captureButton} onPress={takePicture} />
      </View>
    </View>
  );
}

const BUTTON_SIZE = 90;
const OUTER_SIZE = 120;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 60,
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
  },
  guideText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: OUTER_SIZE,
  },
  outerCircle: {
    position: 'absolute',
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    borderRadius: OUTER_SIZE / 2,
    borderWidth: 5,
    borderColor: '#fff',
    opacity: 0.5,
    bottom: 0,
    alignSelf: 'center',
    zIndex: 1,
  },
  captureButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#eee',
    alignSelf: 'center',
    zIndex: 2,
  },
});