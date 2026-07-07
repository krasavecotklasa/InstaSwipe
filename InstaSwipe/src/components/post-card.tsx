import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { likePost, unlikePost } from '@/hooks/posts';


export interface Post {
  id: string;
  userId: string;
  username: string;
  caption?: string;
  likes: number;
  likedByMe: boolean;
  media?: {
    type: 'IMAGE' | 'VIDEO';
    url: string;
    filename: string;
    size: number;
  };
  createdAt: string;
}

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const theme = useTheme();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likes);

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

  return (
    <View style={[styles.card, { borderColor: theme.tabActiveBorder }]}>
      <View style={styles.header}>
        <Image
          source={{ uri: post.username }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.username}>{post.username}</Text>
          <Text style={[styles.date, { color: theme.textSecondary }]}>
            {post.createdAt}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.description}>{post.caption}</Text>
        {post.media?.url && (
          <Image
            source={{ uri: post.media.url }}
            style={styles.postImage}
            contentFit="cover"
            transition={300}
          />
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
            tintColor='#ff3b30'
            size={22}
          />
          <Text style={[styles.interactionText, liked && styles.likedText]}>
            {likeCount}
          </Text>
        </Pressable>


        <Pressable style={[styles.interactionButton, styles.shareIconRight]}>
          <SymbolView
            name={{ ios: 'paperplane', android: 'share', web: 'share' } as any}
            tintColor="#a892bf"
            size={20}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000000',
    borderWidth: 1,
    padding: Platform.OS === 'web' ? Spacing.two : Spacing.three,
    marginBottom: Spacing.three,
    width: Platform.OS === 'web' ? '100%' : '100%',
    maxWidth: Platform.OS === 'web' ? 500 : undefined,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.two,
    backgroundColor: '#1c1223',
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    color: '#ffffff',
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
    color: '#f0f0f2',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.two,
    fontWeight: '400',
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#1c1223',
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
