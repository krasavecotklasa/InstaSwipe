package com.instaswipe.controller;

import com.instaswipe.dto.EmailRequest;
import com.instaswipe.dto.EmailResponse;
import com.instaswipe.model.User;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/emails")
@RequiredArgsConstructor
public class EmailController {

    private final UserRepository userRepository;
    private final EmailService emailService;

    @GetMapping("/test/{userId}")
    public ResponseEntity<EmailResponse> sendTestEmail(@PathVariable String userId) {
        User user = userRepository.findById(userId).orElse(null);

        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        String htmlContent = """
                <html>
                  <body style="font-family: Arial, sans-serif;">
                    <h2>Test email from InstaSwipe</h2>
                    <p>This is a test email sent to verify the email delivery pipeline.</p>
                    <p>If you received this message, the email service is working correctly.</p>
                  </body>
                </html>
                """;

        EmailRequest emailRequest = new EmailRequest(
                user.getEmail(),
                "InstaSwipe test email",
                htmlContent,
                "This is a test email from InstaSwipe.",
                null
        );

        EmailResponse response = emailService.sendEmail(emailRequest);
        return ResponseEntity.ok(response);
    }
}
