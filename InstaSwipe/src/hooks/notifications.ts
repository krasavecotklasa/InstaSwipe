import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

let notifToken: string = "";

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

  const token = await Notifications.getExpoPushTokenAsync();

  console.log("Expo Push Token:", token.data);

  notifToken = token.data;
  return token.data;
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

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "InstaSwipe test",
      body: token ? `Push token: ${token}` : "No push token available on this device.",
      sound: true,
    },
    trigger: null,
  });

  return {
    notificationId,
    notifToken: token ?? notifToken,
  };
}
