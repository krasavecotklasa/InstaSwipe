package com.instaswipe.controller;

import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.model.Gender;
import com.instaswipe.service.DiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/discovery")
@RequiredArgsConstructor
public class DiscoveryController {

    private final DiscoveryService discoveryService;

    @GetMapping
    public ResponseEntity<PageResponse<PublicProfileResponse>> discover(
            @AuthenticationPrincipal String requesterId,
            @RequestParam(required = false) Integer minAge,
            @RequestParam(required = false) Integer maxAge,
            @RequestParam(required = false) Gender gender,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) List<String> interests,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(discoveryService.discover(requesterId, minAge, maxAge, gender, country, interests, pageable));
    }
}
