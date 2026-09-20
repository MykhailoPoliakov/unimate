import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PostCard({ post }) {
  const theme = useTheme();
  const isEvent = post.type === 'event';

  return (
    <ThemedView type="backgroundElement" className="gap-two px-three py-three rounded-three">
      <ThemedView className="flex-row items-center gap-two bg-transparent">
        <ThemedView
          type="backgroundSelected"
          className="w-[36px] h-[36px] rounded-two items-center justify-center">
          <Ionicons
            name={isEvent ? 'calendar' : 'newspaper'}
            size={18}
            color={theme.primary}
          />
        </ThemedView>
        <ThemedView className="flex-1 bg-transparent">
          <ThemedText type="small" themeColor="primary">
            {isEvent ? 'Event' : 'News'}
          </ThemedText>
          <ThemedText type="smallBold">{post.title}</ThemedText>
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(post.createdAt)}
        </ThemedText>
      </ThemedView>
      {post.body ? (
        <ThemedText themeColor="textSecondary">{post.body}</ThemedText>
      ) : null}
    </ThemedView>
  );
}

function PublishModal({ visible, onClose }) {
  const theme = useTheme();
  const { addPost } = useFeed();
  const [type, setType] = useState('news');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canPublish = title.trim().length > 0 && !isSaving;

  const handleClose = () => {
    setType('news');
    setTitle('');
    setBody('');
    onClose();
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setIsSaving(true);
    try {
      await addPost({ type, title, body });
      handleClose();
    } catch {
      Alert.alert('Could not publish', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ThemedView className="flex-row items-center justify-between px-four py-three bg-transparent">
              <Pressable onPress={handleClose} className="active:opacity-70">
                <ThemedText themeColor="primary">Cancel</ThemedText>
              </Pressable>
              <ThemedText type="smallBold">New post</ThemedText>
              <Pressable onPress={handlePublish} disabled={!canPublish} className="active:opacity-70">
                <ThemedText themeColor={canPublish ? 'primary' : 'textSecondary'} type="smallBold">
                  {isSaving ? '…' : 'Publish'}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView
              className="flex-1"
              contentContainerClassName="px-four py-three gap-three"
              keyboardShouldPersistTaps="handled">
              <ThemedView className="flex-row gap-two bg-transparent">
                {['news', 'event'].map((option) => {
                  const selected = type === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setType(option)}
                      className="flex-1 active:opacity-70">
                      <ThemedView
                        type={selected ? 'backgroundSelected' : 'backgroundElement'}
                        className="items-center py-three rounded-three"
                        style={{
                          borderWidth: 1,
                          borderColor: selected ? theme.primary : theme.border,
                        }}>
                        <ThemedText themeColor={selected ? 'primary' : 'textSecondary'} type="smallBold">
                          {option === 'news' ? 'News' : 'Event'}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={theme.textSecondary}
                className="rounded-three px-three py-three text-base font-medium"
                style={{
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                }}
              />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Details (optional)"
                placeholderTextColor={theme.textSecondary}
                multiline
                className="rounded-three px-three py-three text-base font-medium min-h-[120px]"
                style={{
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                  textAlignVertical: 'top',
                }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

export default function InfoScreen() {
  const theme = useTheme();
  const { profile } = useProfile();
  const { posts } = useFeed();
  const [composerOpen, setComposerOpen] = useState(false);
  const isAdmin = profile?.role === 'admin';

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ThemedView className="flex-row items-center justify-between px-four pt-three pb-two bg-transparent">
          <ThemedText type="subtitle">Info</ThemedText>
          {isAdmin ? (
            <Pressable onPress={() => setComposerOpen(true)} className="active:opacity-70">
              <ThemedView
                type="backgroundSelected"
                className="w-[40px] h-[40px] rounded-five items-center justify-center">
                <Ionicons name="add" size={22} color={theme.primary} />
              </ThemedView>
            </Pressable>
          ) : null}
        </ThemedView>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-four pb-bottom-tab-gap gap-two max-w-content self-center w-full">
          {posts.length === 0 ? (
            <ThemedView className="items-center py-six bg-transparent">
              <ThemedText themeColor="textSecondary" className="text-center">
                No news or events yet.
                {isAdmin ? ' Tap + to publish the first one.' : ''}
              </ThemedText>
            </ThemedView>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </ScrollView>
      </SafeAreaView>
      <PublishModal visible={composerOpen} onClose={() => setComposerOpen(false)} />
    </ThemedView>
  );
}
