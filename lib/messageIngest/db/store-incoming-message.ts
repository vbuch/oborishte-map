import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Step 1: Store the incoming message in the database
 */
export async function storeIncomingMessage(
  text: string,
  userId: string,
  userEmail: string | null,
  source: string = "web-interface"
): Promise<string> {
  const messagesRef = adminDb.collection("messages");
  const docRef = await messagesRef.add({
    text,
    userId,
    userEmail,
    source,
    createdAt: FieldValue.serverTimestamp(),
  });
  return docRef.id;
}
