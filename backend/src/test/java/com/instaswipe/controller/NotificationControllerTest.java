package com.instaswipe.controller;

import com.instaswipe.dto.NotificationTokenRequest;
import com.instaswipe.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class NotificationControllerTest {

    private NotificationService notificationService;
    private NotificationController controller;

    @BeforeEach
    void setUp() {
        notificationService = mock(NotificationService.class);
        controller = new NotificationController(notificationService);
    }

    @Test
    void registerTokenDelegatesToService() {
        NotificationTokenRequest request = new NotificationTokenRequest("device-token");

        ResponseEntity<Void> response = controller.registerToken("user-1", request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(notificationService).registerfcmToken("user-1", "device-token");
    }

    @Test
    void sendNotificationDelegatesToService() {
        NotificationController.SendNotificationRequest request = new NotificationController.SendNotificationRequest(
                List.of("user-1"),
                "Hello",
                "World",
                Map.of("type", "message")
        );

        ResponseEntity<Void> response = controller.sendNotification(request);

        assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
        verify(notificationService).sendToUsers(eq(List.of("user-1")), eq("Hello"), eq("World"), anyMap());
    }
}
