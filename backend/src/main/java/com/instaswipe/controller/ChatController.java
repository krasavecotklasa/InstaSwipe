package com.instaswipe.controller;

import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.dto.ChatMessageRequest;
import com.instaswipe.event.OfflineMessageEvent;
import com.instaswipe.model.Message;
import com.instaswipe.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final SimpUserRegistry simpUserRegistry;
    private final RabbitTemplate rabbitTemplate;

    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessageRequest chatMessage, SimpMessageHeaderAccessor headerAccessor) {

        // 1. Validate sender identity from STOMP session principal
        Principal principal = headerAccessor.getUser();
        if (principal == null) {
            log.error("Unauthenticated message attempt blocked");
            return;
        }

        String senderId = principal.getName();
        if (!senderId.equals(chatMessage.getSenderId())) {
            log.warn("Sender ID mismatch. Token principal: {}, Payload senderId: {}", senderId, chatMessage.getSenderId());
            return;
        }

        // 2. Persist message to MongoDB
        Message message = Message.builder()
                .chatRoomId(chatMessage.getChatRoomId())
                .senderId(senderId)
                .recipientId(chatMessage.getRecipientId())
                .content(chatMessage.getContent())
                .timestamp(Instant.now())
                .isRead(false)
                .build();

        Message savedMessage = messageRepository.save(message);

        // 3. Deliver to recipient's private queue
        messagingTemplate.convertAndSendToUser(
                chatMessage.getRecipientId(),
                "/queue/chat/" + chatMessage.getChatRoomId(),
                savedMessage
        );

        // 4. Echo back to sender (supports multiple devices/tabs)
        messagingTemplate.convertAndSendToUser(
                senderId,
                "/queue/chat/" + chatMessage.getChatRoomId(),
                savedMessage
        );

        // 5. Offline push notification via RabbitMQ → FCM
        SimpUser recipient = simpUserRegistry.getUser(chatMessage.getRecipientId());
        boolean isRecipientConnected = (recipient != null && !recipient.getSessions().isEmpty());

        if (!isRecipientConnected) {
            log.debug("Recipient {} is offline. Publishing push notification event...", chatMessage.getRecipientId());

            OfflineMessageEvent pushEvent = new OfflineMessageEvent(
                    savedMessage.getId(),
                    savedMessage.getChatRoomId(),
                    senderId,
                    savedMessage.getRecipientId(),
                    savedMessage.getContent());

            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.PUSH_EXCHANGE,
                    RabbitMQConfig.PUSH_ROUTING,
                    pushEvent);
        }
    }
}
