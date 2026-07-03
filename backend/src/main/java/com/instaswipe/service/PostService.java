package com.instaswipe.service;

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
import com.instaswipe.service.ImageProcessingService.ProcessedImage;

@Service
@RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepository;
    private final MediaStorageService mediaStorageService;
    private final ImageProcessingService imageProcessingService;

    public Post createMediaPost(String userId, String caption, MultipartFile file) {
        ProcessedImage image = imageProcessingService.process(file);
        String url = mediaStorageService.upload(image.data(), image.contentType(), image.extension(), userId);

        Media media = Media.builder()
                .type(MediaType.IMAGE)
                .url(url)
                .filename(file.getOriginalFilename())
                .size(image.data().length)
                .build();

        Post post = Post.builder()
                .userId(userId)
                .caption(caption)
                .media(media)
                .build();

        return postRepository.save(post);
    }

    public Post createTextPost(String userId, String caption) {
        Post post = Post.builder()
                .userId(userId)
                .caption(caption)
                .build();

        return postRepository.save(post);
    }

    public Page<Post> getPostsByUserId(String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return postRepository.findByUserId(userId, pageable);
    }
}
