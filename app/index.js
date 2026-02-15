import { useEffect, useState } from 'react'
import Baraja from '../components/Baraja'
import { baraja } from '../assets/baraja/baraja'
import { View, ScrollView, StyleSheet, Text, Platform } from 'react-native'
import { Audio } from 'expo-av';
import { Card } from '../components/Card'
import { Button } from 'react-native-web'
import * as Speech from 'expo-speech';

export default function Index() {


  useEffect(() => {
    const randomCards = baraja.sort(() => 0.5 - Math.random()).slice(0, 52);
    const manoInicialJugador = randomCards.slice(0, 2);
    const manoInicialBanca = randomCards.slice(2, 4).map((card, index) => ({ ...card, oculta: index === 1 })); // Cartas de la banca ocultas
    const restoDelMazo = randomCards.slice(4);
    setManoJugador(manoInicialJugador);
    const puntosIniciales = calcularPuntos(manoInicialJugador);
    setManoBanca(manoInicialBanca);
    setMazo(restoDelMazo);
    Speech.speak(`Tu mano inicial tiene ${puntosIniciales} puntos. ¿Quieres otra carta?`, { language: 'es-ES', onStart: () => setIsSpeaking(true), onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });

  }, [])
  const [mazo, setMazo] = useState([])
  const [manoJugador, setManoJugador] = useState([])
  const [manoBanca, setManoBanca] = useState([])
  const [turnoJugador, setTurnoJugador] = useState(true) // true = turno del jugador, false = turno de la banca
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [recording, setRecording] = useState(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Listo');


  async function startRecording() {
    await Audio.requestPermissionsAsync();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await rec.startAsync();

    setRecording(rec);
    setStatus('Grabando...');
  }

  async function stopRecording() {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    console.log(uri);
    setRecording(null);
    setStatus('Procesando...');
    sendAudio(uri);
  }

  const sendAudio = async (uri) => {
    const formData = new FormData();

    try {
      // 1. Convertir la URI en un Blob (necesario para navegadores/web)
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        // 2. Añadir el blob al FormData
        formData.append('audio', blob, 'recording.m4a');

      } else {
        formData.append('audio', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: 'audio.m4a',
          type: 'audio/m4a',
        });

      }

      console.log("Enviando audio...");

      const res = await fetch('http://18.207.130.56:5000/speech', {
        method: 'POST',
        body: formData,

        // IMPORTANTE: No poner Content-Type manualmente
      });

      const json = await res.json();
      console.log("Respuesta:", json);
      if (json.text) setText(json.text);
      if (text.toLowerCase().includes('carta')) {
        repartirCarta('jugador');
      } else if (text.toLowerCase().includes('pasar')) {
        pasarTurno();
      } else {
        Speech.speak("No te he entendido, por favor di 'carta' o 'pasar'", { language: 'es-ES', onStart: () => setIsSpeaking(true), onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
      }

    } catch (error) {
      console.error("Error detallado:", error);
    }
  }

  const pasarTurno = () => {
    setTurnoJugador(false);
    manoBanca[1].oculta = false; // Revelamos la carta oculta de la banca
    setManoBanca([...manoBanca]); // Actualizamos el estado para reflejar el cambio
    jugarBanca(mazo, manoBanca);
  }
  const jugarBanca = (mazoActual, manoActual) => {
    const puntos = calcularPuntos(manoActual);
    const puntosJugador = calcularPuntos(manoJugador);
    const LIMITE_BANCA = 17;

    if (puntos > 21) {      
      determinarGanador(puntosJugador, puntos);
      return;
    }
    // Condición de parada: Si ya tiene 17 o más, se planta
    if (puntos >= LIMITE_BANCA && puntos <= 21) {
      Speech.speak(`La banca se planta con ${puntos} puntos.`);
      determinarGanador(puntosJugador, puntos);

      return;
    }

    // Si no ha llegado al límite, pide una carta
    if (mazoActual.length > 0) {
      const [nuevaCarta, ...resto] = mazoActual;
      const nuevaManoBanca = [...manoActual, nuevaCarta];

      // Actualizamos los estados
      setManoBanca(nuevaManoBanca);
      setMazo(resto);

      Speech.speak("La banca pide otra carta.");

      // ESPERAMOS un poco (ej. 2 segundos) y volvemos a evaluar
      setTimeout(() => {
        jugarBanca(resto, nuevaManoBanca);
      }, 2000);
    }
  };
  const determinarGanador = (puntosJugador, puntosBanca) => {
  

   if (puntosBanca > 21) {
    Speech.speak("La banca se ha pasado. ¡Has ganado tú!");
  } else if (puntosJugador > puntosBanca) {
    Speech.speak(`Tienes ${puntosJugador} y la banca ${puntosBanca}. ¡Ganaste!`);
  } else if (puntosBanca > puntosJugador) {
    Speech.speak(`La banca tiene ${puntosBanca} y tú ${puntosJugador}. Gana la banca.`);
  } else {
    Speech.speak("Empate técnico. Se reparten las fichas.");
  }

  setGameOver(true); 
};
  const hablar = (mano) => {
    if (mano > 21) {
      Speech.speak(`¡Te has pasado! La banca gana.`, { language: 'es-ES', onStart: () => setIsSpeaking(true), onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
      setGameOver(true);
    } else if (mano === 21) {
      Speech.speak("¡Blackjack!", { language: 'es-ES', onStart: () => setIsSpeaking(true), onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
      pasarTurno();
    } else {
      Speech.speak(`Tienes ${mano} puntos. ¿Quieres otra carta?`, { language: 'es-ES', onStart: () => setIsSpeaking(true), onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
    }
  }

  const calcularPuntos = (mano) => {
    return mano.reduce((total, card) => card.oculta ? total : total + card.value, 0);
  }
  const repartirCarta = () => {
    if (mazo.length === 0) return; // Si no hay cartas, no hacemos nada

    // 1. Extraemos la primera carta y el resto usando 'destructuring'
    const [primeraCarta, ...restoDelMazo] = mazo;






    setManoJugador([...manoJugador, primeraCarta]);
    const puntosActuales = calcularPuntos([...manoJugador, primeraCarta]);

    hablar(puntosActuales);


    setMazo(restoDelMazo)
  };
  return (
    <ScrollView contentContainerStyle={{ flex: 1 }}>
      <View>
        <Text>Turno: {turnoJugador ? "Jugador" : "Banca"}</Text>
        <Text>Cartas en el mazo: {mazo.length}</Text>
      </View>
      <View style={styles.banca}>
        {manoBanca.map((card, index) => (
          <Card key={index} image={card.image} value={card.value} oculta={card.oculta} separada={true} />
        ))}
        <Text>Puntos Banca: {calcularPuntos(manoBanca)}</Text>
      </View>
      <View style={styles.mazo}>
        <Baraja />

      </View>
      <View style={styles.banca}>
        {manoJugador.map((card, index) => (
          <Card key={card.id} image={card.image} value={card.value} oculta={false} separada={true} />
        ))}
        <Text>Puntos Jugador: {calcularPuntos(manoJugador)}</Text>
      </View>
      <Button title="Repartir Carta" onPress={() => repartirCarta()} disabled={gameOver || !turnoJugador || isSpeaking} />
      <Button title="Pasar Turno" onPress={() => pasarTurno()} disabled={gameOver || !turnoJugador || isSpeaking} />
      <Button
        title={recording ? 'Detener' : 'Grabar'}
        onPress={recording ? stopRecording : startRecording}
        disabled={gameOver || !turnoJugador || isSpeaking}
      />
      <Button title="Reiniciar Juego" onPress={() => window.location.reload()} disabled={!gameOver} />

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  mazo: {
    flexDirection: 'row',    // Alinea en horizontal
    flexWrap: 'wrap',        // Permite varias filas
    justifyContent: 'flex-end', // Centra las cartas
    alignContent: 'center',     // Centra las filas verticalmente
    alignItems: 'flex-end',      // Centra las cartas dentro de cada fila

  },
  banca: {
    flexDirection: 'row',    // Alinea en horizontal
    flexWrap: 'wrap',        // Permite varias filas
    justifyContent: 'center', // Centra las cartas  
    alignItems: 'center',      // Centra las cartas dentro de cada fila
    alignContent: 'center',     // Centra las filas verticalmente

  }
});
