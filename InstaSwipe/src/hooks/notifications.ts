import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { API_PREFIX } from "@/hooks/api";
import { authorizedFetch } from "@/hooks/auth";

let notifToken: string = "";

export interface SendNotificationPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    alert("Push notifications require a physical device");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } =
      await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return;
  }

  // getDevicePushTokenAsync returns the native device token: an FCM token on
  // Android, but a raw APNs token on iOS. The backend delivers pushes via
  // Firebase, so only the Android FCM token is usable. Registering the iOS APNs
  // token as an `fcmToken` would silently fail to deliver, so skip it until iOS
  // FCM (GoogleService-Info.plist + messaging) is configured.
  if (Platform.OS !== "android") {
    console.warn(
      "[Notifications] Push registration is only supported on Android in this build; skipping."
    );
    return;
  }

  const token = await Notifications.getDevicePushTokenAsync();

  console.log("Firebase device push token:", token.data);

  notifToken = String(token.data);
  return notifToken;
}

export async function registerNotificationTokenAsync(fcmToken: string): Promise<Response> {
  return authorizedFetch(`${API_PREFIX}/notifications/token`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken }),
  });
}

export async function notificationControllerSend(payload: SendNotificationPayload): Promise<Response> {
  return authorizedFetch(`${API_PREFIX}/notifications/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function sendTestNotificationAsync() {
  // registerForPushNotificationsAsync already requests permissions and only
  // returns a token when they're granted, so we don't re-check them here.
  const token = await registerForPushNotificationsAsync();

  if (token) {
    const response = await registerNotificationTokenAsync(token);
    if (!response.ok) {
      throw new Error(`Could not register notification token (${response.status})`);
    }
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "InstaSwipe test",
      body: token ? "Firebase push token registered." : "No push token available on this device.",
      sound: true,
    },
    trigger: null,
  });

  return {
    notificationId,
  };
}
