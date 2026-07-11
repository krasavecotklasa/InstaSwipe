package com.instaswipe.security;

import java.io.IOException;

import com.instaswipe.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

@Slf4j
public class EmailVerifiedAuthenticationFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    public EmailVerifiedAuthenticationFilter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !isEmailVerified(authentication.getName())) {
            SecurityContextHolder.clearContext();
            request.setAttribute(JwtAuthenticationFailure.ATTRIBUTE, JwtAuthenticationFailure.EMAIL_NOT_VERIFIED);
        }

        filterChain.doFilter(request, response);
    }

    private boolean isEmailVerified(String userId) {
        try {
            return userRepository.existsByIdAndEmailVerifiedTrue(userId);
        } catch (DataAccessException e) {
            // Fail closed: a transient DB error must not be allowed to propagate out of a security
            // filter and turn into a 500 across every authenticated endpoint in the app.
            log.warn("Unable to check email-verified status for user {}; failing closed", userId, e);
            return false;
        }
    }
}
