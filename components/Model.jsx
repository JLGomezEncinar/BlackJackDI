import React, { useRef } from 'react';
import { useGLTF } from '@react-three/drei/native';
import { useFrame } from '@react-three/fiber/native';

export function Model({ assetUri, isSpeaking, isThinking }) {
  // El hook usa la URI que viene desde index.js
  const { scene } = useGLTF(assetUri);
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;

      if (isThinking) {
        meshRef.current.rotation.y += 0.1;
      }

      if (isSpeaking) {
        // Efecto de latido/vibración al hablar
        const s = 1.5 + Math.sin(state.clock.elapsedTime * 15) * 0.1;
        meshRef.current.scale.set(s, s, s);
      } else {
        meshRef.current.scale.set(1.5, 1.5, 1.5);
      }
    }
  });

  return <primitive ref={meshRef} object={scene} position={[0, -1, 0]} />;
}
