import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import axios from 'axios';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

const RAW_DIR = path.join(__dirname, 'evidence', 'raw');
const PROCESSED_DIR = path.join(__dirname, 'evidence', 'processed');
const METADATA_DIR = path.join(__dirname, 'metadata');

const SOURCES_FILE = path.join(METADATA_DIR, 'sources.json');
const GOVERNANCE_FILE = path.join(METADATA_DIR, 'governance.json');
const ARGUMENTS_FILE = path.join(METADATA_DIR, 'arguments.json');
const IDENTITIES_FILE = path.join(METADATA_DIR, 'identities.json');
const INTELLIGENCE_FILE = path.join(METADATA_DIR, 'intelligence.json');

const REPORTS_DIR = path.join(METADATA_DIR, 'reports');

// Ensure directories and files exist
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
if (!fs.existsSync(ARGUMENTS_FILE)) fs.writeFileSync(ARGUMENTS_FILE, '[]');

// Setup file upload
const storage = multer.diskStorage({
    destination: RAW_DIR,
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use(bodyParser.json());

let syncStatus = {}; // Map of sourceId -> status
let indexingInProgress = false; // System lock for stability

const getSources = () => {
    try {
        if (fs.existsSync(SOURCES_FILE)) {
            return JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8') || '[]');
        }
    } catch (e) { console.error("Source load failed:", e); }
    return [];
};

const METADATA_FILE = path.join(METADATA_DIR, 'index.json');
const OLLAMA_URL = "http://localhost:11434/api/generate";

// GET Index
app.get('/api/index', (req, res) => {
    if (fs.existsSync(METADATA_FILE)) {
        res.json(JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8')));
    } else {
        res.status(404).send("Index not found");
    }
});

// GET Models
app.get('/api/models', async (req, res) => {
    try {
        const response = await axios.get("http://localhost:11434/api/tags", { timeout: 2000 });
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ error: "Ollama not reachable" });
    }
});

// GET Content
app.get('/api/content', (req, res) => {
    const filePath = req.query.path;
    const fullPath = path.join(PROCESSED_DIR, filePath);

    if (fs.existsSync(fullPath)) {
        res.send(fs.readFileSync(fullPath, 'utf8'));
    } else {
        res.status(404).send("File not found");
    }
});

// GET Device Detection
app.get('/api/device/detect', (req, res) => {
    exec('adb devices', (error, stdout, stderr) => {
        const lines = stdout.trim().split('\n');
        const devices = lines.slice(1).filter(l => l.includes('\tdevice'));
        if (devices.length > 0) {
            res.json({ connected: true, id: devices[0].split('\t')[0] });
        } else {
            res.json({ connected: false });
        }
    });
});

// GOVERNANCE
app.get('/api/governance', (req, res) => {
    fs.readFile(GOVERNANCE_FILE, 'utf8', (err, data) => {
        if (err) return res.json({ entities: [], keywords: [] });
        res.json(JSON.parse(data));
    });
});

app.post('/api/governance', (req, res) => {
    fs.writeFile(GOVERNANCE_FILE, JSON.stringify(req.body, null, 2), (err) => {
        if (err) return res.status(500).send("Governance save failed");
        res.send({ status: "Governance updated" });
    });
});

// GET ARGUMENTS
app.get('/api/arguments', (req, res) => {
    fs.readFile(ARGUMENTS_FILE, 'utf8', (err, data) => {
        if (err || !data) return res.send([]);
        res.send(JSON.parse(data));
    });
});

// CREATE/UPDATE ARGUMENT
app.post('/api/arguments', (req, res) => {
    const newArg = req.body; // { id, title, summary, evidenceIds }
    fs.readFile(ARGUMENTS_FILE, 'utf8', (err, data) => {
        let args = err ? [] : JSON.parse(data || '[]');
        const idx = args.findIndex(a => a.id === newArg.id);

        if (idx !== -1) {
            args[idx] = { ...args[idx], ...newArg };
        } else {
            args.push({ ...newArg, id: newArg.id || `arg_${Date.now()}`, evidenceIds: newArg.evidenceIds || [] });
        }

        fs.writeFile(ARGUMENTS_FILE, JSON.stringify(args, null, 2), () => {
            res.send({ status: "Argument saved", argument: newArg });
        });
    });
});

// DELETE ARGUMENT
app.delete('/api/arguments/:id', (req, res) => {
    const { id } = req.params;
    fs.readFile(ARGUMENTS_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Error reading arguments");
        let args = JSON.parse(data);
        args = args.filter(a => a.id !== id);
        fs.writeFile(ARGUMENTS_FILE, JSON.stringify(args, null, 2), () => {
            res.send({ status: "Argument deleted" });
        });
    });
});

// GENERATE LEGAL MEMO (AI)
app.post('/api/arguments/:id/memo', async (req, res) => {
    const { id } = req.params;
    const { model } = req.body;

    try {
        const argsData = JSON.parse(fs.readFileSync(ARGUMENTS_FILE, 'utf8'));
        const arg = argsData.find(a => a.id === id);
        if (!arg) return res.status(404).send("Argument not found");

        const indexData = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        const evidenceDetails = indexData.filter(item => arg.evidenceIds.includes(item.id));

        // Construct prompt with evidence context
        let context = evidenceDetails.map(e => `[${e.type}] ${e.title} (${e.timestamp}): Source: ${e.source}`).join('\n');
        const prompt = `You are a senior paralegal assisting Chris Hallberg in a complex divorce discovery process.
Generate a concise, professional Legal Memo for the following strategic argument:

Title: ${arg.title}
Summary: ${arg.summary}

Evidence Found:
${context}

Goals:
1. Synthesize the evidence into a logical narrative.
2. Identify potential legal risks or leverage points.
3. Keep it strictly professional for use in court filings or lawyer briefs.

Response format: Markdown.`;

        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model || 'llama3', prompt, stream: false })
        });

        const data = await ollamaRes.json();
        const memo = data.response;

        // Save memo back to argument
        arg.legalMemo = memo;
        fs.writeFileSync(ARGUMENTS_FILE, JSON.stringify(argsData, null, 2));

        res.send({ status: "Memo generated", memo });
    } catch (e) {
        console.error(e);
        res.status(500).send({ error: "Failed to generate memo", details: e.message });
    }
});

// PROMOTE TO VAULT
app.post('/api/index/promote', (req, res) => {
    const { id, path: filePath, status } = req.body; // status: 'vault' or 'discovery'
    const fullPath = path.join(PROCESSED_DIR, filePath);

    fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Read failed");

        // Update frontmatter status
        const updatedContent = data.replace(/status: .*/, `status: ${status}`);
        fs.writeFile(fullPath, updatedContent, (err) => {
            if (err) return res.status(500).send("Write failed");

            // Re-run index generator
            exec('python3 scripts/index_generator.py', (err) => {
                res.send({ status: "Item updated" });
            });
        });
    });
});

// OLLAMA RESTART
app.post('/api/ollama/restart', (req, res) => {
    console.log("Attempting to restart Ollama...");
    // Linux command to restart ollama service or launch it
    exec('systemctl restart ollama || ollama serve', (err, stdout, stderr) => {
        if (err) console.error("Ollama restart failed:", stderr);
        res.send({ status: "Restart triggered" });
    });
});

// GET SOURCES
app.get('/api/sources', (req, res) => {
    fs.readFile(SOURCES_FILE, 'utf8', (err, data) => {
        if (err) return res.send([]);
        res.json(JSON.parse(data));
    });
});

// GET Pipeline Status
app.get('/api/pipeline/status', (req, res) => {
    const sourceId = req.query.id;
    res.json(syncStatus[sourceId] || { active: false, step: '', progress: 0, message: 'Ready' });
});

// DYNAMIC MEDIA SERVING (Guardrail against app.use leaks)
app.get(/^\/media\/([^/]+)\/(.*)/, (req, res) => {
    const sourceId = req.params[0];
    const assetPath = req.params[1];

    const sources = getSources();
    const source = sources.find(s => s.id === sourceId);
    const sourcePath = source?.path || source?.localPath;

    if (!sourcePath) return res.status(404).send("Source not mapped");

    const fullPath = path.join(sourcePath, assetPath);

    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
        res.sendFile(fullPath);
    } else {
        res.status(404).send("Asset not found");
    }
});

// POST Pipeline Sync
app.post('/api/pipeline/sync', (req, res) => {
    try {
        const { sourceId } = req.body;
        if (!sourceId) return res.status(400).send("Missing sourceId");

        // Reload sources from disk to ensure we have the latest
        const sources = getSources();
        const source = sources.find(s => s.id === sourceId);
        if (!source) return res.status(404).send("Source not found");
        if (syncStatus[sourceId]?.active || indexingInProgress) {
            return res.status(409).send("A sync or index task is already in progress. Please wait.");
        }

        indexingInProgress = true;
        syncStatus[sourceId] = { active: true, step: 'Harvesting', progress: 10, message: `Starting sync for ${source.name}...` };

        const processedDir = path.join(__dirname, 'evidence', 'processed');
        const rawDir = path.join(__dirname, 'evidence', 'raw');

        // If it's a local folder, we skip harvest and go straight to index
        if (source.type === 'folder' || (source.localPath && !source.deviceId && !source.imap)) {
            syncStatus[sourceId] = { active: true, step: 'Indexing', progress: 50, message: 'Indexing local folder...' };

            exec(`python3 scripts/index_generator.py "${source.localPath}" "${source.id}"`, (err, stdout, stderr) => {
                indexingInProgress = false;
                if (err) {
                    console.error("Indexing failed:", stderr);
                    syncStatus[sourceId] = { active: false, step: 'Error', progress: 0, message: 'Indexing failed' };
                    return;
                }
                syncStatus[sourceId] = { active: false, step: 'Complete', progress: 100, message: 'Vault updated' };
            });
            return res.send({ status: "Sync started" });
        }

        // Existing harvesting logic for devices/email
        let harvestCmd = 'echo "Simulating harvest..."';
        if (sourceId === 'pixel8') {
            harvestCmd = `python3 scripts/harvest.py "${rawDir}"`;
        }

        exec(harvestCmd, (err, stdout, stderr) => {
            syncStatus[sourceId] = { active: true, step: 'Parsing', progress: 40, message: 'Parsing source data...' };

            let parseCmd;
            if (source.type === 'device' || sourceId.includes('sms')) {
                parseCmd = `python3 scripts/sms_parser.py "${rawDir}/test_sms.xml" "${processedDir}/sms" "${sourceId}"`;
            } else {
                parseCmd = `python3 scripts/mbox_parser.py "${rawDir}/takeout.mbox" "${processedDir}/emails" "${sourceId}"`;
            }

            exec(parseCmd, (err, stdout, stderr) => {
                syncStatus[sourceId] = { active: true, step: 'Indexing', progress: 80, message: 'Updating master index...' };

                const indexPath = source.localPath || PROCESSED_DIR;
                const sourceName = source.id;

                exec(`python3 scripts/index_generator.py "${indexPath}" "${sourceName}"`, (err, stdout, stderr) => {
                    indexingInProgress = false;
                    syncStatus[sourceId] = { active: false, step: 'Complete', progress: 100, message: 'Vault updated' };
                });
            });
        });

        res.send({ status: "Sync started" });
    } catch (err) {
        indexingInProgress = false;
        console.error("Sync internal error:", err);
        res.status(500).send(err.message);
    }
});

// POST Chat (Ollama Proxy)
app.post('/api/chat', async (req, res) => {
    const { prompt, model } = req.body;
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: model || "llama3",
            prompt: prompt,
            stream: false
        }, { timeout: 30000 });
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ error: "Ollama failed." });
    }
});

// POST Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
    console.log("File uploaded:", req.file.path);
    exec('python3 scripts/index_generator.py', (error, stdout, stderr) => {
        res.send({ status: "ok", message: "File uploaded and indexed" });
    });
});

// GET SCAN DEVICES
app.get('/api/devices/scan', (req, res) => {
    exec('adb devices -l', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        const lines = stdout.split('\n');
        const devices = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const parts = line.split(/\s+/);
                const id = parts[0];
                const modelMatch = line.match(/model:(.*?)\s/);
                devices.push({
                    id,
                    model: modelMatch ? modelMatch[1] : 'Unknown Device',
                    raw: line
                });
            }
        }
        res.json(devices);
    });
});

// POST ADD SOURCE
app.post('/api/sources', (req, res) => {
    const newSource = req.body;
    fs.readFile(SOURCES_FILE, 'utf8', (err, data) => {
        const sources = JSON.parse(data || '[]');
        sources.push(newSource);
        fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 4), err => {
            if (err) return res.status(500).send(err);

            // If it's a local folder, trigger an immediate index
            if (newSource.type === 'folder' && newSource.localPath) {
                if (indexingInProgress) {
                    return res.json({ ...newSource, message: "Added, but index queued (system busy)" });
                }
                indexingInProgress = true;
                console.log("Importing local folder:", newSource.localPath);
                exec(`python3 scripts/index_generator.py "${newSource.localPath}" "${newSource.id}"`, (err) => {
                    indexingInProgress = false;
                    res.json(newSource);
                });
            } else {
                res.json(newSource);
            }
        });
    });
});

// POST GENERATE REPORT
app.post('/api/reports/generate', async (req, res) => {
    const { title, items, detailLevel, argumentId, model } = req.body;
    const reportId = `report_${Date.now()}`;
    const reportPath = path.join(REPORTS_DIR, `${reportId}.md`);

    let content = `# Legal Evidence Report: ${title}\n`;
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `Analysis Level: ${detailLevel.toUpperCase()}\n`;
    content += `Total Evidence Nodes: ${items.length}\n`;
    content += `--- \n\n`;

    // 1. Strategic Synthesis (AI)
    if (detailLevel === 'comprehensive' || argumentId) {
        try {
            content += `## Executive Synthesis (AI-Generated)\n\n`;
            const synthesisPrompt = `You are a legal analyst. Synthesize the following ${items.length} pieces of evidence into a high-level briefing. 
            Identify patterns of behavior, frequency of conflict, and core strategic leverage points.
            
            Evidence Summary:
            ${items.map(i => `[${i.type}] ${i.title} (${i.timestamp})`).join('\n')}
            
            Format the response as a professional markdown briefing.`;

            const ollamaRes = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model || 'llama3', prompt: synthesisPrompt, stream: false })
            });
            const data = await ollamaRes.json();
            content += data.response + "\n\n---\n\n";
        } catch (e) {
            content += `> Warning: AI Synthesis unavailable. Proceeding with raw log.\n\n`;
        }
    }

    // 2. Evidence Log
    content += `## Detailed Evidence Logs\n\n`;
    items.forEach((item, idx) => {
        content += `### [${idx + 1}] ${item.title}\n`;
        content += `- **Archived**: ${item.timestamp}\n`;
        content += `- **Persona**: ${item.identity || 'Unknown'}\n`;
        content += `- **Source ID**: ${item.source}\n`;

        if (detailLevel === 'comprehensive') {
            const fullPath = path.join(PROCESSED_DIR, item.path);
            if (fs.existsSync(fullPath)) {
                try {
                    const raw = fs.readFileSync(fullPath, 'utf8').split('---')[2]?.trim();
                    content += `\n**Archive Entry**:\n> ${raw?.substring(0, 1000)}...\n`;
                } catch (e) { }
            }
        }

        const absoluteAssetPath = path.resolve(path.join(item.localPath || '', item.path));
        content += `- **Link**: [Archive File](file://${absoluteAssetPath})\n`;
        content += `\n`;
    });

    content += `\n\n**End of Report**\n`;

    fs.writeFileSync(reportPath, content);
    res.json({ id: reportId, path: reportPath, title, timestamp: new Date().toISOString() });
});

// GET REPORTS
app.get('/api/reports', (req, res) => {
    fs.readdir(REPORTS_DIR, (err, files) => {
        if (err) return res.send([]);
        const reports = files.filter(f => f.endsWith('.md')).map(f => ({
            id: f.replace('.md', ''),
            title: f.replace('.md', '').split('_').slice(1).join(' '),
            path: path.join(REPORTS_DIR, f),
            timestamp: fs.statSync(path.join(REPORTS_DIR, f)).mtime
        }));
        res.send(reports.sort((a, b) => b.timestamp - a.timestamp));
    });
});

// VIEW REPORT
app.get('/api/reports/view/:id', (req, res) => {
    const filePath = path.join(REPORTS_DIR, `${req.params.id}.md`);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        res.send({ content });
    } else {
        res.status(404).send("Report not found");
    }
});



// POST TEST EMAIL
app.post('/api/email/test', (req, res) => {
    // Mock connection for now - in production this would use imaplib
    const { host, user } = req.body;
    if (host && user) {
        setTimeout(() => res.json({ success: true, message: `Connected to ${host} as ${user}` }), 1500);
    } else {
        res.status(400).json({ success: false, message: "Missing host or user" });
    }
});

// PUT UPDATE SOURCE (monitoring rules, etc)
app.put('/api/sources/:id', (req, res) => {
    const { id } = req.params;
    const updatedSource = req.body;
    fs.readFile(SOURCES_FILE, 'utf8', (err, data) => {
        let sources = JSON.parse(data || '[]');
        sources = sources.map(s => s.id === id ? { ...s, ...updatedSource } : s);
        fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 4), err => {
            if (err) return res.status(500).send(err);
            res.json(updatedSource);
        });
    });
});

// DELETE SOURCE
app.delete('/api/sources/:id', (req, res) => {
    const { id } = req.params;
    fs.readFile(SOURCES_FILE, 'utf8', (err, data) => {
        let sources = JSON.parse(data || '[]');
        sources = sources.filter(s => s.id !== id);
        fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 4), err => {
            if (err) return res.status(500).send(err);
            res.json({ success: true });
        });
    });
});

// GET SMS Threads
app.get('/api/sms/threads', (req, res) => {
    const smsDir = path.join(PROCESSED_DIR, 'sms');
    if (!fs.existsSync(smsDir)) return res.json({});
    const files = fs.readdirSync(smsDir).filter(f => f.endsWith('.md'));
    const threads = {};

    files.forEach(file => {
        const content = fs.readFileSync(path.join(smsDir, file), 'utf8');
        const match = content.match(/source:\s*(.*?)[\r\n]/i);
        const sender = match ? match[1].trim() : 'Unknown';
        if (!threads[sender]) threads[sender] = [];
        threads[sender].push({
            file: `sms/${file}`,
            timestamp: content.match(/timestamp:\s*(.*?)[\r\n]/i)?.[1]?.trim() || '',
            preview: content.split('---')[2]?.trim().substring(0, 50) + '...'
        });
    });
    res.json(threads);
});

// GET Email Inbox
app.get('/api/email/inbox', (req, res) => {
    const emailDir = path.join(PROCESSED_DIR, 'emails');
    if (!fs.existsSync(emailDir)) return res.json([]);
    const files = fs.readdirSync(emailDir).filter(f => f.endsWith('.md'));
    const emails = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(emailDir, file), 'utf8');
        emails.push({
            file: `emails/${file}`,
            subject: content.match(/subject:\s*(.*?)[\r\n]/i)?.[1]?.trim() || 'No Subject',
            date: content.match(/timestamp:\s*(.*?)[\r\n]/i)?.[1]?.trim() || '',
            sender: content.match(/sender:\s*(.*?)[\r\n]/i)?.[1]?.trim() || 'Unknown'
        });
    });
    res.json(emails.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// GET GOVERNANCE
app.get('/api/governance', (req, res) => {
    if (!fs.existsSync(GOVERNANCE_FILE)) return res.json({ entities: [], keywords: [] });
    res.json(JSON.parse(fs.readFileSync(GOVERNANCE_FILE, 'utf8')));
});

// UPDATE GOVERNANCE
app.post('/api/governance', (req, res) => {
    fs.writeFileSync(GOVERNANCE_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

// === Identity Management ===
app.get('/api/identities', (req, res) => {
    if (!fs.existsSync(IDENTITIES_FILE)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(IDENTITIES_FILE, 'utf8')));
});

app.post('/api/identities', (req, res) => {
    const identities = req.body; // Expects whole array
    fs.writeFileSync(IDENTITIES_FILE, JSON.stringify(identities, null, 2));
    res.json({ success: true });
});

// === Strategic Arguments ===
app.get('/api/arguments', (req, res) => {
    if (!fs.existsSync(ARGUMENTS_FILE)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(ARGUMENTS_FILE, 'utf8')));
});

app.post('/api/arguments', (req, res) => {
    const argumentsData = req.body; // Expects whole array
    fs.writeFileSync(ARGUMENTS_FILE, JSON.stringify(argumentsData, null, 2));
    res.json({ success: true });
});

app.post('/api/arguments/analyze', async (req, res) => {
    const { argumentId, items, model } = req.body;

    const analysisPrompt = `You are a legal strategist. Analyze the following bundle of ${items.length} evidence items. 
    Synthesize them into a cohesive strategic argument. Identify the core leverage point, potential counter-arguments, and recommended next steps for legal counsel.
    
    Evidence Bundle:
    ${items.map(i => `[${i.type}] ${i.title} (${i.timestamp}): ${i.summary || 'No summary available'}`).join('\n')}
    
    Format as a professional legal strategy memo.`;

    try {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model || 'llama3', prompt: analysisPrompt, stream: false })
        });
        const data = await ollamaRes.json();

        // Save back to arguments file
        const argsData = JSON.parse(fs.readFileSync(ARGUMENTS_FILE, 'utf8'));
        const argIdx = argsData.findIndex(a => a.id === argumentId);
        if (argIdx !== -1) {
            argsData[argIdx].legalMemo = data.response;
            fs.writeFileSync(ARGUMENTS_FILE, JSON.stringify(argsData, null, 2));
        }

        res.json({ memo: data.response });
    } catch (e) {
        res.status(500).json({ error: "AI Synthesis failed" });
    }
});

// === Intelligence & Analysis ===
app.get('/api/intelligence', (req, res) => {
    if (!fs.existsSync(INTELLIGENCE_FILE)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(INTELLIGENCE_FILE, 'utf8')));
});

app.post('/api/intelligence/analyze', async (req, res) => {
    const { itemId, path: itemPath, model } = req.body;
    const fullPath = path.join(PROCESSED_DIR, itemPath);

    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Item not found" });

    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const prompt = `Analyze this piece of legal evidence. 
        Extract:
        1. A concise 1-sentence summary of the core interaction.
        2. Factual events (dates/actions) mentioned.
        3. A conflict/sentiment score from 1-10 (10 being high conflict).
        4. Any mentioned names/entities not already known.
        
        Return ONLY a JSON object with: { "summary": "...", "events": ["..."], "score": 5, "entities": ["..."] }
        
        Content:
        ${content.substring(0, 4000)}`;

        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({ model: model || 'llama3', prompt, stream: false })
        });
        const data = await ollamaRes.json();
        const analysis = JSON.parse(data.response.match(/\{.*\}/s)[0]);

        // Merge into intelligence.json
        const intelligence = fs.existsSync(INTELLIGENCE_FILE) ? JSON.parse(fs.readFileSync(INTELLIGENCE_FILE, 'utf8')) : {};
        intelligence[itemId] = { ...analysis, timestamp: new Date().toISOString() };
        fs.writeFileSync(INTELLIGENCE_FILE, JSON.stringify(intelligence, null, 2));

        res.json(analysis);
    } catch (e) {
        console.error("Intelligence failed:", e);
        res.status(500).json({ error: "AI analysis failed" });
    }
});

// Analytics & Relationship Mapping
app.get('/api/analytics', (req, res) => {
    try {
        if (!fs.existsSync(METADATA_FILE)) return res.json({ interactions: {}, heatmap: [] });

        const index = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        const intelligence = fs.existsSync(INTELLIGENCE_FILE) ? JSON.parse(fs.readFileSync(INTELLIGENCE_FILE, 'utf8')) : {};
        const identities = fs.existsSync(IDENTITIES_FILE) ? JSON.parse(fs.readFileSync(IDENTITIES_FILE, 'utf8')) : [];

        // 1. Interaction Analysis (Sender frequency)
        const interactionMatrix = {};
        identities.forEach(id => {
            interactionMatrix[id.name] = 0;
        });

        index.forEach(item => {
            if (item.identity && interactionMatrix[item.identity] !== undefined) {
                interactionMatrix[item.identity]++;
            }
        });

        // 2. Conflict Velocity (Heatmap Data)
        const heatmap = Array(7).fill(0).map(() => Array(24).fill(0));
        const heatmapCounts = Array(7).fill(0).map(() => Array(24).fill(0));

        index.forEach(item => {
            const intel = intelligence[item.id];
            if (intel && intel.score !== undefined) {
                const date = new Date(item.timestamp);
                if (isNaN(date.getTime())) return;
                const day = date.getDay();
                const hour = date.getHours();
                heatmap[day][hour] += intel.score;
                heatmapCounts[day][hour]++;
            }
        });

        const normalizedHeatmap = heatmap.map((row, d) =>
            row.map((val, h) => heatmapCounts[d][h] > 0 ? val / heatmapCounts[d][h] : 0)
        );

        res.json({
            interactions: interactionMatrix,
            heatmap: normalizedHeatmap
        });
    } catch (err) {
        console.error("Analytics failure:", err);
        res.status(500).json({ error: "Failed to calculate analytics" });
    }
});


// === Phase 7: Advanced Analytics & Narrative ===
app.get('/api/analytics/velocity', (req, res) => {
    try {
        if (!fs.existsSync(METADATA_FILE)) return res.json({});
        const index = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        const velocity = {};

        index.forEach(node => {
            const date = new Date(node.timestamp);
            if (isNaN(date.getTime())) return;

            // Group by Week (YYYY-WW)
            const weekNumber = Math.ceil(date.getDate() / 7);
            const weekKey = `${date.getFullYear()}-W${weekNumber}`;

            if (!velocity[weekKey]) velocity[weekKey] = { total: 0, identities: {} };
            velocity[weekKey].total++;

            if (node.identity) {
                velocity[weekKey].identities[node.identity] = (velocity[weekKey].identities[node.identity] || 0) + 1;
            }
        });

        res.json(velocity);
    } catch (err) {
        console.error("Velocity calculation failed:", err);
        res.status(500).json({ error: "Velocity calculation failed" });
    }
});

app.post('/api/analytics/narrative', async (req, res) => {
    const { model } = req.body;
    try {
        if (!fs.existsSync(METADATA_FILE)) return res.json({ narrative: "No evidence found to synthesize." });
        const index = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));

        // Sort by timestamp
        const sorted = index
            .filter(i => i.timestamp)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .slice(0, 40); // Limit context for local LLM

        const narrativePrompt = `You are a Senior Legal Analyst. Synthesize a chronological "Executive Narrative" of the case based on these evidence nodes. 
        Identify the progression of events, key escalations, and the overall 'story' of the discovery.
        
        Evidence Sequence:
        ${sorted.map(s => `[${s.timestamp}] ${s.identity || 'Unknown'}: ${s.title}`).join('\n')}
        
        Write a professional narrative summary formatted in markdown.`;

        const response = await axios.post('http://localhost:11434/api/generate', {
            model: model || 'llama3.1:8b',
            prompt: narrativePrompt,
            stream: false
        });
        res.json({ narrative: response.data.response });
    } catch (e) {
        console.error("Narrative synthesis failed:", e.response?.data || e.message);
        res.status(500).json({ error: "Narrative synthesis failed" });
    }
});

app.get('/api/reports/history', async (req, res) => {
    try {
        const exportsDir = path.join(__dirname, 'exports');
        if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);
        const files = fs.readdirSync(exportsDir)
            .filter(f => f.endsWith('.zip'))
            .map(f => {
                const stats = fs.statSync(path.join(exportsDir, f));
                return { name: f, date: stats.mtime, size: stats.size };
            })
            .sort((a, b) => b.date - a.date);
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: "Failed to load export history" });
    }
});

app.post('/api/export/bundle/:id', async (req, res) => {
    try {
        const argId = req.params.id;
        const argumentsFile = path.join(METADATA_DIR, 'arguments.json');
        const argumentsList = JSON.parse(fs.readFileSync(argumentsFile, 'utf8'));

        const findArg = (list, id) => {
            for (const item of list) {
                if (item.id === id) return item;
                if (item["0"] && item["0"].id === id) return item["0"];
            }
            return null;
        };

        const argument = findArg(argumentsList, argId);

        if (!argument) {
            console.error(`Argument ${argId} not found in metadata`);
            return res.status(404).json({ error: "Argument not found" });
        }

        const bundleName = `Bundle_${argId}_${Date.now()}`;
        const bundleDir = path.join(__dirname, 'exports', bundleName);
        if (!fs.existsSync(bundleDir)) fs.mkdirSync(bundleDir, { recursive: true });

        // Generate Memo.md
        const memoContent = `# Legal Memo: ${argument.title}\n\n${argument.memo || 'No memo content available.'}\n\n## Evidence List\n${argument.evidenceIds.map(id => `- ${id}`).join('\n')}`;
        fs.writeFileSync(path.join(bundleDir, 'MEMO.md'), memoContent);

        // Copy Evidence Files (Mocking copy for now using symbolic links or selective copy)
        // In a real system, we'd copy the actual files from RAW_DIR/PROCESSED_DIR
        const evidenceDir = path.join(bundleDir, 'evidence');
        fs.mkdirSync(evidenceDir);

        // Finalize Bundle with ZIP
        const zipFile = `${bundleName}.zip`;
        const zipPath = path.join(__dirname, 'exports', zipFile);

        // Use native zip command
        const { exec } = await import('child_process');
        exec(`cd exports && zip -r ${zipFile} ${bundleName} && rm -rf ${bundleName}`, (err) => {
            if (err) {
                console.error("Zip failed:", err);
                return res.status(500).json({ error: "Packaging failed" });
            }
            res.json({ success: true, file: zipFile });
        });

    } catch (e) {
        console.error("Export failed:", e);
        res.status(500).json({ error: "Export failed" });
    }
});

app.get('/api/export/download/:file', (req, res) => {
    const file = req.params.file;
    const filePath = path.join(__dirname, 'exports', file);
    if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
    res.download(filePath);
});
app.listen(PORT, () => {
    console.log(`Vault Backend running on http://localhost:${PORT}`);
});

