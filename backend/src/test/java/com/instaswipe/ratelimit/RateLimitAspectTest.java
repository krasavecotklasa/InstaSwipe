package com.instaswipe.ratelimit;

import com.instaswipe.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RateLimitAspectTest {

    @Autowired
    private RateLimitedTestTarget target;

    @BeforeEach
    void setUp() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0." + (System.nanoTime() % 250));
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
        SecurityContextHolder.clearContext();
    }

    @Test
    void allowsCallsUnderTheLimitThenThrowsOnceExceeded() {
        assertThat(target.byIp()).isEqualTo("ok");
        assertThat(target.byIp()).isEqualTo("ok");

        assertThatThrownBy(target::byIp).isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void differentIpsAreNotThrottledByEachOther() {
        assertThat(target.byIp()).isEqualTo("ok");
        assertThat(target.byIp()).isEqualTo("ok");
        assertThatThrownBy(target::byIp).isInstanceOf(RateLimitExceededException.class);

        MockHttpServletRequest other = new MockHttpServletRequest();
        other.setRemoteAddr("10.0.0.201");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(other));

        assertThat(target.byIp()).isEqualTo("ok");
    }

    @Test
    void keysByAuthenticatedUser() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("user-" + System.nanoTime(), null, List.of()));

        assertThat(target.byUser()).isEqualTo("ok");
        assertThat(target.byUser()).isEqualTo("ok");
        assertThatThrownBy(target::byUser).isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void keysByEmailFromRequestBody() {
        RateLimitedTestTarget.TestEmailRequest req =
                new RateLimitedTestTarget.TestEmailRequest("abuse-" + System.nanoTime() + "@example.com");

        assertThat(target.byEmail(req)).isEqualTo("ok");
        assertThat(target.byEmail(req)).isEqualTo("ok");
        assertThatThrownBy(() -> target.byEmail(req)).isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void stackedAnnotationsEnforceEachIndependently() {
        RateLimitedTestTarget.TestEmailRequest req =
                new RateLimitedTestTarget.TestEmailRequest("stacked-" + System.nanoTime() + "@example.com");

        // email limit (2) is tighter than ip limit (5) here, so the email check trips first
        assertThat(target.byIpAndEmail(req)).isEqualTo("ok");
        assertThat(target.byIpAndEmail(req)).isEqualTo("ok");
        assertThatThrownBy(() -> target.byIpAndEmail(req)).isInstanceOf(RateLimitExceededException.class);
    }
}
