// Canonical interest options for the profile form. The backend requires between
// MIN and MAX selections (see ProfileUpdateRequest), each at most 30 characters.
export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 20;

// How many interest chips a match card shows before collapsing the rest into a
// "+N" chip, so a profile with all 20 interests doesn't bury the card overlay.
export const MAX_VISIBLE_MATCH_INTERESTS = 8;

export const INTEREST_OPTIONS: string[] = [
  'Travel', 'Music', 'Movies', 'Reading', 'Cooking', 'Fitness', 'Gaming', 'Photography',
  'Art', 'Dancing', 'Hiking', 'Camping', 'Yoga', 'Running', 'Cycling', 'Swimming',
  'Football', 'Basketball', 'Tennis', 'Coffee', 'Wine', 'Foodie', 'Fashion', 'Technology',
  'Science', 'History', 'Nature', 'Animals', 'Volunteering', 'Meditation', 'Writing',
  'Podcasts', 'Board Games', 'Gardening', 'Astronomy', 'Fishing', 'Politics', 'Pornography',
  'Programming', 'Exploration', 'Online Moderation', 'Drinking', 'Driving'
];
