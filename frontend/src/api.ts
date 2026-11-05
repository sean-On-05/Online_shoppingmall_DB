const API_BASE = "/api";

export async function api<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new Error(`서버에 연결할 수 없습니다. (${method} ${url})`);
  }

  const text = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`서버가 JSON 대신 다른 응답을 반환했습니다. (${method} ${url}, HTTP ${response.status})`);
  }
  if (!response.ok) {
    const message = result && typeof result === "object" && "message" in result
      ? String(result.message)
      : `서버 요청에 실패했습니다. (${method} ${url}, HTTP ${response.status})`;
    throw new Error(message);
  }
  return result as T;
}
