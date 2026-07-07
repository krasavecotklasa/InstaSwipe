package com.instaswipe.service;

import com.instaswipe.dto.PageResponse;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.dto.UserSearchCriteria;
import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.Gender;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DiscoveryService {

    private final UserRepository userRepository;
    private final MediaStorageService mediaStorageService;

    public PageResponse<PublicProfileResponse> discover(
            String requesterId, Integer minAge, Integer maxAge, Gender gender,
            String country, List<String> interests, Pageable pageable
    ) {
        validateAge(minAge, maxAge);
        LocalDate today = LocalDate.now();
        LocalDate birthDateTo = minAge == null ? null : today.minusYears(minAge);
        LocalDate birthDateFrom = maxAge == null ? null : today.minusYears(maxAge + 1L).plusDays(1);

        User currentUser = userRepository.findById(requesterId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<String> excludedIds = new ArrayList<>();
        excludedIds.add(requesterId);

        if (currentUser.getLikedUserIds() != null) {
            excludedIds.addAll(currentUser.getLikedUserIds());
        }

        if (currentUser.getPassedUserIds() != null) {
            excludedIds.addAll(currentUser.getPassedUserIds());
        }

        UserSearchCriteria criteria = new UserSearchCriteria(
                birthDateFrom, birthDateTo, gender, country, interests, excludedIds
        );

        Page<PublicProfileResponse> page = userRepository.searchDiscoverable(criteria, pageable).map(this::toPublicProfile);
        return PageResponse.from(page);
    }

    private void validateAge(Integer minAge, Integer maxAge) {
        if (minAge != null && minAge < 0) throw new InvalidRequestException("Min age must be non-negative");
        if (maxAge != null && maxAge < 0) throw new InvalidRequestException("Max age must be non-negative");
        if (minAge != null && maxAge != null && minAge > maxAge) throw new InvalidRequestException("Min age must be less than or equal to max age");
    }

    private PublicProfileResponse toPublicProfile(User user) {
        UserProfile profile = user.getProfile();
        int age = profile.getBirthDate() == null ? 0
                : Period.between(profile.getBirthDate(), LocalDate.now()).getYears();
        String pictureUrl = null;
        if (profile.getProfilePicture() != null) {
            // Ensure profile picture URL is presigned
            pictureUrl = mediaStorageService.ensurePresignedUrl(profile.getProfilePicture().getUrl());
        }
        return new PublicProfileResponse(
                user.getId(), profile.getName(), profile.getBio(), age, profile.getCountry(),
                profile.getGender(), profile.getInterests(), pictureUrl
        );
    }
}
