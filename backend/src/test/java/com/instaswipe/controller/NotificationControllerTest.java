package com.instaswipe.controller;

import com.instaswipe.dto.NotificationTokenRequest;
import com.instaswipe.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
        verify(notificationService).registerFcmToken("user-1", "device-token");
    }
}
