import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "yaml";
import { buildApp } from "../src/app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");
const apiOpenApiDir = path.resolve(rootDir, "api/openapi");

async function generateOpenApi() {
  console.log("Generating OpenAPI specification from Fastify application...");
  const app = await buildApp();
  await app.ready();

  const openApiSpec = app.swagger();

  await fs.mkdir(apiOpenApiDir, { recursive: true });

  const jsonPath = path.join(apiOpenApiDir, "openapi.json");
  const jsonContent = JSON.stringify(openApiSpec, null, 2);
  await fs.writeFile(jsonPath, jsonContent, "utf8");
  console.log(`[SUCCESS] Wrote ${jsonPath} (${Buffer.byteLength(jsonContent)} bytes)`);

  const yamlPath = path.join(apiOpenApiDir, "openapi.yaml");
  const yamlContent = yaml.stringify(openApiSpec, { indent: 2 });
  await fs.writeFile(yamlPath, `# Generated CHOVIA OpenAPI 3.1.0 Specification\n${yamlContent}`, "utf8");
  console.log(`[SUCCESS] Wrote ${yamlPath} (${Buffer.byteLength(yamlContent)} bytes)`);

  await app.close();
}

generateOpenApi().catch((err) => {
  console.error("OpenAPI generation failed:", err);
  process.exit(1);
});
