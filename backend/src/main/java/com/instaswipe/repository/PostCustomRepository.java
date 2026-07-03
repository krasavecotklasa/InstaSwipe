package com.instaswipe.repository;

import com.instaswipe.model.Post;

public interface PostCustomRepository {
    Post likePost(String postId, String userId);
    Post unlikePost(String postId, String userId);
}
