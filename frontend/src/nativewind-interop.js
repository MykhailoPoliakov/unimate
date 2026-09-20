/**
 * NativeWind only wires `className` into core React Native primitives. Third-party
 * components need to be registered once, at the entry point, to accept it too.
 */
import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';
import { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

cssInterop(Image, { className: 'style' });
cssInterop(SafeAreaView, { className: 'style' });
cssInterop(TextInput, { className: 'style' });
