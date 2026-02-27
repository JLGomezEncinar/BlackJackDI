import React, { useRef, useState, Suspense } from 'react';
import { useGLTF, OrbitControls } from '@react-three/drei/native';
import { useFrame } from '@react-three/fiber/native';
import { animated, useSpring } from '@react-spring/three';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

export function Model({ assetUri, isSpeaking, isThinking }) {
  // El hook usa la URI que viene desde index.js
  const { scene } = useGLTF(assetUri);
  const meshRef = useRef();
  const [pressed, setPressed] = useState(false);
  const { scale, color } = useSpring({
  scale: pressed ? 1.7 : 1.5,
  color: pressed ? '#ffcc00' : '#ffffff',
  config: { tension: 300, friction: 15 },
});


  const alTocarModelo = () => {
  setPressed(true);

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  Speech.speak(
    'Hola, soy tu experto en Blackjack. ¿En qué puedo ayudarte?',
    { language: 'es-ES' }
  );

  // Volver al estado normal tras un momento
  setTimeout(() => setPressed(false), 600);
};

  useFrame((state) => {
  if (!meshRef.current) return;

  meshRef.current.rotation.y += 0.01;

  if (isThinking) {
    meshRef.current.rotation.y += 0.05;
  }

  if (isSpeaking) {
    meshRef.current.position.y =
      -1 + Math.sin(state.clock.elapsedTime * 8) * 0.05;
  }
});

  return <animated.primitive
  ref={meshRef}
  object={scene}
  position={[0, -1, 0]}
  scale={scale}
  onPointerDown={alTocarModelo}
/>;
}
