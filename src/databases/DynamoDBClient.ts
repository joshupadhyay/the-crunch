import { randomUUIDv7 } from "bun";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Conversation, IDatabase, Message } from "./Database";

type ConversationItem = {
  pk: string;
  sk: "META";
  entityType: "conversation";
  id: string;
  userId: string;
  createdAt: string;
};

type MessageItem = {
  pk: string;
  sk: string;
  entityType: "message";
  role: Message["role"];
  content: string;
  createdAt: string;
};

export class DynamoDBDB implements IDatabase {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  private constructor(tableName: string, client: DynamoDBDocumentClient) {
    this.tableName = tableName;
    this.client = client;
  }

  static connect(): DynamoDBDB {
    const tableName = process.env.CHAT_TABLE_NAME;
    if (!tableName) throw new Error("Missing env var CHAT_TABLE_NAME");

    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });

    return new DynamoDBDB(tableName, client);
  }

  async createConversation(userId: string): Promise<Conversation> {
    const id = randomUUIDv7().toString();
    const createdAt = new Date().toISOString();
    const item: ConversationItem = {
      pk: this.conversationPk(id, userId),
      sk: "META",
      entityType: "conversation",
      id,
      userId,
      createdAt,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );

    return { id, createdAt };
  }

  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :messagePrefix)",
        ExpressionAttributeValues: {
          ":pk": this.conversationPk(conversationId, userId),
          ":messagePrefix": "MSG#",
        },
        ScanIndexForward: true,
      }),
    );

    return (result.Items ?? []).map((item) => {
      const message = item as MessageItem;
      return { role: message.role, content: message.content };
    });
  }

  async getAllConversations(userId: string): Promise<Conversation[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ScanIndexForward: false,
      }),
    );

    return (result.Items ?? []).map((item) => {
      const conversation = item as ConversationItem;
      return { id: conversation.id, createdAt: conversation.createdAt };
    });
  }

  async pushMessage(
    id: string,
    userId: string,
    role: Message["role"],
    content: string,
  ): Promise<Message[]> {
    const createdAt = new Date().toISOString();
    const messageId = randomUUIDv7().toString();
    const item: MessageItem = {
      pk: this.conversationPk(id, userId),
      sk: `MSG#${createdAt}#${messageId}`,
      entityType: "message",
      role,
      content,
      createdAt,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );

    return this.getConversation(id, userId);
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    const messages = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": this.conversationPk(id, userId) },
      }),
    );

    await Promise.all(
      (messages.Items ?? []).map((item) =>
        this.client.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { pk: item.pk, sk: item.sk },
          }),
        ),
      ),
    );
  }

  private conversationPk(id: string, userId: string) {
    return `USER#${userId}#CONVERSATION#${id}`;
  }
}
