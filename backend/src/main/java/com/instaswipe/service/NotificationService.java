package com.instaswipe.service;

import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final UserRepository userRepository;

    public void registerFcmToken(String userId, String fcmToken) {
        if (fcmToken == null || fcmToken.isBlank()) {
            throw new InvalidRequestException("FCM token must not be blank");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        user.setFcmToken(fcmToken);
        userRepository.save(user);
        log.info("Stored FCM token for user {}", userId);
    }
}
