// When the queue is sent:
//   - right after a scan (the card calls flushQueue itself);
//   - when the network comes back (NetInfo) and when the app returns to the foreground;
//   - every few seconds while the app is open, for receipts whose retry pause has run out;
//   - in the background, roughly every 15 minutes at the system's discretion (expo-background-task).
import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { queue } from "@/lib/queue";
import { flushQueue } from "@/lib/sender";
import { authToken } from "@/lib/token";

export const BACKGROUND_TASK = "react-money-receipt-queue";

// Must run at module load, before the app renders: the system may start the JS just to run this task.
TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    if (!authToken.get()) await authToken.load();
    queue.recoverInterrupted();
    await flushQueue();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

const TICK_MS = 5_000;

/** Foreground triggers + background registration; mounted only while signed in. */
export function useQueueSync() {
  useEffect(() => {
    queue.recoverInterrupted();
    void flushQueue();

    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) void flushQueue();
    });
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") void flushQueue();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && queue.all().some((i) => i.status === "queued" && i.nextAttemptAt <= Date.now())) {
        void flushQueue();
      }
    }, TICK_MS);

    BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 15 }).catch(() => {});

    return () => {
      net();
      app.remove();
      clearInterval(timer);
    };
  }, []);
}
