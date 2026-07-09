package com.instaswipe.controller;

import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.dto.ChatMessageRequest;
import com.instaswipe.event.OfflineMessageEvent;
import com.instaswipe.model.Message;
import com.instaswipe.repository.MessageRepository;
import com.instaswipe.service.MatchService;
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

@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final SimpUserRegistry simpUserRegistry;
    private final RabbitTemplate rabbitTemplate;
    private final MatchService matchService;

    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessageRequest chatMessage, SimpMessageHeaderAccessor headerAccessor) {

        // 1. Validate sender identity from STOMP session principal
        Principal principal = headerAccessor.getUser();
        if (principal == null) {
            log.error("Unauthenticated message attempt blocked");
            return;
        }

        String senderId = principal.getName();
        if (!senderId.equals(chatMessage.senderId())) {
            log.warn("Sender ID mismatch. Token principal: {}, Payload senderId: {}", senderId, chatMessage.senderId());
            return;
        }

        // 2. Authorize: sender and recipient must be the two participants of this match (room).
        //    Guards the write path the same way the SUBSCRIBE interceptor guards the read path.
        if (!matchService.isConversationBetween(chatMessage.chatRoomId(), senderId, chatMessage.recipientId())) {
            log.warn("Rejected message: {} is not authorized to send to room {} (recipient {})",
                    senderId, chatMessage.chatRoomId(), chatMessage.recipientId());
            return;
        }

        // 3. Persist message to MongoDB (timestamp is populated by @CreatedDate auditing)
        Message message = Message.builder()
                .chatRoomId(chatMessage.chatRoomId())
                .senderId(senderId)
                .recipientId(chatMessage.recipientId())
                .content(chatMessage.content())
                .isRead(false)
                .build();

        Message savedMessage = messageRepository.save(message);

        // The RabbitMQ STOMP relay parses "/queue/<name>" as a single segment, so the
        // destination name must not contain a nested "/". Using "/queue/<roomId>" directly
        // (no "chat/" sub-path) keeps the resolved per-user destination valid; otherwise the
        // broker rejects it as an "Invalid destination" and the message is silently dropped.
        String roomQueue = "/queue/" + chatMessage.chatRoomId();

        // 4. Deliver to recipient's private queue
        messagingTemplate.convertAndSendToUser(
                chatMessage.recipientId(),
                roomQueue,
                savedMessage
        );

        // 5. Echo back to sender (supports multiple devices/tabs)
        messagingTemplate.convertAndSendToUser(
                senderId,
                roomQueue,
                savedMessage
        );

        // 6. Offline push notification via RabbitMQ → FCM
        SimpUser recipient = simpUserRegistry.getUser(chatMessage.recipientId());
        boolean isRecipientConnected = (recipient != null && !recipient.getSessions().isEmpty());

        if (!isRecipientConnected) {
            log.debug("Recipient {} is offline. Publishing push notification event...", chatMessage.recipientId());

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
