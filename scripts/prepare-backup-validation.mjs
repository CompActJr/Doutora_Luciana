import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
const credential = [{ id: randomUUID(), name: "Validation only", type: "httpHeaderAuth", data: { name: "X-Validation", value: randomBytes(16).toString("hex") } }];
await writeFile("backups/validation/credential.json", JSON.stringify(credential), { mode: 0o600 });
await writeFile("backups/validation/backup.env", 'PROJECT_DIR=/workspace\nCOMPOSE_ENV_FILE=.env.validation\nBACKUP_COMPOSE_FILES="compose.yaml compose.prod.yaml compose.validation.yaml"\nCOMPOSE_PROJECT_NAME=dra-validation\nRESTIC_REPOSITORY=/restic-repo\nRESTIC_PASSWORD_FILE=/workspace/backups/validation/restic-password\n');
await writeFile("backups/validation/wrong-password", randomBytes(32).toString("hex"), { mode: 0o600 });
console.log("Fixture fictícia e configuração de backup isolado preparadas.");
