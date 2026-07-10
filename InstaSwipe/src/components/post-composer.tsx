import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import ResponsiveModalSheet, { ModalSheetPanel } from '@/components/responsive-modal-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createPost } from '@/hooks/posts';
import { getImageValidationError } from '@/constants/media';

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onPosted?: () => void;
}

const CAPTION_MAX_LENGTH = 500;

function errorHandle(error: string) {
  if (Platform.OS === 'web') {
    alert('Error: ' + error);
  } else {
    Alert.alert('Error', error);
  }
}

function notify(message: string) {
  if (Platform.OS === 'web') {
    alert(message);
  } else {
    Alert.alert('Shared', message);
  }
}

export default function PostComposer({ visible, onClose, onPosted }: PostComposerProps) {
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const captionFocusedRef = useRef(false);
  const theme = useTheme();

  useEffect(() => {
    if (!visible || Platform.OS === 'web') {
      return;
    }

    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (captionFocusedRef.current) {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    });

    return () => subscription.remove();
  }, [visible]);

  const reset = () => {
    setCaption('');
    setImage(null);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const validationError = getImageValidationError(asset);
      if (validationError) {
        errorHandle(validationError);
        return;
      }

      setImage(asset);
    } catch (error) {
      errorHandle(error instanceof Error ? error.message : 'Could not open the image picker.');
    }
  };

  const handleSubmit = async () => {
    if (!caption.trim() && !image) {
      errorHandle('Add a caption or a photo to share a post.');
      return;
    }

    setLoading(true);
    try {
      await createPost({ caption, image });
      reset();
      onPosted?.();
      onClose();
      notify('Your post has been shared.');
    } catch (error) {
      errorHandle(error instanceof Error ? error.message : 'Could not share your post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModalSheet
      visible={visible}
      onClose={handleClose}
      title="New post"
      closeAccessibilityLabel="Close new post"
      closeDisabled={loading}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Spacing.three : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator
        >
        <ModalSheetPanel
          title="Post"
          trailing={
            <ThemedText type="small" themeColor="textSecondary">
              {caption.length}/{CAPTION_MAX_LENGTH}
            </ThemedText>
          }
        >
          <View style={styles.formGrid}>
            <TouchableOpacity
              style={styles.imageTile}
              onPress={handlePickImage}
              activeOpacity={0.8}
              disabled={loading}
            >
              {image ? (
                <Image
                  source={{ uri: image.uri }}
                  style={[
                    styles.imagePreview,
                    { aspectRatio: image.width > 0 && image.height > 0 ? image.width / image.height : 1 },
                  ]}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.imagePlaceholder, { borderColor: theme.tabActiveBorder }]}>
                  <SymbolView
                    name={{ ios: 'photo.badge.plus', android: 'add_photo_alternate', web: 'add_photo_alternate' } as any}
                    tintColor={theme.iconMuted}
                    size={30}
                  />
                  <ThemedText style={[styles.imagePlaceholderText, { color: theme.iconMuted }]}>
                    Add Photo
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.captionColumn}>
              <TextInput
                style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                placeholder="Write a caption..."
                placeholderTextColor={theme.iconMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={4}
                maxLength={CAPTION_MAX_LENGTH}
                editable={!loading}
                onFocus={() => {
                  captionFocusedRef.current = true;
                }}
                onBlur={() => {
                  captionFocusedRef.current = false;
                }}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  { borderColor: '#6249cabe' },
                  (pressed || loading) && styles.submitButtonPressed,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <SymbolView
                  name={{ ios: 'paperplane.fill', android: 'send', web: 'send' } as any}
                  tintColor="#8769ffbe"
                  size={20}
                />
                {loading ? (
                  <ActivityIndicator color="#8769ffbe" />
                ) : (
                  <ThemedText type="smallBold">Share post</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </ModalSheetPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </ResponsiveModalSheet>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  formGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: Spacing.three,
    alignItems: Platform.OS === 'web' ? 'flex-start' : 'stretch',
  },
  imageTile: {
    width: Platform.OS === 'web' ? 220 : '100%',
    maxWidth: 320,
    alignSelf: Platform.OS === 'web' ? 'flex-start' : 'center',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    borderRadius: 8,
  },
  captionColumn: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 260 : undefined,
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  textArea: {
    minHeight: 160,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
  submitButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: 1,
    alignSelf: Platform.OS === 'web' ? 'flex-start' : 'stretch',
    minWidth: Platform.OS === 'web' ? 180 : undefined,
  },
  submitButtonPressed: {
    opacity: 0.72,
  },
});
