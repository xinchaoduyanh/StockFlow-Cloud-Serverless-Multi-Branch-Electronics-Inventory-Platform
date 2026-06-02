import { useEffect } from "react";
import Pusher from "pusher-js";

export function usePusherNotification(
  userId: string | undefined,
  onNewNotification: (notification: any) => void,
) {
  useEffect(() => {
    if (!userId) return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || pusherKey === "mock-pusher-key") {
      console.warn("Pusher key is not configured. Real-time push notifications will not start.");
      return;
    }

    if (process.env.NODE_ENV === "development") {
      Pusher.logToConsole = true;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster || "ap1",
    });

    const channelName = `user-${userId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("notification:new", (data: any) => {
      console.log("Real-time notification received via Pusher:", data);
      onNewNotification(data);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [userId, onNewNotification]);
}
