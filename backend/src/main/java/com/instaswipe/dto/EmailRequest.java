package com.instaswipe.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record EmailRequest (
    
    @NotBlank(message = "Recipient email is required")
    @Email(message = "Invalid recipient email format")
    String to,
    
    @NotBlank(message = "Subject is required")
    String subject,
    
    @NotBlank(message = "HTML content is required")
    String htmlContent,
    
    String textContent,
    
    Map<String, String> metadata
) {}
