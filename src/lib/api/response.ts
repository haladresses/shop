import { NextResponse } from "next/server";

function getPublicErrorMessage(e: unknown) {
  if (!(e instanceof Error)) return "Internal server error";

  const message = e.message.toLowerCase();

  if (
    message.includes("authentication failed against database server") ||
    message.includes("can't reach database server") ||
    message.includes("provided database credentials")
  ) {
    return "Service temporarily unavailable. Please try again later.";
  }

  return "Internal server error";
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function paginated<T>(
  data: T[],
  meta: { page: number; pageSize: number; total: number }
) {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.pageSize),
    },
  });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function unauthorized() {
  return error("Unauthorized", 401);
}

export function forbidden() {
  return error("Forbidden", 403);
}

export function notFound(entity = "Resource") {
  return error(`${entity} not found`, 404);
}

export function serverError(e: unknown) {
  console.error("[API Error]", e);
  return error(getPublicErrorMessage(e), 500);
}
