import { ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PrivacyScreen() {
  return (
    <ThemedView className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-four py-four gap-three pb-bottom-tab-gap max-w-content self-center w-full">
        <ThemedText type="small" themeColor="textSecondary">
          Last updated 20 September 2026
        </ThemedText>
        <ThemedText>
          UniMate stores your first name, surname, university, and theme preference on this
          device so the app can greet you and remember how you like it to look.
        </ThemedText>
        <ThemedText>
          This information currently stays on your phone or computer. It is not uploaded to a
          UniMate server. When a backend is added later, we will update this policy before any
          data leaves your device.
        </ThemedText>
        <ThemedText>
          Quick links on the home screen open Karel de Grote Hogeschool and Microsoft websites
          (Canvas, E-studentservice, timetable, and mail). Those services have their own privacy
          policies. UniMate does not read, store, or scrape the contents of your mailbox or
          student records.
        </ThemedText>
        <ThemedText>
          You can edit your name in Settings at any time, or use Reset profile to delete the
          information UniMate stored on this device.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}
