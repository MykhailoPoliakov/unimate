import { ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function TermsScreen() {
  return (
    <ThemedView className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-four py-four gap-three pb-bottom-tab-gap max-w-content self-center w-full">
        <ThemedText type="small" themeColor="textSecondary">
          Last updated 20 September 2026
        </ThemedText>
        <ThemedText>
          UniMate is an independent student app. It is not an official product of Karel de Grote
          Hogeschool.
        </ThemedText>
        <ThemedText>
          The app helps you reach existing student services. Course content, timetables, mail,
          and administrative documents remain owned and operated by KdG or Microsoft. UniMate is
          not responsible for the availability or accuracy of those third-party sites.
        </ThemedText>
        <ThemedText>
          UniMate is provided as is, without a guarantee that every link, screen, or timetable
          will always be up to date. Use official KdG channels if something looks wrong or if
          you need a binding answer about your studies.
        </ThemedText>
        <ThemedText>
          By using UniMate you agree not to misuse the app, scrape student systems through it, or
          try to access another student&apos;s account.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}
