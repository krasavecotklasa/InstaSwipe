package com.instaswipe.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.event.OfflineMessageEvent;
import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final UserRepository userRepository;

    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(value = RabbitMQConfig.PUSH_QUEUE, durable = "true"),
            exchange = @Exchange(value = RabbitMQConfig.PUSH_EXCHANGE),
            key = RabbitMQConfig.PUSH_ROUTING
    ))
    public void handleOfflineMessageEvent(OfflineMessageEvent event) {
        log.info("Received offline push notification event for recipient {}", event.getRecipientId());

        User recipient = userRepository.findById(event.getRecipientId()).orElse(null);
        if (recipient == null || recipient.getFcmToken() == null) {
            log.warn("Cannot send push notification: User or FCM token missing for user {}", event.getRecipientId());
            return;
        }

        try {
            Message message = Message.builder()
                    .setToken(recipient.getFcmToken())
                    .setNotification(Notification.builder()
                            .setTitle("New Message")
                            .setBody("You have a new message waiting in InstaSwipe!")
                            .build())
                    .putData("chatRoomId", event.getChatRoomId())
                    .putData("senderId", event.getSenderId())
                    .build();

            // FirebaseApp must be initialized for this to work
            String response = FirebaseMessaging.getInstance().send(message);
            log.info("Successfully sent FCM message: {}", response);
        } catch (Exception e) {
            log.error("Error sending push notification to user {}", event.getRecipientId(), e);
        }
    }
}
