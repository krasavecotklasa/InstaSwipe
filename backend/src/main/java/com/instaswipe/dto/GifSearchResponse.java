package com.instaswipe.dto;

import java.util.List;

public record GifSearchResponse(
        List<GifResponse> content,
        String provider,
        int limit,
        String nextOffset
) {
}
