export type IntegrationResult = {
  success: boolean;
  externalId?: string;
  message?: string;
  error?: string;
};

export type SlackMessagePayload = {
  channel?: string;  // override default channel
  text: string;
  blocks?: unknown[];
};

export type MondayItemPayload = {
  boardId: string;
  itemName: string;
  columnValues: Record<string, unknown>;
};

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};
