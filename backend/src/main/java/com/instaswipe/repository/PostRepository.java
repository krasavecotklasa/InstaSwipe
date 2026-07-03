package com.instaswipe.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import com.instaswipe.model.Post;

public interface PostRepository extends MongoRepository<Post, String> {
    Page<Post> findByUserId(String userId, Pageable pageable);
}
