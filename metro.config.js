const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Añadimos las extensiones de archivos 3D para que Metro los reconozca
config.resolver.assetExts.push('glb', 'gltf', 'png', 'jpg','bin');

module.exports = config;
