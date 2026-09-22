import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFeed } from '@/hooks/use-feed';
import { useI18n } from '@/hooks/use-i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

function PostCard({ post, isAdmin, onEdit, onDelete }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <ThemedView type="backgroundElement" className="gap-two px-three py-three rounded-three">
      <ThemedView className="flex-row items-center gap-two bg-transparent">
        <ThemedView
          type="backgroundSelected"
          className="w-[36px] h-[36px] rounded-two items-center justify-center">
          <Ionicons name="newspaper" size={18} color={theme.primary} />
        </ThemedView>
        <ThemedView className="flex-1 bg-transparent">
          <ThemedText type="small" themeColor="primary">
            {t('news')}
          </ThemedText>
          <ThemedText type="smallBold">{post.title}</ThemedText>
        </ThemedView>
      </ThemedView>
      {post.body ? <ThemedText themeColor="textSecondary">{post.body}</ThemedText> : null}
      {isAdmin ? (
        <ThemedView className="flex-row gap-three bg-transparent">
          <Pressable onPress={() => onEdit(post)} className="active:opacity-70">
            <ThemedText type="small" themeColor="primary">
              {t('edit')}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => onDelete(post)} className="active:opacity-70">
            <ThemedText type="small" style={{ color: theme.error }}>
              {t('delete')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

function NewsModal({ visible, post, onClose }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { addPost, editPost } = useFeed();
  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.body ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const canSave = title.trim().length > 0 && !isSaving;
  const isEdit = !!post;

  const handleClose = () => {
    setTitle('');
    setBody('');
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      if (isEdit) await editPost({ id: post.id, title, body });
      else await addPost({ title, body });
      handleClose();
    } catch (error) {
      Alert.alert(isEdit ? t('couldNotSave') : t('couldNotPublish'), error.message ?? t('tryAgain'));
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
                <ThemedText themeColor="primary">{t('cancel')}</ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{isEdit ? t('editPost') : t('newPost')}</ThemedText>
              <Pressable onPress={handleSave} disabled={!canSave} className="active:opacity-70">
                <ThemedText themeColor={canSave ? 'primary' : 'textSecondary'} type="smallBold">
                  {isSaving ? '…' : isEdit ? t('save') : t('publish')}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ScrollView
              className="flex-1"
              contentContainerClassName="px-four py-three gap-three"
              keyboardShouldPersistTaps="handled">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('title')}
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
                placeholder={t('details')}
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
  const { t } = useI18n();
  const { profile, refreshUser } = useProfile();
  const { posts, removePost, refresh } = useFeed();
  const [composer, setComposer] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isAdmin = profile?.role === 'admin';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
      await refresh();
    } catch {
      // Keep the current list if the API is unreachable.
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = (post) => {
    Alert.alert(t('deleteNews'), t('deleteNewsMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removePost(post.id);
          } catch (error) {
            Alert.alert(t('couldNotSave'), error.message ?? t('tryAgain'));
          }
        },
      },
    ]);
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ThemedView className="flex-row items-center justify-between px-four pt-three pb-two bg-transparent">
          <ThemedText type="subtitle">{t('info')}</ThemedText>
          {isAdmin ? (
            <Pressable onPress={() => setComposer({})} className="active:opacity-70">
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
          contentContainerClassName="px-four pb-bottom-tab-gap gap-two max-w-content self-center w-full"
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }>
          {posts.length === 0 ? (
            <ThemedView className="items-center py-six bg-transparent">
              <ThemedText themeColor="textSecondary" className="text-center">
                {t('noNews')}
                {isAdmin ? t('tapToPublish') : ''}
              </ThemedText>
            </ThemedView>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                onEdit={(item) => setComposer(item)}
                onDelete={handleDelete}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
      {composer ? (
        <NewsModal
          key={composer.id ?? 'new'}
          visible
          post={composer.id ? composer : null}
          onClose={() => setComposer(null)}
        />
      ) : null}
    </ThemedView>
  );
}
