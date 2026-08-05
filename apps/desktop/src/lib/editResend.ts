import {
  bindThreadId,
  createSession,
  setSessionMessages,
  type ChatMessage,
  type ChatSession
} from "./sessionStore";
import type {
  EditRegeneratePrepareResponse,
  RunInput,
  ThreadBranchRequest,
  ThreadBranchResponse
} from "./turnsClient";

export interface EditableTurn {
  userIndex: number;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  assistantMessageIds: string[];
  primaryAssistantMessageId: string;
}

export interface EditResendApi {
  createBranch: (threadId: string, body: ThreadBranchRequest) => Promise<ThreadBranchResponse>;
  prepareEdit: (
    threadId: string,
    humanMessageId: string,
    replacementText: string
  ) => Promise<EditRegeneratePrepareResponse>;
  deleteThread: (threadId: string) => Promise<void>;
}

/** Resolve only a completed user -> assistant pair with durable engine IDs. */
export function resolveEditableTurn(messages: ChatMessage[], userMessageId: string): EditableTurn {
  const userIndex = messages.findIndex((message) => message.role === "user" && message.id === userMessageId);
  if (userIndex < 0) throw new Error("找不到要编辑的用户消息");

  const userMessage = messages[userIndex];
  const assistantMessage = messages[userIndex + 1];
  if (!assistantMessage || assistantMessage.role !== "assistant" || assistantMessage.status !== "done") {
    throw new Error("该用户消息后的 assistant 回复尚未完成，无法编辑");
  }
  if (!assistantMessage.text?.trim()) {
    throw new Error("该用户消息后的 assistant 回复尚未完成，无法编辑");
  }
  const assistantMessageIds = assistantMessage.engineMessageIds ?? [];
  if (assistantMessageIds.length === 0) {
    throw new Error("assistant 消息标识缺失，无法编辑");
  }

  return {
    userIndex,
    userMessage,
    assistantMessage,
    assistantMessageIds,
    primaryAssistantMessageId: assistantMessageIds[assistantMessageIds.length - 1]
  };
}

export function editableUserMessageIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>();
  messages.forEach((message) => {
    if (message.role !== "user") return;
    try {
      resolveEditableTurn(messages, message.id);
      ids.add(message.id);
    } catch {
      // Incomplete and legacy turns stay copy-only until a durable anchor exists.
    }
  });
  return ids;
}

function removeHistoricalFiles(input: RunInput): RunInput {
  return {
    ...input,
    messages: input.messages.map((message) => {
      const additional = message.additional_kwargs;
      if (!additional || !("files" in additional)) return message;
      const { files: _files, ...withoutFiles } = additional;
      return { ...message, additional_kwargs: withoutFiles };
    })
  };
}

export async function prepareEditedBranch(options: {
  sourceSession: ChatSession;
  userMessageId: string;
  replacementText: string;
  api: EditResendApi;
}): Promise<{
  target: EditableTurn;
  branch: ThreadBranchResponse;
  prepared: EditRegeneratePrepareResponse;
}> {
  const replacementText = options.replacementText.trim();
  if (!replacementText) throw new Error("编辑后的消息不能为空");
  const sourceThreadId = options.sourceSession.threadId;
  if (!sourceThreadId) throw new Error("当前任务没有可用 thread");

  const target = resolveEditableTurn(options.sourceSession.messages, options.userMessageId);
  const branch = await options.api.createBranch(sourceThreadId, {
    message_id: target.primaryAssistantMessageId,
    message_ids: target.assistantMessageIds,
    title: `${options.sourceSession.title}（编辑）`
  });

  try {
    const prepared = await options.api.prepareEdit(
      branch.thread_id,
      target.userMessage.id,
      replacementText
    );
    return {
      target,
      branch,
      prepared: { ...prepared, input: removeHistoricalFiles(prepared.input) }
    };
  } catch (error) {
    try {
      await options.api.deleteThread(branch.thread_id);
    } catch {
      // Preserve the prepare error; cleanup is best effort.
    }
    throw error;
  }
}

export function buildEditedBranchSession(
  source: ChatSession,
  userIndex: number,
  threadId: string,
  replacementHumanMessageId: string,
  replacementText: string,
  model: string
): ChatSession {
  const session = bindThreadId(createSession(`${source.title}（编辑）`), threadId);
  return {
    ...setSessionMessages(session, [
      ...source.messages.slice(0, userIndex),
      {
        id: replacementHumanMessageId,
        role: "user",
        createdAt: new Date().toISOString(),
        content: replacementText,
        model
      }
    ]),
    activeSkills: [...source.activeSkills]
  };
}

export function selectEditModel(
  message: Pick<ChatMessage, "model"> | undefined,
  availableModelNames: string[],
  fallbackModelName: string
): string {
  return message?.model && availableModelNames.includes(message.model)
    ? message.model
    : fallbackModelName;
}
