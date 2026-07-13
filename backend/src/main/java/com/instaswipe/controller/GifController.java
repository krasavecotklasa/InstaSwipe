package com.instaswipe.controller;

import com.instaswipe.dto.GifSearchResponse;
import com.instaswipe.ratelimit.KeyStrategy;
import com.instaswipe.ratelimit.RateLimited;
import com.instaswipe.service.GifService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gifs")
@RequiredArgsConstructor
public class GifController {

    private final GifService gifService;

    @GetMapping("/search")
    @RateLimited(bucket = "gif-search", keyBy = KeyStrategy.USER, limit = 120, windowSeconds = 3600)
    public ResponseEntity<GifSearchResponse> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "all") String provider,
            @RequestParam(defaultValue = "24") int limit,
            @RequestParam(defaultValue = "0") String offset) {
        return ResponseEntity.ok(gifService.search(q, provider, limit, offset));
    }
}
