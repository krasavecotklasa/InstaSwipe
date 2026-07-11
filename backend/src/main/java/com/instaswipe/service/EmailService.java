package com.instaswipe.service;

import com.instaswipe.config.EmailConfig;
import com.instaswipe.dto.EmailRequest;
import com.instaswipe.dto.EmailResponse;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class EmailService {

    private final EmailConfig emailConfig;
    private final Resend resendClient;

    public EmailService(EmailConfig emailConfig) {
        this.emailConfig = emailConfig;
        this.resendClient = new Resend(emailConfig.getApiKey());
    }

    /**
     * Send an email using Resend API
     *
     * @param emailRequest the email request containing recipient, subject, and content
     * @return EmailResponse with message ID and status
     */
    public EmailResponse sendEmail(EmailRequest emailRequest) {
        if (!emailConfig.isEnabled()) {
            log.warn("Email service is disabled");
            return new EmailResponse(
                    null,
                    "DISABLED",
                    null,
                    "Email service is disabled",
                    false
            );
        }

        try {
            CreateEmailOptions createEmailOptions = CreateEmailOptions.builder()
                    .from(emailConfig.getFromEmail())
                    .to(emailRequest.to())
                    .subject(emailRequest.subject())
                    .html(emailRequest.htmlContent())
                    .text(emailRequest.textContent())
                    .build();

            CreateEmailResponse response = resendClient.emails().send(createEmailOptions);

            if (response != null && response.getId() != null) {
                log.info("Email sent successfully to {} with message ID: {}", emailRequest.to(), response.getId());
                return new EmailResponse(
                        response.getId(),
                        "SENT",
                        emailRequest.to(),
                        null,
                        true
                );
            } else {
                log.error("Failed to send email: Invalid response from Resend");
                return new EmailResponse(
                        null,
                        "FAILED",
                        emailRequest.to(),
                        "Invalid response from email service",
                        false
                );
            }

        } catch (ResendException e) {
            log.error("Resend API error while sending email to {}: {}", emailRequest.to(), e.getMessage());
            return new EmailResponse(
                    null,
                    "FAILED",
                    emailRequest.to(),
                    "Resend API error: " + e.getMessage(),
                    false
            );
        } catch (Exception e) {
            log.error("Unexpected error while sending email to {}: {}", emailRequest.to(), e.getMessage(), e);
            return new EmailResponse(
                    null,
                    "ERROR",
                    emailRequest.to(),
                    "Unexpected error: " + e.getMessage(),
                    false
            );
        }
    }

    /**
     * Send email asynchronously
     *
     * @param emailRequest the email request
     * @return CompletableFuture with EmailResponse
     */
    public CompletableFuture<EmailResponse> sendEmailAsync(EmailRequest emailRequest) {
        return CompletableFuture.supplyAsync(() -> sendEmail(emailRequest))
                .exceptionally(ex -> {
                    log.error("Async email sending failed: {}", ex.getMessage(), ex);
                    return new EmailResponse(
                            null,
                            "ERROR",
                            emailRequest.to(),
                            "Async send failed: " + ex.getMessage(),
                            false
                    );
                });
    }

    /**
     * Send email verification email
     *
     * @param email the user's email address
     * @param verificationCode the verification code or link
     * @return EmailResponse
     */
    public EmailResponse sendVerificationEmail(String email, String verificationCode) {
        String htmlContent = String.format("""
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h1>Verify Your Email</h1>
                        <p>Please click the link below to verify your email address:</p>
                        <p><a href="%s" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                        <p>Or use this code: <strong>%s</strong></p>
                        <p>This link expires in 24 hours.</p>
                        <br>
                        <p>If you didn't request this, please ignore this email.</p>
                    </body>
                </html>
                """, verificationCode, verificationCode);

        EmailRequest emailRequest = new EmailRequest(
                email,
                "Verify Your InstaSwipe Email",
                htmlContent,
                "Use this code to verify your email: " + verificationCode,
                null
        );

        return sendEmail(emailRequest);
    }

    /**
     * Send password reset email
     *
     * @param email the user's email address
     * @param resetCode the one-time password reset code
     * @param expiryMinutes how long the code stays valid, in minutes
     * @return EmailResponse
     */
    public EmailResponse sendPasswordResetEmail(String email, String resetCode, int expiryMinutes) {
        String htmlContent = String.format("""
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h1>Reset Your Password</h1>
                        <p>Use the code below to reset your password:</p>
                        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 16px 0;">%s</p>
                        <p>This code expires in %d minutes.</p>
                        <br>
                        <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                    </body>
                </html>
                """, resetCode, expiryMinutes);

        EmailRequest emailRequest = new EmailRequest(
                email,
                "Reset Your InstaSwipe Password",
                htmlContent,
                "Your code to reset your password: " + resetCode,
                null
        );

        return sendEmail(emailRequest);
    }
}
