package com.instaswipe.service;

import java.time.Instant;

import lombok.RequiredArgsConstructor;

import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.instaswipe.model.Post;
import com.instaswipe.model.MediaType;
import com.instaswipe.model.Media;
import com.instaswipe.repository.PostRepository;

@Service
@RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepository;
    private final MediaStorageService mediaStorageService;

    public Post createMediaPost(String userId, String caption, MultipartFile file) {
        String url = mediaStorageService.upload(file, userId);

        Media media = new Media();
        media.setUrl(url);
        media.setFilename(file.getOriginalFilename());
        media.setSize(file.getSize());

        if (file.getContentType().startsWith("image")) {
            media.setType(MediaType.IMAGE);
        } else {
            media.setType(MediaType.VIDEO);
        }

        Post post = new Post();
        post.setUserId(userId);
        post.setCaption(caption);
        post.setMedia(media);
        post.setCreatedAt(Instant.now());

        return postRepository.save(post);
    }

    public Post createTextPost(String userId, String caption) {
        Post post = new Post();
        post.setUserId(userId);
        post.setCaption(caption);
        post.setMedia(null);
        post.setCreatedAt(Instant.now());

        return postRepository.save(post);
    }

    public Page<Post> getPostsByUserId(String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return postRepository.findByUserId(userId, pageable);
    }
}
