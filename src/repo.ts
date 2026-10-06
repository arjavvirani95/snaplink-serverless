import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Link } from "./links.js";

export interface LinkRepo {
  /** Returns false if the code is already taken. */
  create(link: Link): Promise<boolean>;
  get(code: string): Promise<Link | undefined>;
  recordClick(code: string): Promise<void>;
}

export class DynamoLinkRepo implements LinkRepo {
  constructor(
    private readonly table: string,
    private readonly doc = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  ) {}

  async create(link: Link): Promise<boolean> {
    try {
      await this.doc.send(
        new PutCommand({ TableName: this.table, Item: link, ConditionExpression: "attribute_not_exists(code)" }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }

  async get(code: string): Promise<Link | undefined> {
    const { Item } = await this.doc.send(new GetCommand({ TableName: this.table, Key: { code } }));
    const link = Item as Link | undefined;
    // TTL deletion is eventually consistent, so treat expired items as missing straight away.
    if (link?.expiresAt && link.expiresAt * 1000 < Date.now()) return undefined;
    return link;
  }

  async recordClick(code: string): Promise<void> {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { code },
        UpdateExpression: "ADD clicks :one SET lastClickedAt = :now",
        ExpressionAttributeValues: { ":one": 1, ":now": new Date().toISOString() },
      }),
    );
  }
}

export class InMemoryLinkRepo implements LinkRepo {
  readonly items = new Map<string, Link>();

  async create(link: Link) {
    if (this.items.has(link.code)) return false;
    this.items.set(link.code, { ...link });
    return true;
  }

  async get(code: string) {
    const link = this.items.get(code);
    if (link?.expiresAt && link.expiresAt * 1000 < Date.now()) return undefined;
    return link;
  }

  async recordClick(code: string) {
    const link = this.items.get(code);
    if (link) link.clicks += 1;
  }
}
