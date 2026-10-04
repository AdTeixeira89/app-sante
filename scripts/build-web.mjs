// Copia os ficheiros da app web para a pasta "www", que o Capacitor empacota dentro da app Android.
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";

const files = ["index.html", "style.css", "app.js", "i18n.js", "native.js", "manifest.json", "sw.js", "icon-192.png", "icon-512.png"];
rmSync("www", { recursive: true, force: true });
mkdirSync("www", { recursive: true });
for (const f of files) {
  if (!existsSync(f)) throw new Error("Ficheiro em falta: " + f);
  cpSync(f, "www/" + f);
}
console.log("www/ pronto (" + files.length + " ficheiros)");
