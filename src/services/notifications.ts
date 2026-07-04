import { Notification, User } from "../types";
import { getAll, updateWhere } from "../lib";

export async function getNotifications(): Promise<Notification[]> {
  return await getAll<Notification>("notifications");
}

export async function readAllNotifications(
  activeContractorId: number | null,
  currentUser: User
): Promise<void> {
  // Mark notifications as read for this user or contractor
  if (activeContractorId) {
    await updateWhere(
      "notifications",
      { read: true },
      "(contractorId = ? OR userId = ?) AND `read` = FALSE",
      [activeContractorId, currentUser.id]
    );
  } else {
    await updateWhere(
      "notifications",
      { read: true },
      "userId = ? AND `read` = FALSE",
      [currentUser.id]
    );
  }
}
