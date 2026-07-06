package com.instaswipe.controller;

import com.instaswipe.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @PostMapping("/{userId}/pass")
    public ResponseEntity<String> passPerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        return ResponseEntity.ok(matchService.passPerson(currentUserId, userId));
    }

    @PostMapping("/{userId}/love")
    public ResponseEntity<String> lovePerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        return ResponseEntity.ok(matchService.lovePerson(currentUserId, userId));
    }
}
