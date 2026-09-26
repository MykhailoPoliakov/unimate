const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const frontendModules = path.resolve(__dirname, 'node_modules');
const parentModules = path.resolve(__dirname, '..', 'node_modules');

config.resolver.nodeModulesPaths = [frontendModules];
config.resolver.blockList = [
  new RegExp(`${parentModules.replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`),
];

module.exports = withNativeWind(config, { input: './src/global.css' });
