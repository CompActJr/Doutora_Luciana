export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options, credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Tente novamente.");
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Revise os dados informados e tente novamente.",
      401: "Sua sessão expirou. Entre novamente.",
      403: "Você não tem permissão para esta operação.",
      409: "Esse e-mail já existe ou a alteração de acesso não é permitida.",
      429: "Muitas tentativas. Aguarde um minuto e tente novamente.",
      503: "Serviço indisponível. Tente novamente mais tarde ou contate a administradora.",
    };
    throw new Error(messages[response.status] ?? "Não foi possível concluir. Tente novamente.");
  }
  return response.json() as Promise<T>;
}
