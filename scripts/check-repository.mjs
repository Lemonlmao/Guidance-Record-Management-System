import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const forbidden=/(^|\/)(data[^/]*|backups|node_modules)\/|\.(db|db-[^/]+|key|pem|p12|jks|jar|class|zip)$|(^|\/)\.env(?:\.|$)|backup[^/]*\.sql$/i;
const skip=new Set(['.git','build','target','dist','node_modules']);
async function walk(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){if(skip.has(entry.name)||(entry.isDirectory()&&/^(data.*|backups)$/i.test(entry.name)))continue;const full=join(directory,entry.name);if(entry.isDirectory())result.push(...await walk(full));else result.push(relative(root,full).replaceAll('\\','/'));}return result;}
let files;
try{files=execFileSync('git',['ls-files','--cached'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/).filter(Boolean);}catch{}
if(!files?.length)files=await walk(root);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bghp_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{40,}\b/,/\bAKIA[A-Z0-9]{16}\b/];
const failures=[];
for(const file of files){if(forbidden.test(file)&&file!=='.env.example'){failures.push(file+': private or generated file');continue;}if(/\.(png|jpg|jpeg|gif|ico|webp)$/i.test(file))continue;const text=await readFile(join(root,file),'utf8');if(patterns.some(pattern=>pattern.test(text)))failures.push(file+': possible credential');}
const required=['README.md','LICENSE','SECURITY.md','CONTRIBUTING.md','CHANGELOG.md','dependencies.lock.json','bootstrap.ps1','build.ps1','test.ps1','pom.xml','src/main/java/guidance/Main.java','src/main/java/guidance/Database.java','src/main/resources/sql/schema.sql','.github/workflows/ci.yml','.github/workflows/codeql.yml','.github/dependabot.yml','docs/LINKEDIN.md','docs/GITHUB-UPLOAD.md'];
for(const file of required)if(!files.includes(file))failures.push(file+': missing required source file');
if(failures.length)throw new Error('Repository checks failed:\n'+failures.join('\n'));
console.log(`PASS: ${files.length} source files checked; no runtime databases, keys, JARs, exports, or recognizable access tokens included.`);
