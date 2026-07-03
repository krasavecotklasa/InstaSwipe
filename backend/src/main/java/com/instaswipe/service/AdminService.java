package com.instaswipe.service;

import com.instaswipe.dto.AdminUserDetailResponse;
import com.instaswipe.dto.AdminUserSummaryResponse;
import com.instaswipe.dto.PageResponse;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;

    public PageResponse<AdminUserSummaryResponse> listUsers(Pageable pageable) {
        return PageResponse.from(userRepository.findAll(pageable).map(this::toSummary));
    }

    private AdminUserSummaryResponse toSummary(User user) {
        String displayName = user.getProfile() == null ? null : user.getProfile().getName();
        return new AdminUserSummaryResponse(
                user.getId(), user.getEmail(), user.getRoles(), user.isEnabled(),
                user.isEmailVerified(), displayName, user.getCreatedAt()
        );
    }

    public AdminUserDetailResponse getUser(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toDetail(user);
    }

    private AdminUserDetailResponse toDetail(User user) {
        UserProfile profile = user.getProfile();
        return new AdminUserDetailResponse(
                user.getId(), user.getEmail(), user.getRoles(), user.isEnabled(),
                user.isEmailVerified(), profile == null ? null : profile.getName(),
                profile == null ? null : profile.getBio(), profile == null ? null : profile.getBirthDate(),
                profile == null ? null : profile.getCountry(), profile == null ? null : profile.getGender(),
                profile == null ? null : profile.getInterests(),
                profile == null || profile.getProfilePicture() == null ? null : profile.getProfilePicture().getUrl(),
                size(user.getLikedUserIds()), size(user.getPassedUserIds()),
                user.getCreatedAt(), user.getUpdatedAt()
        );
    }

    private int size(Set<String> ids) {
        return ids == null ? 0 : ids.size();
    }
}
