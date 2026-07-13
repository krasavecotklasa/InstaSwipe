package com.instaswipe.dto;

public record GifResponse(
        String id,
        String provider,
        String title,
        String gifUrl,
        String previewUrl,
        String sourceUrl,
        Integer width,
        Integer height
) {
}
