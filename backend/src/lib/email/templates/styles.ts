import type { CSSProperties } from "react";

// Shared visual language for all Lineless transactional emails, so every
// template stays consistent. Template-specific bits live in their own files.
export const ACCENT = "#020887";

export const body: CSSProperties = {
  backgroundColor: "#eef2f7",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 12px",
};

export const container: CSSProperties = {
  margin: "0 auto",
  maxWidth: "480px",
  width: "100%",
};

export const header: CSSProperties = {
  padding: "4px 4px 20px",
  textAlign: "center",
};

export const brand: CSSProperties = {
  color: ACCENT,
  fontSize: "22px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: 0,
};

export const card: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "32px",
};

export const heading: CSSProperties = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 18px",
};

export const paragraph: CSSProperties = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 14px",
};

// Muted secondary note (e.g. the "open in the same browser" hint).
export const hint: CSSProperties = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0",
};

export const buttonWrap: CSSProperties = {
  margin: "26px 0 18px",
  textAlign: "center",
};

export const button: CSSProperties = {
  backgroundColor: ACCENT,
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "13px 28px",
  textDecoration: "none",
};

export const hr: CSSProperties = {
  border: "none",
  borderTop: "1px solid #e2e8f0",
  margin: "24px 0",
};

export const footer: CSSProperties = {
  padding: "20px 16px 4px",
  textAlign: "center",
};

export const footerText: CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 8px",
};

export const footerBrand: CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 600,
  margin: 0,
};
