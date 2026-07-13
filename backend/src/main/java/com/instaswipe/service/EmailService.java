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
     * @param verificationCode the verification code
     * @return EmailResponse
     */
    public EmailResponse sendVerificationEmail(String email, String verificationCode) {
        String htmlContent = buildVerificationEmailHtml(verificationCode);

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
        String htmlContent = buildPasswordResetEmailHtml(resetCode, expiryMinutes);

        EmailRequest emailRequest = new EmailRequest(
                email,
                "Reset Your InstaSwipe Password",
                htmlContent,
                "Your code to reset your password: " + resetCode,
                null
        );

        return sendEmail(emailRequest);
    }

    // Package-private (not private) so EmailServiceTest can assert on the generated markup directly.
    String buildVerificationEmailHtml(String code) {
        String body = String.format("""
                <p style="color:#656b78; font-size:15px; line-height:1.5; text-align:center; margin:0 0 20px;">
                    Use the code below to verify your email address. This code expires in 24 hours.
                </p>
                <div style="background-color:#f3e3ff; border-radius:8px; padding:16px; text-align:center;">
                    <span style="font-size:28px; font-weight:700; letter-spacing:6px; color:#6249ca;">%s</span>
                </div>
                """, code);
        return emailShell("Verify your email", body);
    }

    String buildPasswordResetEmailHtml(String code, int expiryMinutes) {
        String body = String.format("""
                <p style="color:#656b78; font-size:15px; line-height:1.5; text-align:center; margin:0 0 20px;">
                    Use the code below to reset your password. This code expires in %d minutes.
                </p>
                <div style="background-color:#ffe8d6; border-radius:8px; padding:16px; text-align:center;">
                    <span style="font-size:28px; font-weight:700; letter-spacing:6px; color:#c85a1f;">%s</span>
                </div>
                """, expiryMinutes, code);
        return emailShell("Reset your password", body);
    }

    private String emailShell(String heading, String bodyHtml) {
        return String.format("""
                <html>
                  <body style="margin:0; padding:32px 16px; background-color:#f6f1fb; font-family:Arial, Helvetica, sans-serif;">
                    <div style="max-width:480px; margin:0 auto; background-color:#ffffff; border-radius:12px; padding:32px; border:1px solid #e6def2;">
                      <div style="text-align:center; margin-bottom:24px;">
                        <span style="font-size:24px; font-weight:800; color:#8769ff;">Insta</span><span style="font-size:24px; font-weight:800; color:#ff8a3d;">Swipe</span>
                      </div>
                      <h2 style="color:#0f0913; font-size:20px; margin:0 0 16px; text-align:center;">%s</h2>
                      %s
                      <p style="color:#8a7698; font-size:13px; text-align:center; margin-top:32px;">If you didn't request this, you can safely ignore this email.</p>
                    </div>
                  </body>
                </html>
                """, heading, bodyHtml);
    }
}
