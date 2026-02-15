import { Image,StyleSheet, View } from 'react-native'

// Card.js
export function Card({ image, value, oculta, separada }) {
    const reverso = require('../assets/baraja/reverso.jpg'); // Imagen de reverso de carta
  return (
    <View style={[styles.cardContainer, {marginLeft: separada ? 0 : -80}]}>
      <Image 
        source={oculta ? reverso : image} 
        style={styles.foto} 
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: 80,   // Ancho fijo pequeño para que quepan varias
    height: 120, // Proporción de carta
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 5, // Sombra en Android
    shadowColor: '#000', // Sombra en iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    
  },
  foto: {
    width: '100%',
    height: '100%',
  }
});