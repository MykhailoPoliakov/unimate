import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UNIVERSITIES } from '@/constants/universities';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

function UniversityOption({ university, isSelected, onSelect }) {
  const theme = useTheme();

  return (
    <Pressable onPress={onSelect} className="active:opacity-70 self-stretch">
      <ThemedView
        type="backgroundElement"
        className="flex-row items-center gap-three px-three py-three rounded-three"
        style={{
          borderWidth: 1,
          borderColor: isSelected ? theme.primary : theme.border,
        }}>
        <ThemedView
          type="backgroundSelected"
          className="w-[44px] h-[44px] rounded-two items-center justify-center">
          <Ionicons name="school" size={22} color={theme.primary} />
        </ThemedView>
        <ThemedView className="flex-1 bg-transparent">
          <ThemedText type="smallBold">{university.shortName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {university.name}
          </ThemedText>
        </ThemedView>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isSelected ? theme.primary : theme.border}
        />
      </ThemedView>
    </Pressable>
  );
}

export function Onboarding() {
  const { saveProfile } = useProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [universityId, setUniversityId] = useState(UNIVERSITIES[0].id);
  const [isSaving, setIsSaving] = useState(false);

  const canContinue =
    firstName.trim().length > 0 && lastName.trim().length > 0 && !!universityId && !isSaving;

  const handleContinue = async () => {
    if (!canContinue) return;
    setIsSaving(true);
    try {
      await saveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        university: universityId,
        role: 'default',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="flex-1 max-w-content">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="grow px-four py-six gap-three"
            keyboardShouldPersistTaps="handled">
            <ThemedView className="gap-two bg-transparent mb-four">
              <ThemedText type="title">
                Welcome to <ThemedText type="title" themeColor="primary">UniMate</ThemedText>
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Your central point for everything about your studies. Tell us a bit about
                yourself to get started.
              </ThemedText>
            </ThemedView>

            <FormField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Emma"
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="next"
            />
            <FormField
              label="Surname"
              value={lastName}
              onChangeText={setLastName}
              placeholder="e.g. Peeters"
              autoCapitalize="words"
              autoComplete="family-name"
              returnKeyType="done"
            />

            <ThemedText type="small" themeColor="textSecondary" className="mt-two">
              Your university
            </ThemedText>
            {UNIVERSITIES.map((university) => (
              <UniversityOption
                key={university.id}
                university={university}
                isSelected={universityId === university.id}
                onSelect={() => setUniversityId(university.id)}
              />
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              More universities are coming soon.
            </ThemedText>

            <ThemedView className="grow bg-transparent" />

            <Pressable
              onPress={handleContinue}
              disabled={!canContinue}
              className={`rounded-three py-three items-center ${
                canContinue ? 'bg-primary active:bg-primary-pressed' : 'bg-primary opacity-40'
              }`}>
              <ThemedText className="!text-white" type="smallBold">
                {isSaving ? 'Saving…' : 'Get started'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
