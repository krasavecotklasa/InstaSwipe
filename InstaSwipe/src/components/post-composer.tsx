import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const theme = useTheme();

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
        allowsEditing: true,
        aspect: [1, 1],
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
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={[styles.topBar, { borderBottomColor: theme.tabActiveBorder }]}>
            <TouchableOpacity onPress={handleClose} style={styles.topBarSide} disabled={loading}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                tintColor={theme.text}
                size={22}
              />
            </TouchableOpacity>
            <ThemedText style={styles.topBarTitle}>New post</ThemedText>
            <View style={styles.topBarSide} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <TouchableOpacity style={styles.imageTile} onPress={handlePickImage}>
                {image ? (
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} />
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

              <TextInput
                style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                placeholder="Write a caption…"
                placeholderTextColor={theme.iconMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={4}
                maxLength={CAPTION_MAX_LENGTH}
              />
              <ThemedText style={[styles.charCount, { color: theme.iconMuted }]}>
                {caption.length}/{CAPTION_MAX_LENGTH}
              </ThemedText>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>Share post</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 0.5,
  },
  topBarSide: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    flexGrow: 1,
  },
  form: {
    gap: Spacing.three,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  imageTile: {
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  imagePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreview: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -Spacing.two,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
