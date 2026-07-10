import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Text, Platform, ActivityIndicator } from 'react-native';
import { Image, type ImageLoadEventData } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { likePost, unlikePost } from '@/hooks/posts';


// Mirrors the backend Media: images are uploaded async, so `status` tracks where
// the object is in the processing pipeline. While PROCESSING, `url` points at a raw
// preview; once READY it's the final compressed image; FAILED has no usable image.
export type MediaStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface Media {
  type: 'IMAGE' | 'VIDEO';
  url: string;
  filename: string;
  size: number;
  status?: MediaStatus;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  profilePictureUrl?: string;
  caption?: string;
  likes: number;
  likedByMe: boolean;
  createdAt: string;
  media: Media | null; // text-only posts have no media
}

interface PostCardProps {
  post: Post;
  onAuthorPress?: (userId: string) => void;
}

const DEFAULT_POST_IMAGE_ASPECT_RATIO = 3 / 2;
const MIN_POST_IMAGE_ASPECT_RATIO = 4 / 5;
const MAX_POST_IMAGE_ASPECT_RATIO = 16 / 9;

const clampPostImageAspectRatio = (ratio: number) => {
  return Math.min(MAX_POST_IMAGE_ASPECT_RATIO, Math.max(MIN_POST_IMAGE_ASPECT_RATIO, ratio));
};

export function PostCard({ post, onAuthorPress }: PostCardProps) {
  const theme = useTheme();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [postImageAspectRatio, setPostImageAspectRatio] = useState(DEFAULT_POST_IMAGE_ASPECT_RATIO);

  useEffect(() => {
    setPostImageAspectRatio(DEFAULT_POST_IMAGE_ASPECT_RATIO);
  }, [post.media?.url]);

  const handleLike = () => {
    if (liked) {
      setLiked(false);
      unlikePost(post.id);
      setLikeCount(prev => prev - 1);
    } else {
      setLiked(true);
      likePost(post.id);
      setLikeCount(prev => prev + 1);
    }
  };

  const handlePostImageLoad = (event: ImageLoadEventData) => {
    const { width, height } = event.source;

    if (width > 0 && height > 0) {
      setPostImageAspectRatio(clampPostImageAspectRatio(width / height));
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.tabActiveBackground, borderColor: theme.tabActiveBorder }]}>
      <Pressable
        onPress={onAuthorPress ? () => onAuthorPress(post.userId) : undefined}
        disabled={!onAuthorPress}
        style={({ pressed }) => [
          styles.header,
          pressed && styles.headerPressed,
        ]}
      >
        <Image
          source={post.profilePictureUrl ? { uri: post.profilePictureUrl } : undefined}
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.username, { color: theme.text }]}>{post.username}</Text>
          <Text style={[styles.date, { color: theme.textSecondary }]}>
            {post.createdAt}
          </Text>
        </View>
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.description, { color: theme.text }]}>{post.caption}</Text>
        {post.media && (
          post.media.status === 'FAILED' ? (
            <View style={[styles.postImage, styles.mediaFailed]}>
              <SymbolView
                name={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' } as any}
                tintColor="#a892bf"
                size={22}
              />
              <Text style={styles.mediaFailedText}>Image unavailable</Text>
            </View>
          ) : post.media.url ? (
            <View style={styles.mediaWrapper}>
              <Image
                source={{ uri: post.media.url }}
                style={[styles.postImage, { aspectRatio: postImageAspectRatio }]}
                contentFit="cover"
                onLoad={handlePostImageLoad}
                // LCP image: skip the fade (cuts element-render delay) and hint the
                // browser to fetch it ahead of the queue (expo-image maps this to
                // <img fetchPriority> on web).
                transition={0}
                priority="high"
              />
              {post.media.status === 'PROCESSING' && (
                <View style={styles.mediaOverlay}>
                  <ActivityIndicator color="#ffffff" />
                  <Text style={styles.mediaOverlayText}>Processing…</Text>
                </View>
              )}
            </View>
          ) : null
        )}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={handleLike} style={styles.interactionButton}>
          <SymbolView
            name={
              (liked
                ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
                : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }) as any
            }
            tintColor={liked ? '#ff3b30' : theme.iconMuted}
            size={22}
          />
          <Text style={[styles.interactionText, { color: theme.iconMuted }, liked && styles.likedText]}>
            {likeCount}
          </Text>
        </Pressable>


        <Pressable style={[styles.interactionButton, styles.shareIconRight]}>
          <SymbolView
            name={{ ios: 'paperplane', android: 'share', web: 'share' } as any}
            tintColor={theme.iconMuted}
            size={20}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    marginHorizontal: 'auto',
    width: Platform.OS === 'web' ? '100%' : '95%',
    maxWidth: Platform.OS === 'web' ? 500 : undefined,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  headerPressed: {
    opacity: 0.78,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.two,
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  moreButton: {
    padding: Spacing.one,
  },
  body: {
    marginBottom: Spacing.two,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.two,
    fontWeight: '400',
  },
  mediaWrapper: {
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 3 / 2,
    borderRadius: 8,
    backgroundColor: '#1c1223',
  },
  mediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  mediaOverlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  mediaFailed: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  mediaFailedText: {
    color: '#a892bf',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.one,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(168, 146, 191, 0.15)',
  },
  interactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
  },
  interactionText: {
    color: '#a892bf',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  likedText: {
    color: '#ff3b30',
  },
  shareIconRight: {
    marginLeft: 'auto',
    marginRight: 0,
  },
});
