package com.instaswipe.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final UserRepository userRepository;

    public void registerfcmToken(String userId, String fcmToken) {
        if (fcmToken == null || fcmToken.isBlank()) {
            throw new IllegalArgumentException("FCM token must not be blank");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        user.setFcmToken(fcmToken);
        userRepository.save(user);
        log.info("Stored FCM token for user {}", userId);
    }

    public void sendToUsers(List<String> userIds, String title, String body, Map<String, String> data) {
        if (userIds == null || userIds.isEmpty()) {
            log.warn("No recipients provided for notification");
            return;
        }

        List<User> users = userRepository.findAllById(userIds);
        List<String> tokens = users.stream()
                .map(User::getFcmToken)
                .filter(Objects::nonNull)
                .filter(token -> !token.isBlank())
                .toList();

        if (tokens.isEmpty()) {
            log.warn("No FCM tokens found for users {}", userIds);
            return;
        }

        for (String token : tokens) {
            try {
                Message.Builder messageBuilder = Message.builder()
                        .setToken(token)
                        .setNotification(Notification.builder()
                                .setTitle(title)
                                .setBody(body)
                                .build());

                if (data != null) {
                    data.forEach(messageBuilder::putData);
                }

                String response = FirebaseMessaging.getInstance().send(messageBuilder.build());
                log.info("Successfully sent FCM message to token {}: {}", token, response);
            } catch (Exception e) {
                log.error("Failed to send FCM message to token {}", token, e);
            }
        }
    }
}
