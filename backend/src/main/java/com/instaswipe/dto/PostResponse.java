package com.instaswipe.dto;

import java.time.Instant;

import com.instaswipe.model.Media;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PostResponse {
    private String id;
    private String userId;
    private String caption;
    private int likeCount;
    private Media media;
    private Instant createdAt;
}
