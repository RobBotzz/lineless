import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { render } from "@react-email/components";
import { ResetPasswordEmail } from "./templates/ResetPasswordEmail";

// Local-only dev helper: renders email templates to standalone HTML files you
// can open in a browser — no preview server, no extra dependencies. Uses each
// template's `PreviewProps` for sample data. Add more templates to the array.
async function main(): Promise<void> {
  const targets = [
    {
      name: "ResetPasswordEmail",
      element: ResetPasswordEmail(
        ResetPasswordEmail.PreviewProps ?? {
          resetUrl: "https://example.com/reset-password?token=preview",
        }
      ),
    },
  ];

  const outDir = path.resolve(process.cwd(), ".email-preview");
  mkdirSync(outDir, { recursive: true });

  for (const { name, element } of targets) {
    const html = await render(element);
    const outPath = path.join(outDir, `${name}.html`);
    writeFileSync(outPath, html);
    console.log(`Rendered ${name} → ${outPath}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
