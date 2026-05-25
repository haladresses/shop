import { NextResponse } from "next/server";

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
  const message = e instanceof Error ? e.message : "Internal server error";
  console.error("[API Error]", e);
  return error(message, 500);
}
