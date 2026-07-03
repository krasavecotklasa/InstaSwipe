package com.instaswipe.dto;

import org.springframework.web.multipart.MultipartFile;

/**
 * A post carries a caption, an image, or both. Both fields are optional here;
 * the service rejects the empty-empty case.
 */
public record CreatePostRequest(
    MultipartFile file,
    String caption
) {}
