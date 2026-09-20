import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

const QUICK_LINKS = [
  {
    title: 'Canvas',
    subtitle: 'Courses and assignments',
    icon: 'book',
    href: 'https://canvas.kdg.be/',
  },
  {
    title: 'E-studentservice',
    subtitle: 'Administrative documents',
    icon: 'document-text',
    href: 'https://e-studentservice.kdg.be/',
  },
  {
    title: 'My timetable',
    subtitle: 'Personal lecture schedule',
    icon: 'calendar',
    href: 'https://studentkdg.sharepoint.com/sites/Intranet-en/SitePages/My-timetable.aspx',
  },
  {
    title: 'Mail',
    subtitle: 'Your @kdg mailbox',
    icon: 'mail',
    href: 'https://outlook.office365.com/owa/?realm=kdg.be#exsvurl=1&cmd=contents&module=inbox',
  },
];

function QuickLink({ title, subtitle, icon, href }) {
  const theme = useTheme();

  return (
    <ExternalLink href={href} asChild>
      <Pressable className="active:opacity-70">
        <ThemedView
          type="backgroundElement"
          className="flex-row items-center gap-three px-three py-three rounded-three">
          <ThemedView
            type="backgroundSelected"
            className="w-[44px] h-[44px] rounded-two items-center justify-center">
            <Ionicons name={icon} size={22} color={theme.primary} />
          </ThemedView>
          <ThemedView className="flex-1 bg-transparent">
            <ThemedText type="smallBold">{title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          </ThemedView>
          <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
        </ThemedView>
      </Pressable>
    </ExternalLink>
  );
}

export default function HomeScreen() {
  const { profile } = useProfile();

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="flex-1 px-four max-w-content self-stretch w-full pb-bottom-tab-gap">
        <ThemedView className="flex-row items-center flex-wrap gap-two bg-transparent pt-six pb-four">
          <ThemedText type="subtitle">Hi {profile?.firstName ?? 'there'}</ThemedText>
          <Text style={{ fontSize: 32, lineHeight: 44 }}>👋</Text>
        </ThemedView>
        <ThemedText themeColor="textSecondary" className="mb-four">
          Everything for your studies at KdG, in one place.
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" className="uppercase mb-two">
          Services
        </ThemedText>
        <ThemedView className="gap-two bg-transparent">
          {QUICK_LINKS.map((link) => (
            <QuickLink key={link.title} {...link} />
          ))}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}
