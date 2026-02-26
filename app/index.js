import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, Text, Platform, Button, TouchableOpacity } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import { Card } from '../components/Card';
import Baraja from '../components/Baraja';
import { baraja } from '../assets/baraja/baraja';
import IndexAR from '../components/IndexAR';

// Carga condicional para Web
let tf, handpose;
if (Platform.OS === 'web') {
  tf = require('@tensorflow/tfjs');
  require('@tensorflow/tfjs-backend-webgl');
  handpose = require('@tensorflow-models/handpose');
}

export default function BlackJackMaster() {
  // --- ESTADOS DE JUEGO ---
  const [mazo, setMazo] = useState([]);
  const [manoJugador, setManoJugador] = useState([]);
  const [manoBanca, setManoBanca] = useState([]);
  const [turnoJugador, setTurnoJugador] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState(null);
  const [gesture, setGesture] = useState('Esperando...');
  const [pantallaActual, setPantallaActual] = useState('Juego');
  // --- REFS DE CONTROL (Sincronización de hilos/sensores) ---
  const stateRef = useRef({ gameOver, turnoJugador, isSpeaking, mazo, manoJugador, manoBanca });
  const isBlockingAction = useRef(false); // Cooldown global para evitar duplicados
  const videoRef = useRef(null);
  const modelRef = useRef(null);
  const rafRef = useRef(null);
  const lastGestureRef = useRef('...');

  useEffect(() => {
    stateRef.current = { gameOver, turnoJugador, isSpeaking, mazo, manoJugador, manoBanca, pantallaActual };
  }, [gameOver, turnoJugador, isSpeaking, mazo, manoJugador, manoBanca, pantallaActual]);

  // --- 1. INICIALIZACIÓN ---
  useEffect(() => {
    iniciarPartida();
  }, []);

  const iniciarPartida = () => {
    const shuffle = [...baraja].sort(() => Math.random() - 0.5);
    setManoJugador(shuffle.slice(0, 2));
    setManoBanca(shuffle.slice(2, 4).map((c, i) => ({ ...c, oculta: i === 1 })));
    setMazo(shuffle.slice(4));
    setGameOver(false);
    setTurnoJugador(true);
    lastGestureRef.current = '...';
    isBlockingAction.current = false;
    lanzarVoz("Partida nueva. ¿Carta o pasar?");
  };

  // --- 2. CONTROL POR MOVIMIENTO (ACELERÓMETRO) ---
  useEffect(() => {
    if (Platform.OS === 'web') return; // En web el acelerómetro requiere HTTPS/Permisos extra

    Accelerometer.setUpdateInterval(150);
    const subscription = Accelerometer.addListener(({ x }) => {
      const { gameOver, turnoJugador, isSpeaking } = stateRef.current;
      if (gameOver || !turnoJugador || isSpeaking || isBlockingAction.current) return;

      if (x > 0.8) gestionarEntrada('PEDIR');
      else if (x < -0.8) gestionarEntrada('PASS');
    });
    return () => subscription.remove();
  }, []);

  // --- 3. CONTROL POR VISIÓN (WEB HANDPOSE) ---
  useEffect(() => {
  // Solo en web y cuando estamos en pantalla de juego
  if (Platform.OS !== 'web' || pantallaActual !== 'Juego') return;
  
  let isMounted = true;
  
  const initVision = async () => {
    await tf.ready();
    modelRef.current = await handpose.load();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current && isMounted) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        rafRef.current = requestAnimationFrame(detectLoop);
      }
    } catch (err) {
      console.error("Error cámara:", err);
    }
  };
  
  initVision();
  
  return () => {
    isMounted = false;
    // IMPORTANTE: Liberar cámara al salir
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
}, [pantallaActual]); // Dependencia en pantallaActual
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    if (pantallaActual !== 'Juego') {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    } else {
      // Si volvemos al juego, reanudamos
      if (!rafRef.current && videoRef.current?.srcObject) {
        rafRef.current = requestAnimationFrame(detectLoop);
      }
    }
  }, [pantallaActual]);
  const detectLoop = async () => {
    // 1. Si ya no estamos en la pantalla de juego, cortamos el bucle inmediatamente
    if (stateRef.current.pantallaActual !== 'Juego') return;

    if (!stateRef.current.turnoJugador) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }
    // 1. Verificamos que el video exista y esté listo
    if (
      videoRef.current &&
      videoRef.current.readyState === 4 && // HAVE_ENOUGH_DATA
      videoRef.current.videoWidth > 0 &&   // Evita el error [0x0]
      modelRef.current &&
      !stateRef.current.gameOver
    ) {
      try {
        const predictions = await modelRef.current.estimateHands(videoRef.current);

        if (predictions.length > 0) {
          const gesto = getGesture(predictions[0].landmarks);
          setGesture(gesto);
          if (gesto !== lastGestureRef.current) {
            lastGestureRef.current = gesto;
            if (gesto !== '...') gestionarEntrada(gesto);
          }
        } else {
          setGesture('Buscando mano...');
          lastGestureRef.current = '...';
        }
      } catch (err) {
        console.error("Error en la detección:", err);
      }
    }

    // Continuar el bucle
    rafRef.current = requestAnimationFrame(detectLoop);
  };

  const getGesture = (l) => {
    const up = [l[8][1] < l[6][1], l[12][1] < l[10][1], l[16][1] < l[14][1], l[20][1] < l[18][1]];
    const count = up.filter(f => f).length;
    if (count >= 3) return 'PASS'; // Mano abierta
    if (up[0] && up[1] && count === 2) return 'PEDIR'; // Dos dedos
    return '...';
  };

  // --- 4. CONTROL POR VOZ (WHISPER / API EXTERNA) ---
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (err) { console.error("Error al grabar", err); }
  };

  const stopRecording = async () => {
    setRecording(null);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    enviarAudioServidor(uri);
  };

  const enviarAudioServidor = async (uri) => {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      formData.append('audio', await res.blob(), 'audio.m4a');
    } else {
      formData.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' });
    }

    try {
      const response = await fetch('http://100.54.1.50:5000/speech', { method: 'POST', body: formData });
      const data = await response.json();
      const orden = data.text.toLowerCase();
      if (orden.includes('carta')) gestionarEntrada('PEDIR');
      else if (orden.includes('pasar')) gestionarEntrada('PASS');
      else lanzarVoz("No te entendí. Por favor di 'Carta' o 'Pasar'.");
    } catch (e) { lanzarVoz("No te entendí."); }
  };

  // --- 5. NÚCLEO DE LÓGICA (Orquestador) ---
  const gestionarEntrada = (accion) => {
    const { isSpeaking, turnoJugador, gameOver } = stateRef.current;
    if (isBlockingAction.current || isSpeaking || !turnoJugador || gameOver) return;

    isBlockingAction.current = true; // Bloqueo de seguridad
    if (accion === 'PEDIR') repartirCarta();
    else if (accion === 'PASS') pasarTurno();

    setTimeout(() => { isBlockingAction.current = false; }, 2000); // Cooldown de 2 seg
  };

  const repartirCarta = () => {
    const { mazo, manoJugador } = stateRef.current;
    const [nueva, ...resto] = mazo;
    const nuevaMano = [...manoJugador, nueva];
    const puntos = calcularPuntos(nuevaMano);

    setManoJugador(nuevaMano);
    setMazo(resto);

    if (puntos > 21) {
      lanzarVoz(`Te has pasado con ${puntos}. Gana la banca.`);
      setGameOver(true);
    } else {
      lanzarVoz(`Tienes ${puntos}.`);
    }
  };

  const pasarTurno = () => {
    if (!stateRef.current.turnoJugador) return;

    // ⛔️ bloquea inmediatamente (NO esperes a React)
    stateRef.current.turnoJugador = false;
    setTurnoJugador(false);
    lastGestureRef.current = '...';

    // ✅ usa la mano ACTUAL desde el ref
    const bancaVisible = stateRef.current.manoBanca.map(c => ({
      ...c,
      oculta: false
    }));

    setManoBanca(bancaVisible);

    setTimeout(() => {
      jugarBanca(stateRef.current.mazo, bancaVisible);
    }, 1000);
  };

  const jugarBanca = (mazoActual, manoActual) => {
    const puntosBanca = calcularPuntos(manoActual);
    if (puntosBanca < 17) {
      const [nueva, ...resto] = mazoActual;
      const nuevaMano = [...manoActual, nueva];
      setManoBanca(nuevaMano);
      setMazo(resto);
      setTimeout(() => jugarBanca(resto, nuevaMano), 1500);
    } else {
      const pJu = calcularPuntos(stateRef.current.manoJugador);
      determinarGanador(pJu, puntosBanca);
    }
  };

  const determinarGanador = (pJu, pBa) => {
    let m = (pBa > 21 || pJu > pBa) ? "¡Has ganado!" : (pBa > pJu ? "Gana la banca." : "Empate.");
    lanzarVoz(m);
    setGameOver(true);
  };

  const lanzarVoz = (t) => {
    Speech.speak(t, { language: 'es-ES', onStart: () => setIsSpeaking(true), onDone: () => setIsSpeaking(false) });
  };

  const calcularPuntos = (mano) => mano.reduce((s, c) => s + (c.oculta ? 0 : c.value), 0);
  if (pantallaActual === 'Asistente') {
    // Aquí renderizamos tu código de Realidad Aumentada
    // Añadimos un botón para volver
    return (
      <View style={{ flex: 1 }}>
        <IndexAR />
        <TouchableOpacity
          style={styles.botonVolver}
          onPress={() => setPantallaActual('Juego')}
        >
          <Text style={{ color: 'white' }}>← Volver al Juego</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS === 'web' && (
        <View style={styles.camBox}>
          <Text style={styles.info}>Gesto: {gesture}</Text>
          <video ref={videoRef} style={styles.video} playsInline muted />
        </View>
      )}

      <View style={styles.board}>
        <Text style={styles.title}>{gameOver ? "FIN DE JUEGO" : "BLACKJACK AI"}</Text>

        <Text style={styles.label}>BANCA: {calcularPuntos(manoBanca)}</Text>
        <View style={styles.row}>{manoBanca.map((c, i) => <Card key={i} {...c} separada={true} />)}</View>

        <Text style={styles.label}>TÚ: {calcularPuntos(manoJugador)}</Text>
        <View style={styles.row}>{manoJugador.map((c, i) => <Card key={i} {...c} separada={true} />)}</View>
      </View>

      <View style={styles.buttons}>
        <Button title="PEDIR CARTA" onPress={() => gestionarEntrada('PEDIR')} disabled={!turnoJugador || gameOver} />
        <Button title="PASAR" onPress={() => gestionarEntrada('PASS')} disabled={!turnoJugador || gameOver} />
        <Button
          title={recording ? "ESCUCHANDO..." : "HABLAR (Diga 'Carta')"}
          onPress={recording ? stopRecording : startRecording}
          color={recording ? "red" : "#2196F3"}
        />
        {gameOver && <Button title="REINTENTAR" onPress={() => iniciarPartida()} color="orange" />}
        <TouchableOpacity
          style={styles.botonRA}
          onPress={() => setPantallaActual('Asistente')}
        >
          <Text style={styles.textoBotonRA}>🤖 Consultar Experto RA</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#1a4a1a', minHeight: '100%' },
  camBox: { alignItems: 'center', marginBottom: 15 },
  video: { width: 240, height: 180, borderRadius: 10, backgroundColor: '#000' },
  board: { marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
  title: { color: 'gold', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  label: { color: 'white', textAlign: 'center', marginTop: 10 },
  info: { color: '#ccc', marginBottom: 5 },
  buttons: { gap: 10, marginTop: 20 },
  botonRA: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'gold',
    zIndex: 10,
  },
  textoBotonRA: {
    color: 'gold',
    fontWeight: 'bold',
  },
  botonVolver: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#cc0000',
    padding: 10,
    borderRadius: 10,
    zIndex: 20,
  }
});


