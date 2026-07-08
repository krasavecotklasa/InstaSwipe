package com.instaswipe.controller;

import com.instaswipe.dto.NotificationTokenRequest;
import com.instaswipe.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("/token")
    public ResponseEntity<Void> registerToken(
            @AuthenticationPrincipal String userId,
            @RequestBody NotificationTokenRequest request) {
        String fcmToken = request.fcmToken();
        notificationService.registerfcmToken(userId, fcmToken);
        return ResponseEntity.ok().build();
    }
}
