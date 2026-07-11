package com.instaswipe.security;

import java.io.IOException;

import com.instaswipe.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class EmailVerifiedAuthenticationFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    public EmailVerifiedAuthenticationFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            String userId = authentication.getName();
            boolean allowed = userRepository.findById(userId)
                    .map(user -> user.isEmailVerified())
                    .orElse(false);
            if (!allowed) {
                SecurityContextHolder.clearContext();
                request.setAttribute(JwtAuthenticationFailure.ATTRIBUTE, JwtAuthenticationFailure.EMAIL_NOT_VERIFIED);
            }
        }

        filterChain.doFilter(request, response);
    }
}
