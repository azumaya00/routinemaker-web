import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function jsonError(c: Context, status: number, message: string): Response {
  return c.json({ message }, status as ContentfulStatusCode);
}

export function validationError(c: Context, errors: Record<string, string[]>): Response {
  const messages = Object.values(errors).flat();
  const more = messages.length - 1;
  const message = `${messages[0] ?? "The given data was invalid."}${
    more > 0 ? ` (and ${more} more ${more === 1 ? "error" : "errors"})` : ""
  }`;
  return c.json({
    message,
    errors
  }, 422);
}

export type ValidationRule =
  | "required"
  | "string"
  | "email"
  | "max:255"
  | "array"
  | "in"
  | "boolean";

export function validationMessage(rule: ValidationRule, field: string): string {
  const attr = field.replaceAll("_", " ");
  switch (rule) {
    case "required": return `The ${attr} field is required.`;
    case "string": return `The ${attr} field must be a string.`;
    case "email": return `The ${attr} field must be a valid email address.`;
    case "max:255": return `The ${attr} field must not be greater than 255 characters.`;
    case "array": return `The ${attr} field must be an array.`;
    case "in": return `The selected ${attr} is invalid.`;
    case "boolean": return `The ${attr} field must be true or false.`;
  }
}
