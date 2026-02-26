import React, { useState, useEffect, Suspense } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import { Canvas } from '@react-three/fiber/native';
import { OrbitControls } from '@react-three/drei/native';
import { useAssets } from 'expo-asset';
import * as Speech from 'expo-speech';

// Importamos el modelo 3D (asegúrate de que la ruta es correcta)
import { Model } from '../components/Model';

export default function IndexAR({ puntosJugador, alCerrar }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 1. Permisos y Assets
  const [permission, requestPermission] = useCameraPermissions();
  const [assets] = useAssets([require('../assets/models/robot_playground.glb')]);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  if (!permission?.granted || !assets) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  const modelUri = assets[0].localUri || assets[0].uri;

  // 2. Lógica de IA con Contexto de Juego
  const consultarExperto = async () => {
    if (!input || loading) return;
    setLoading(true);
    
    // Configuramos el "cerebro" del experto
    const systemPrompt = `Eres un experto en Blackjack. 
      Responde de forma breve y técnica. 
      Si tiene menos de 17, sugiere pedir. Si tiene 17 o más, sugiere plantarse.`;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer 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`, // Usa variables de entorno en producción
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", 
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input }
          ]
        })
      });

      const data = await res.json();
      const texto = data.choices[0].message.content;
      
      setResponse(texto);
      Speech.speak(texto, {
        language: 'es-ES',
        onStart: () => setIsSpeaking(true),
        onDone: () => setIsSpeaking(false)
      });
    } catch (e) {
      setResponse("Error al conectar con el experto.");
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {/* CAPA 1: CÁMARA (Solo en móvil, en Web puedes usar un fondo oscuro o webcam) */}
      {Platform.OS !== 'web' && (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      )}

      {/* CAPA 2: ESCENA 3D */}
      <View style={StyleSheet.absoluteFill}>
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={1} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
          <Suspense fallback={null}>
            <Model 
              assetUri={modelUri} 
              isSpeaking={isSpeaking} 
              isThinking={loading} 
              
            />
          </Suspense>
          <OrbitControls enableZoom={false} />
        </Canvas>
      </View>

      {/* CAPA 3: INTERFAZ DE USUARIO */}
      <TouchableOpacity style={styles.closeButton} onPress={alCerrar}>
        <Text style={styles.closeText}>✕ Salir RA</Text>
      </TouchableOpacity>

      <View style={styles.uiContainer}>
        {response !== '' && (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{response}</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ej: ¿Qué me recomiendas hacer?"
            value={input}
            onChangeText={setInput}
            placeholderTextColor="#666"
          />
          <TouchableOpacity style={styles.sendButton} onPress={consultarExperto}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>OK</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  uiContainer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'white', borderRadius: 25, paddingHorizontal: 20, height: 50, fontSize: 16 },
  sendButton: { marginLeft: 10, backgroundColor: '#28a745', width: 60, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: 'white', fontWeight: 'bold' },
  bubble: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#444' },
  bubbleText: { color: 'white', fontSize: 15, textAlign: 'center', fontStyle: 'italic' },
  closeButton: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(255,0,0,0.7)', padding: 10, borderRadius: 20 },
  closeText: { color: 'white', fontWeight: 'bold' }
});