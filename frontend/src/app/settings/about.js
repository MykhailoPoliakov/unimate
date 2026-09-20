import Constants from 'expo-constants';
import { ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AboutScreen() {
  return (
    <ThemedView className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-four py-four gap-three pb-bottom-tab-gap max-w-content self-center w-full">
        <ThemedText type="subtitle" themeColor="primary">
          UniMate
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </ThemedText>
        <ThemedText>
          UniMate is a central point for students to find study information. It currently
          supports Karel de Grote Hogeschool, with more universities planned later.
        </ThemedText>
        <ThemedText>
          Home links out to Canvas, E-studentservice, your timetable, and KdG mail. Info and
          Socials will grow as the app does.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}
