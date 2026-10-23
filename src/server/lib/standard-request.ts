export function toStandardRequest(request: Request): Request {
  const { method } = request;
  // NextRequest を Hono の bodyLimit が再構築できるよう、標準の Request にする。
  return new Request(request.url, {
    method,
    headers: request.headers,
    signal: request.signal,
    ...(method === "GET" || method === "HEAD" ? {} : { body: request.body, ...(request.body ? { duplex: "half" as const } : {}) }),
  });
}
