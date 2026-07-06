package com.instaswipe.controller;

import com.instaswipe.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("api/matches")
@RequiredArgsConstructor
public class MatchSystemController {
    private final MatchService matchService;

    @PostMapping("/{userId}/pass")
    public ResponseEntity<String> passPerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        if (currentUserId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            return ResponseEntity.ok(matchService.passPerson(currentUserId, userId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @PostMapping("/{userId}/love")
    public ResponseEntity<String> lovePerson(
            @PathVariable String userId,
            @AuthenticationPrincipal String currentUserId
    ) {
        if (currentUserId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            return ResponseEntity.ok(matchService.lovePerson(currentUserId, userId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }
}
