import type { Db } from "../db.ts";
import type { OrderRow } from "../market/orders.ts";
import type { EdukhataChat } from "./module.ts";

/**
 * The order's chat: the direct conversation between the student and the assigned
 * mentor (created when the mentor is assigned; one per pair, shared by their orders).
 */
export function orderConversations(
  db: Db,
  chat: EdukhataChat,
  logger: { error(o: object, m?: string): void },
) {
  return {
    async onAssigned(o: OrderRow) {
      if (!o.mentor_id) return;
      try {
        const { conversation } = await chat.chat.service.createDirect(o.student_id, o.mentor_id);
        await db.query(
          `insert into order_conversations (order_id, conversation_id) values ($1, $2)
           on conflict (order_id) do update set conversation_id = excluded.conversation_id, created_at = now()`,
          [o.id, conversation.id],
        );
      } catch (err) {
        // The order stands; the chat can be opened again from the order page.
        logger.error({ err, orderId: o.id }, "order conversation failed");
      }
    },
  };
}
