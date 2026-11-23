import { z } from "zod";
import type { Environment } from "../../config/env.js";
import { AccessError } from "../users/service.js";

export type AiInput = { instructions: string; input: string; variations?: boolean };
export type AiProvider = { model: string; generate: (input: AiInput) => Promise<string> };
export function createAiProvider(env: Environment, transport: typeof fetch = fetch): AiProvider | undefined {
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) return undefined;
  return { model: env.OPENAI_MODEL, async generate(input) {
    try {
      const response = await transport("https://api.openai.com/v1/responses", {
        method: "POST", signal: AbortSignal.timeout(35_000), redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: env.OPENAI_MODEL, store: false, instructions: input.instructions, input: input.input,
          max_output_tokens: 1800, tools: [],
          ...(input.variations ? { text: { format: { type: "json_schema", name: "variations", strict: true, schema: {
            type: "object", properties: { suggestions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 } }, required: ["suggestions"], additionalProperties: false,
          } } } } : {}),
        }),
      });
      if (response.status === 429) throw new AccessError(429, "O serviço de IA atingiu o limite. Aguarde e tente novamente.");
      if (!response.ok) throw new Error("provider");
      const body: unknown = await response.json();
      const parsed = z.object({ status: z.literal("completed"), output: z.array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() })) }).parse(body);
      const text = parsed.output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n").trim();
      if (!text || text.length > 20_000) throw new Error("output");
      return text;
    } catch (error) {
      if (error instanceof AccessError) throw error;
      // Nunca propagar erros HTTP, respostas ou headers que possam conter dados/segredos.
      throw new AccessError(503, "Não foi possível obter uma resposta da IA. A conversa foi preservada; tente novamente.");
    }
  } };
}
