import { adminDb } from "@/lib/firebase-admin";
import { processFieldsForFirestore } from "./process-fields";

/**
 * Update message document with multiple fields atomically
 * @param messageId - The message document ID
 * @param fields - Object containing fields to update
 */
export async function updateMessage(
  messageId: string,
  fields: Record<string, any>
): Promise<void> {
  const messagesRef = adminDb.collection("messages");
  const processedFields = processFieldsForFirestore(fields);
  await messagesRef.doc(messageId).update(processedFields);
}
