/** Consistent JSON error responses for route handlers. */

/**
 * Maps common DB / validation errors to 4xx; everything else 500.
 * Use in `catch (err) { serverError(res, err); }`.
 */
export function serverError(res, err) {
  const { status, message } = mapError(err);
  return res.status(status).json({ error: message });
}

function mapError(err) {
  if (!err || typeof err !== "object") {
    return { status: 500, message: "Server error" };
  }

  const name = err.name;
  const code = err.code;

  if (name === "ValidationError" && err.errors) {
    const parts = Object.values(err.errors).map((e) => e.message);
    return {
      status: 400,
      message: parts.filter(Boolean).join("; ") || err.message || "Validation failed",
    };
  }

  if (name === "CastError") {
    return { status: 400, message: "Invalid id or value" };
  }

  if (code === 11000 || code === "11000") {
    return { status: 409, message: duplicateKeyMessage(err) };
  }

  return { status: 500, message: err.message || "Server error" };
}

function duplicateKeyMessage(err) {
  const key = err.keyValue && Object.keys(err.keyValue)[0];
  if (key) {
    return `${key} already exists`;
  }
  return "Duplicate entry";
}
