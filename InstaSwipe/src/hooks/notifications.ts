import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { API_BASE_URL, API_PREFIX } from "@/hooks/api";
import { getAccessToken } from "@/hooks/auth";

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

  const token = await Notifications.getDevicePushTokenAsync();

  console.log("Firebase device push token:", token.data);

  notifToken = String(token.data);
  return notifToken;
}

export async function registerNotificationTokenAsync(fcmToken: string): Promise<Response> {
  return request(`${API_PREFIX}/notifications/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken }),
  });
}

export async function notificationControllerSend(payload: SendNotificationPayload): Promise<Response> {
  return request(`${API_PREFIX}/notifications/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function sendTestNotificationAsync() {
  const token = await registerForPushNotificationsAsync();
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    throw new Error("Notification permissions were not granted");
  }

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
