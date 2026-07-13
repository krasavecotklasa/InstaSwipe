package com.instaswipe.service;

import com.instaswipe.config.EmailConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class EmailServiceTest {

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        EmailConfig config = new EmailConfig();
        config.setApiKey("test-key");
        config.setFromEmail("noreply@instaswipe.app");
        config.setFromName("InstaSwipe");
        config.setEnabled(false);
        emailService = new EmailService(config);
    }

    @Test
    void verificationEmailHtmlContainsCodeAndNoLink() {
        String html = emailService.buildVerificationEmailHtml("123456");

        assertThat(html).contains("123456");
        assertThat(html).doesNotContain("<a href");
        assertThat(html).contains("Insta");
        assertThat(html).contains("Swipe");
        assertThat(html).contains("#8769ff");
        assertThat(html).contains("#ff8a3d");
    }

    @Test
    void passwordResetEmailHtmlContainsCodeAndExpiry() {
        String html = emailService.buildPasswordResetEmailHtml("654321", 10);

        assertThat(html).contains("654321");
        assertThat(html).contains("10 minutes");
        assertThat(html).doesNotContain("<a href");
    }

    @Test
    void writesPreviewFilesForManualInspection() throws IOException {
        Path dir = Path.of("target", "email-previews");
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("verification.html"), emailService.buildVerificationEmailHtml("482913"));
        Files.writeString(dir.resolve("password-reset.html"), emailService.buildPasswordResetEmailHtml("731045", 10));
    }
}
