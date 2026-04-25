const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const axios = require('axios');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

app.use(express.static(path.resolve(__dirname, 'dist')));

const RAW_DIR = path.join(__dirname, 'evidence', 'raw');
const PROCESSED_DIR = path.join(__dirname, 'evidence', 'processed');
const METADATA_DIR = path.join(__dirname, 'metadata');

const SOURCES_FILE = path.join(METADATA_DIR, 'sources.json');
const GOVERNANCE_FILE = path.join(METADATA_DIR, 'governance.json');
const ARGUMENTS_FILE = path.join(METADATA_DIR, 'arguments.json');
const IDENTITIES_FILE = path.join(METADATA_DIR, 'identities.json');
const CORRECTIONS_FILE = path.join(METADATA_DIR, 'user_corrections.json');
const INTELLIGENCE_FILE = path.join(METADATA_DIR, 'intelligence.json');
const MANIFEST_FILE = path.join(METADATA_DIR, 'manifest.sha256');
const FLIGHT_RECORDER = path.join(METADATA_DIR, 'flight_recorder.log');
const WARGAME_RESULTS = path.join(METADATA_DIR, 'wargame_results.json');
const SETTLEMENT_REPORT = path.join(METADATA_DIR, 'settlement_projections.json');
const DOCKETS_FILE = path.join(METADATA_DIR, 'dockets.json');
const LEXICON_FILE = path.join(METADATA_DIR, 'lexicon.json');

const VAULT_INDEX = path.join(METADATA_DIR, 'vault_index.json');
const ARGUMENTS_PATH = path.join(METADATA_DIR, 'arguments.json');
const EVIDENCE_FILE = path.join(METADATA_DIR, 'evidence.json');

const REPORTS_DIR = path.join(METADATA_DIR, 'reports');

// Ensure directories and files exist
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
if (!fs.existsSync(ARGUMENTS_FILE)) fs.writeFileSync(ARGUMENTS_FILE, '[]');

// --- FORTRESS SHIELD UTILITIES ---

const logToFlightRecorder = (msg, level = 'INFO') => {
    const entry = `[${new Date().toISOString()}] [SERVER] [${level}] ${msg}\n`;
    fs.appendFileSync(FLIGHT_RECORDER, entry);
};

const preWriteSpaceCheck = () => {
    try {
        const stats = fs.statfsSync(__dirname);
        const freeSpaceMB = (stats.bavail * stats.bsize) / (1024 * 1024);
        if (freeSpaceMB < 500) {
            logToFlightRecorder(`CRITICAL: Disk Space Low (${freeSpaceMB.toFixed(2)}MB). AIR-LOCK ACTIVATED.`, 'CRITICAL');
            return false;
        }
        return true;
    } catch (e) {
        logToFlightRecorder(`Space check failed: ${e.message}`, 'ERROR');
        return false;
    }
};

const atomicWrite = (filePath, data) => {
    if (!preWriteSpaceCheck()) throw new Error("INSUFFICIENT_DISK_SPACE");

    const tempPath = `${filePath}.tmp`;
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    fs.writeFileSync(tempPath, content);

    // Verify JSON integrity if applicable
    if (filePath.endsWith('.json')) {
        try { JSON.parse(fs.readFileSync(tempPath, 'utf8')); }
        catch (e) {
            logToFlightRecorder(`Atomic write aborted: JSON corruption detected in temp file ${tempPath}`, 'CRITICAL');
            throw new Error("JSON_CORRUPTION_PREVENTED");
        }
    }

    fs.renameSync(tempPath, filePath);
    logToFlightRecorder(`Atomic write success: ${path.basename(filePath)}`);
};

const verifyVaultIntegrity = () => {
    logToFlightRecorder("Initializing Vault Integrity Scan...");
    exec('python3 scripts/integrity_scan.py', (err, stdout, stderr) => {
        if (err) {
            logToFlightRecorder(`INTEGRITY FAILURE: ${stdout}`, 'CRITICAL');
            console.error("CRITICAL: INTERGRITY SCAN FAILED. CHECK FLIGHT RECORDER.");
        } else {
            logToFlightRecorder("Vault Integrity Verified: 100%");
        }
    });
};

verifyVaultIntegrity();

// --- END SHIELD UTILITIES ---

// Setup file upload
const storage = multer.diskStorage({
    destination: RAW_DIR,
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

const execHardened = (scriptPath, args, label, callback) => {
    const { spawn } = require('child_process');
    logToFlightRecorderScoped(`Executing Hardened Script: ${label} [${scriptPath}]`);

    const child = spawn('python3', [scriptPath, ...args]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
        if (code !== 0) {
            const errorMsg = `Hardened Script FAIL: ${label} (Exit ${code})\nStderr: ${stderr}`;
            logToFlightRecorderScoped(errorMsg, 'ERROR');
            callback(new Error(stderr || `Process exited with code ${code}`), stdout);
        } else {
            callback(null, stdout);
        }
    });
};

app.use(express.static(path.join(process.cwd(), 'dist')));
app.use(bodyParser.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// --- REAL-TIME BROADCAST ENGINE (SSE) ---
let clients = [];
app.get('/api/stream/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const client = { id: clientId, res };
    clients.push(client);
    console.log(`SSE Client connected: ${clientId}`);
    logToFlightRecorder(`Client connected to Command Bus [${clientId}]`);

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
        console.log(`SSE Client disconnected: ${clientId}`);
        logToFlightRecorder(`Client disconnected from Command Bus [${clientId}]`);
    });
});

const broadcast = (data) => {
    console.log("Broadcasting event:", data.type);
    clients.forEach(c => c.res.write(`data: ${JSON.stringify(data)}\n\n`));
};

app.post('/api/stream/broadcast', (req, res) => {
    broadcast(req.body);
    res.json({ success: true, receivers: clients.length });
});

// --- PHASE 77: TRIAL PRESENTATION & TEMPORAL LOCKING ---

app.post('/api/dockets/lock', (req, res) => {
    const { docket_id } = req.body;
    if (!docket_id) return res.status(400).json({ error: "No docket_id provided" });

    try {
        const dockets = JSON.parse(fs.readFileSync(DOCKETS_FILE, 'utf8'));
        const updatedDockets = dockets.map(d => {
            if (d.id === docket_id) {
                return { ...d, temporal_lock: true, lock_timestamp: new Date().toISOString() };
            }
            return d;
        });

        atomicWrite(DOCKETS_FILE, updatedDockets);
        logToFlightRecorder(`DOCKET LOCKED: ${docket_id} [WORM SIMULATION ACTIVE]`, 'IMPORTANT');
        res.json({ success: true, status: 'LOCKED' });
    } catch (e) {
        logToFlightRecorder(`Locking failed for ${docket_id}: ${e.message}`, 'ERROR');
        res.status(500).json({ error: "System failure during temporal locking" });
    }
});

app.get('/api/projection/anonymize', (req, res) => {
    const { docket_id } = req.query;
    if (!docket_id) return res.status(400).json({ error: "No docket_id provided" });

    try {
        const evidence = JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf8'));
        const filtered = evidence.filter(e => e.docket_id === docket_id || e.global);

        // PII Masking Logic
        const anonymized = filtered.map(e => {
            const masked = { ...e };
            // Obscure names to initials
            if (masked.custodian) {
                masked.custodian = masked.custodian.split(' ').map(n => n[0]).join('') + '.';
            }
            // Obscure email local parts
            if (masked.source && masked.source.includes('@')) {
                masked.source = 'PROJECTION_SOURCE@' + masked.source.split('@')[1];
            }
            // Strip any raw text that might contain high-risk PII, leave only analysis
            delete masked.raw_body;
            return masked;
        });

        res.json(anonymized);
    } catch (e) {
        res.status(500).json({ error: "Anonymization engine fault" });
    }
});

// --- END PHASE 77 BACKEND ---
        } catch (e) {
    res.status(500).json({ error: "Failed to parse email ingress" });
}
    });
});

app.post('/api/decisions/resolve', (req, res) => {
    const { itemId, decision, docketId } = req.body;
    // Decision logic: if 'PROMOTE', add docketId to item metadata in intelligence.json
    try {
        const intel = JSON.parse(fs.readFileSync(INTELLIGENCE_FILE, 'utf8'));
        const index = intel.findIndex(i => i.id === itemId);
        if (index !== -1) {
            if (decision === 'PROMOTE') {
                intel[index].docket_id = docketId;
                intel[index].status = 'vault';
            } else {
                intel[index].status = 'rejected';
            }
            fs.writeFileSync(INTELLIGENCE_FILE, JSON.stringify(intel, null, 4));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bodies are now parsed at the top

// --- DOCKET MANAGEMENT ---
app.get('/api/dockets', (req, res) => {
    try {
        if (fs.existsSync(DOCKETS_FILE)) {
            res.json(JSON.parse(fs.readFileSync(DOCKETS_FILE, 'utf8')));
        } else {
            res.json([]);
        }
    } catch (e) { res.status(500).json({ error: "Failed to load dockets" }); }
});

app.post('/api/dockets', (req, res) => {
    const { title, classification, linked_accounts } = req.body;
    exec(`python3 scripts/docket_manager.py create "${title}" "${classification}"`, (err, stdout) => {
        if (err) return res.status(500).json({ error: err.message });
        try {
            res.json(JSON.parse(stdout));
        } catch (e) { res.status(500).json({ error: "Invalid response from docket manager" }); }
    });
});

// --- SOVEREIGN INBOX (H1) ---
app.get('/api/inbox', async (req, res) => {
    // Aggregates data from connected accounts
    // For now, reads the existing email vault but pre-filters for 'legal' status
    const PROCESSED_EMAILS = path.join(PROCESSED_DIR, 'emails');
    try {
        if (!fs.existsSync(PROCESSED_EMAILS)) return res.json([]);
        const files = fs.readdirSync(PROCESSED_EMAILS).filter(f => f.endsWith('.md'));
        const emails = files.map(f => {
            const content = fs.readFileSync(path.join(PROCESSED_EMAILS, f), 'utf8');
            const lines = content.split('\n');
            const meta = {};
            lines.slice(1, 10).forEach(l => {
                if (l.includes(':')) {
                    const [k, v] = l.split(':');
                    meta[k.trim()] = v.trim();
                }
            });
            return { id: f, ...meta };
        });
        res.json(emails);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- LEXICON & EGRESS ---
app.get('/api/lexicon', (req, res) => {
    if (fs.existsSync(LEXICON_FILE)) {
        res.json(JSON.parse(fs.readFileSync(LEXICON_FILE, 'utf8')));
    } else {
        res.json({ tags: ["DRAFT", "CERTIFIED", "SUBMITTED", "IMPEACHMENT", "SETTLEMENT"] });
    }
});

app.post('/api/reports/egress', (req, res) => {
    const { reportId, status, docketId } = req.body;
    const reportPath = path.join(REPORTS_DIR, `${reportId}.md`);
    if (!fs.existsSync(reportPath)) return res.status(404).send("Report not found");

    try {
        const content = fs.readFileSync(reportPath, 'utf8');
        // Add egress metadata to markdown frontmatter
        const updated = content.replace(/Generated on: .*/, (match) =>
            `${match}\nEgress Status: ${status}\nDocket ID: ${docketId}`);
        fs.writeFileSync(reportPath, updated);
        res.json({ success: true, status });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- HUMAN-IN-THE-LOOP CORRECTIONS ---
app.get('/api/corrections', (req, res) => {
    try {
        if (fs.existsSync(CORRECTIONS_FILE)) {
            res.json(JSON.parse(fs.readFileSync(CORRECTIONS_FILE, 'utf8')));
        } else {
            res.json([]);
        }
    } catch (e) { res.status(500).json({ error: "Read failed" }); }
});

// --- FORENSIC AUDIT LOGGING ---
app.post('/api/audit/log', (req, res) => {
    const { docketId, action, details, actor = "SYSTEM" } = req.body;
    if (!docketId) return res.status(400).json({ error: "docketId required for forensic audit" });

    const auditFile = path.join(DOCKETS_DIR, docketId, 'forensic_audit.json');
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            actor,
            action,
            details
        };
        let logs = [];
        if (fs.existsSync(auditFile)) {
            logs = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
        }
        logs.push(logEntry);
        fs.writeFileSync(auditFile, JSON.stringify(logs, null, 4));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- HARDENED SEARCH ISOLATION ---
app.get('/api/search', (req, res) => {
    const { query, docket_id } = req.query;
    if (!docket_id) return res.status(400).json({ error: "Forensic Isolation: docket_id is mandatory for search" });

    try {
        // Enforce zero-leak by strictly reading from the docket's processed directory or filtered intelligence
        const intel = JSON.parse(fs.readFileSync(INTELLIGENCE_FILE, 'utf8'));
        const filtered = intel.filter(i =>
            i.docket_id === docket_id &&
            (i.content?.toLowerCase().includes(query.toLowerCase()) ||
                i.title?.toLowerCase().includes(query.toLowerCase()))
        );
        res.json(filtered);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/corrections', (req, res) => {
    const correction = req.body; // e.g. { type: 'IDENTITY', sourceId: '...', overrideName: '...' }
    try {
        let corrections = [];
        if (fs.existsSync(CORRECTIONS_FILE)) {
            corrections = JSON.parse(fs.readFileSync(CORRECTIONS_FILE, 'utf8'));
        }
        // Update existing or add new
        const idx = corrections.findIndex(c => c.sourceId === correction.sourceId && c.type === correction.type);
        if (idx !== -1) corrections[idx] = correction;
        else corrections.push(correction);

        atomicWrite(CORRECTIONS_FILE, corrections);
        logToFlightRecorder(`Correction Registered: ${correction.type} for ${correction.sourceId}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/discovery/generate-bundle', (req, res) => {
    logToFlightRecorder("Manual Discovery Bundle Generation Triggered");
    exec('python3 scripts/discovery_bundler.py', (err, stdout, stderr) => {
        if (err) {
            logToFlightRecorder(`Bundle Failed: ${stderr}`, 'CRITICAL');
            return res.status(500).json({ error: stderr });
        }
        const match = stdout.match(/Bundle Created: (.*)/);
        if (match) {
            logToFlightRecorder(`Bundle Ready: ${match[1]}`);
            res.json({ success: true, bundle: match[1] });
        } else {
            res.status(500).json({ error: 'Failed to parse bundler output' });
        }
    });
});

app.get('/api/discovery/download/:name', (req, res) => {
    const filePath = path.join(METADATA_DIR, 'exports', req.params.name);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send("File not found");
    }
});

// --- COMMAND BUS (SSE) ---
// Consolidated with REAL-TIME BROADCAST ENGINE above

// app.get('/api/stream/events' moved to consolidate with broadcast engine

// Continuous Heartbeat Loop (5s)
setInterval(() => {
    const stats = fs.statfsSync(__dirname);
    const freeSpaceMB = (stats.bavail * stats.bsize) / (1024 * 1024);

    broadcast({
        type: 'heartbeat',
        status: freeSpaceMB < 500 ? 'AIR_LOCK' : 'ACTIVE',
        freeSpaceMB: freeSpaceMB,
        integrity: 'HEALTHY' // TODO: Pull from latest integrity scan
    });
}, 5000);

// Wrap flight recorder to broadcast as well
const originalLog = logToFlightRecorder;
const logToFlightRecorderFinal = (msg, level = 'INFO') => {
    originalLog(msg, level);
    broadcast({ type: 'log', message: `[${level}] ${msg}` });
};
const logToFlightRecorderScoped = logToFlightRecorderFinal;

// Production Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        storage: {
            raw: fs.readdirSync(RAW_DIR).length,
            processed: fs.readdirSync(PROCESSED_DIR).length
        }
    });
});


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

// Deposition Live Ingest (Sprint 2)
app.post('/api/deposition/ingest', (req, res) => {
    const { statement } = req.body;
    if (!statement) return res.status(400).json({ error: "Missing statement" });

    // Execute tactical feedback script with safe arguments
    execHardened('scripts/live_depo_feedback.py', [statement], "Tactical", (err, stdout) => {
        if (!err && stdout) {
            try {
                const results = JSON.parse(stdout);
                if (results.status === 'IMPEACHMENT_ALERT') {
                    broadcast({ type: 'TACTICAL_ALERT', ...results });
                }
            } catch (e) {
                logToFlightRecorderScoped(`Failed to parse tactical response: ${e.message}`, 'ERROR');
            }
        }
    });

    res.json({ success: true, timestamp: new Date().toISOString() });
});

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
    try {
        atomicWrite(GOVERNANCE_FILE, req.body);
        res.send({ status: "Governance updated" });
    } catch (e) {
        res.status(500).send(`Governance save failed: ${e.message}`);
    }
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

        try {
            atomicWrite(ARGUMENTS_FILE, args);
            res.send({ status: "Argument saved", argument: newArg });
        } catch (e) {
            res.status(500).send(`Save failed: ${e.message}`);
        }
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
        const prompt = `You are a senior paralegal assisting Chris Hallberg in a complex Saskatchewan divorce discovery process, intertwined with Canadian Disability Law and an SGI (Saskatchewan Government Insurance) motor vehicle accident claim.
Generate a concise, professional Legal Memo reflecting these jurisdictional realities for the following strategic argument:

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

    const analysisPrompt = `You are a legal strategist specializing in Saskatchewan Family Law and Canadian Disability Law. Analyze the following bundle of ${items.length} evidence items. 
    Synthesize them into a cohesive strategic argument reflecting Saskatchewan jurisdictional standards. Identify the core leverage point, potential counter-arguments, and recommended next steps for legal counsel.
    
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

app.get('/api/wargame', (req, res) => {
    if (!fs.existsSync(WARGAME_RESULTS)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(WARGAME_RESULTS, 'utf8')));
});

app.get('/api/settlement', (req, res) => {
    if (!fs.existsSync(SETTLEMENT_REPORT)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(SETTLEMENT_REPORT, 'utf8')));
});

// === Phase 70.5: Strategic Sandbox Interactive Endpoints ===

// Interactive War Room Probe
app.post('/api/wargame/probe', async (req, res) => {
    const { scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: 'Scenario required' });

    console.log(`[WAR ROOM] Probing scenario: ${scenario}`);
    try {
        // Dynamic Scenario Analysis Logic (v8.4.0)
        // Heuristic-based adversarial generator for the sandbox
        const response = {
            title: "DYNAMIC SCENARIO ANALYSIS",
            adversarial_points: [
                `SGI likely argues: "${scenario}" contradicts documented evidence in collision reports.`,
                "Position: The claimant's memory of events is clouded by trauma/bias."
            ],
            counter_narratives: [
                "Defense: The physical laws of the collision (momentum/impact) override contradictory witness recall.",
                "Tactical Pivot: Shift focus to the engineering reconstruction metadata."
            ],
            timestamp: new Date().toISOString()
        };
        res.json(response);
    } catch (e) { res.status(500).json({ error: 'Probe failed' }); }
});

// Settlement Simulation (Dynamic Tuning)
app.post('/api/settlement/simulate', (req, res) => {
    const { modifiers } = req.body || {};
    const baseScale = 33000; // Base non-pecuniary value scale

    // Multiplier logic for user-defined severity factors
    let multiplier = 1.0;
    if (modifiers.lifestyle) multiplier += 0.2;
    if (modifiers.pain) multiplier += 0.3;
    if (modifiers.psychological) multiplier += 0.15;
    if (modifiers.mobility) multiplier += 0.25;

    const min = Math.round(baseScale * multiplier * 0.5);
    const max = Math.round(baseScale * multiplier * 1.5);

    res.json({
        projections: {
            non_pecuniary_min: min,
            non_pecuniary_max: max,
            currency: "CAD",
            note: "SIMULATED VALUATION (USER MODIFIED)",
            modifiers: modifiers
        },
        aggregate_severity: multiplier > 1.6 ? "High" : "Moderate",
        icd_diagnostic_weight: (multiplier * 2.5).toFixed(2)
    });
});

app.post('/api/export/tactical-brief', (req, res) => {
    const { selectedWargames, simulationData } = req.body || {};
    const wargame = fs.existsSync(WARGAME_RESULTS) ? JSON.parse(fs.readFileSync(WARGAME_RESULTS, 'utf8')) : {};
    const settlement = simulationData || (fs.existsSync(SETTLEMENT_REPORT) ? JSON.parse(fs.readFileSync(SETTLEMENT_REPORT, 'utf8')) : {});

    let brief = `# SGI ARBITRATION TACTICAL BRIEF (CURATED)\n`;
    brief += `Generated: ${new Date().toLocaleString()}\n`;
    brief += `Case: SGI-ARB-2026 | Claim: 16-892471\n\n`;

    brief += `## 1. Settlement Valuation (Interactive Export)\n`;
    if (settlement.projections) {
        brief += `- Range: ${settlement.projections.non_pecuniary_min.toLocaleString()} - ${settlement.projections.non_pecuniary_max.toLocaleString()} ${settlement.projections.currency}\n`;
        brief += `- Basis: ${settlement.projections.note}\n`;
        brief += `- Severity: ${settlement.aggregate_severity}\n\n`;
    }

    brief += `## 2. Adversarial Wargaming & Selected Defenses\n`;

    const targets = selectedWargames && selectedWargames.length > 0
        ? Object.values(wargame).filter(w => selectedWargames.includes(w.title))
        : Object.values(wargame);

    targets.forEach(w => {
        brief += `### ${w.title}\n`;
        brief += `**Adversarial Threat:**\n- ${w.adversarial_points.join('\n- ')}\n`;
        brief += `**Counter-Narrative:**\n- ${w.counter_narratives.join('\n- ')}\n\n`;
    });

    const exportPath = path.join(METADATA_DIR, 'exports', `Brief_SGI_${Date.now()}.md`);
    if (!fs.existsSync(path.join(METADATA_DIR, 'exports'))) fs.mkdirSync(path.join(METADATA_DIR, 'exports'));
    fs.writeFileSync(exportPath, brief);

    res.json({ success: true, path: exportPath });
});

app.post('/api/intelligence/analyze', async (req, res) => {
    const { itemId, path: itemPath, model } = req.body;
    const fullPath = path.join(PROCESSED_DIR, itemPath);

    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Item not found" });

    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const prompt = `You are a specialized legal assistant in Saskatchewan Family Law and SGI claims. Analyze this piece of legal evidence. 
        Extract:
        1. A concise 1-sentence summary interpreting the interaction through the lens of Saskatchewan legal frameworks.
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

app.get('/api/analytics/temporal-pulse', (req, res) => {
    try {
        if (!fs.existsSync(METADATA_FILE)) return res.json({});
        const index = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));

        // Group by Day and Hour to detect "Bursts" of activity
        const pulse = {};

        index.forEach(node => {
            const date = new Date(node.timestamp);
            if (isNaN(date.getTime())) return;

            const dayKey = date.toISOString().split('T')[0];
            const hour = date.getHours();

            if (!pulse[dayKey]) pulse[dayKey] = Array(24).fill(0).map(() => ({ count: 0, types: {} }));

            pulse[dayKey][hour].count++;
            pulse[dayKey][hour].types[node.type] = (pulse[dayKey][hour].types[node.type] || 0) + 1;
        });

        res.json(pulse);
    } catch (err) {
        console.error("Pulse calculation failed:", err);
        res.status(500).json({ error: "Pulse calculation failed" });
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

        const narrativePrompt = `You are a Senior Legal Analyst specialized in Saskatchewan Family Law, SGI claims, and Canadian Disability Law. 
        Synthesize a chronological "Executive Narrative" of the case focusing on intersections between the divorce, SGI accident, and disability timelines based on these evidence records. 
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

app.post('/api/audit/discrepancies', async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || items.length === 0) {
            return res.json({ success: true, discrepancies: 'Not enough chronological data points to detect contradictions.' });
        }

        let promptLines = [
            "Analyze the following list of chronological statements/events and specifically hunt for explicit contradictions, timeline overlaps, or behavioral discrepancies between the entities.",
            "Cross-reference 'Party A' vs 'Party B' claims where available. Format your findings strictly into bullet points marking any detected lies or inconsistencies:\n"
        ];

        items.forEach((item, idx) => {
            const dateStr = item.date || 'Unknown Date';
            const context = item.content || item.summary || item.text || 'No data';
            promptLines.push(`[Event ${idx + 1} (${dateStr})]: ${context}`);
        });

        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3.1:8b', // Enforce local privacy layer
            prompt: promptLines.join('\n'),
            stream: false,
            options: { temperature: 0.1 } // Very low temp for strict truth evaluation
        }, { timeout: 120000 });

        res.json({ success: true, discrepancies: response.data.response });
    } catch (e) {
        console.error("Discrepancy audit failed", e);
        res.status(500).json({ error: "Audit logic failure" });
    }
});


app.post('/api/strategy/build-chronology', (req, res) => {
    exec('python3 scripts/chronology_architect.py', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        const match = stdout.match(/Chronology Created: (.*?\.md)/);
        if (match) {
            res.json({ success: true, path: match[1] });
        } else {
            res.status(500).json({ error: "Failed to generate chronology" });
        }
    });
});

app.post('/api/strategy/narrative-audit', (req, res) => {
    exec('python3 scripts/narrative_auditor.py', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        const match = stdout.match(/Audit Complete: (.*?\.md)/);
        if (match) {
            res.json({ success: true, path: match[1] });
        } else {
            res.status(500).json({ error: "Failed to generate audit" });
        }
    });
});

app.post('/api/export/discovery-bundle', (req, res) => {
    // Phase 56: Hardened Recursive Discovery Bundling
    execHardened('python3 scripts/discovery_bundler.py', "Discovery_Bundler", (err, stdout) => {
        if (err) return res.status(500).json({ error: "Failed to generate judicial discovery bundle" });
        const match = stdout.match(/Bundle Created: (trial_discovery_.*?\.zip)/);
        if (match) {
            res.json({ filename: match[1], url: `/api/export/download/${match[1]}` });
        } else {
            res.status(500).json({ error: "Metadata handshake failed during bundling" });
        }
    });
});

app.post('/api/export/trial-binder', (req, res) => {
    // Phase 28: Trial Binder consolidates strategic exports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportsDir = path.join(__dirname, 'metadata/exports');
    const binderName = `trial_binder_${timestamp}.zip`;

    // Package all latest MD reports into a single binder
    const cmd = `cd "${exportsDir}" && zip "${binderName}" *.md`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json({ filename: binderName, url: `/api/exports/${binderName}` });
    });
});

app.post('/api/analyze-cross-domain', (req, res) => {
    // Phase 29: Cross-Domain Intelligence
    exec('python3 scripts/domain_cross_checker.py', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json(JSON.parse(stdout));
    });
});

app.post('/api/financial/forensic-ledger', (req, res) => {
    // Phase 29: Financial Forensic Hardening
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ledgerFile = `forensic_ledger_${timestamp}.csv`;
    const exportsDir = path.join(__dirname, 'metadata/exports');

    // Command to generate CSV from index (categorized expenses)
    const cmd = `python3 -c "import json; idx=json.load(open('metadata/index.json')); csv='Date,Desc,Amount,Category,Flag\\n'; [csv.format(d=e.get('date',''), s=e.get('title',''), a=e.get('amount','0'), c=e.get('category','OTHER'), f=e.get('flag','')) for e in idx if e.get('category')]; open('${path.join(exportsDir, ledgerFile)}','w').write(csv)"`;

    exec(cmd, (error) => {
        if (error) return res.status(500).json({ error: "Failed to generate CSV ledger" });
        res.json({ filename: ledgerFile, url: `/api/exports/${ledgerFile}` });
    });
});

app.post('/api/strategist/synthesize', async (req, res) => {
    const { fact, context, strategyId } = req.body;
    const payload = JSON.stringify({ fact, context, strategyId });
    const cmd = `python3 scripts/strategist.py '${payload.replace(/'/g, "'\\''")}'`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Strategist Error: ${stderr}`);
            return res.status(500).json({ error: 'AI Synthesis failed' });
        }
        res.json({ draft: stdout.trim() });
    });
});

app.post('/api/live/testimony-monitor', (req, res) => {
    // Phase 35: Live Deposition Feedback
    const { statement } = req.body;
    const cmd = `python3 scripts/live_depo_feedback.py "${statement}"`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json(JSON.parse(stdout));
    });
});

app.get('/api/strategy/judicial-profiles', (req, res) => {
    // Phase 35: Judicial Predisposition
    const profilesPath = path.join(__dirname, 'metadata/legal_kb/judicial_profiles/sask_judges.json');
    if (fs.existsSync(profilesPath)) {
        res.json(JSON.parse(fs.readFileSync(profilesPath)));
    } else {
        res.json([]);
    }
});

app.post('/api/strategy/lkb-ingest', (req, res) => {
    // Phase 33: Legal Knowledge Base
    const { filePath, type } = req.body;
    const cmd = `python3 scripts/lkb_ingestor.py "${filePath}" "${type}"`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json({ result: stdout.trim() });
    });
});

app.get('/api/strategy/match-precedent', (req, res) => {
    // Phase 33: Precedent Matching
    exec('python3 scripts/case_matcher.py', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json(JSON.parse(stdout));
    });
});

app.get('/api/strategy/opposition-playbook', (req, res) => {
    // Phase 34: Opposition Playmaker
    exec('python3 scripts/opposition_playmaker.py', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json(JSON.parse(stdout));
    });
});

app.post('/api/strategy/draft-proposal', (req, res) => {
    // Phase 34: Settlement Drafter
    const { simulationData } = req.body;
    const cmd = `python3 scripts/settlement_drafter.py '${JSON.stringify(simulationData)}'`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json({ result: stdout.trim() });
    });
});

app.get('/api/reports/client-snapshot', (req, res) => {
    // Phase 38: Client Reporting
    exec('python3 scripts/client_reporter.py', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json({ result: stdout.trim() });
    });
});

app.post('/api/financial/generate-13-1', (req, res) => {
    // Phase 49: Financial Forensic Intelligence
    execHardened('scripts/form_13_1_generator.py', [], "Form 13.1", (err, stdout) => {
        if (err) return res.status(500).json({ error: "Failed to generate Form 13.1 draft" });
        try {
            const results = JSON.parse(stdout);
            res.json(results);
        } catch (e) {
            res.status(500).json({ error: "Parser failure in generator" });
        }
    });
});

app.post('/api/forensics/financial/reconcile', (req, res) => {
    // Trigger financial_parser on all vault statements
    const p1 = path.join(__dirname, 'scripts/financial_parser.py');
    const indexFile = path.join(__dirname, 'metadata/index.json');

    if (!fs.existsSync(indexFile)) return res.json({ error: "Index missing" });

    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    const statements = index.filter(i => i.title.toLowerCase().includes('statement'));

    // In a production environment, we'd iterate and aggregate. 
    // Here we trigger the top-level form-13.1 generation logic which uses the parser internally.
    execHardened('scripts/form_13_1_generator.py', [], "Forensic Reconciliation", (err, stdout) => {
        if (err) return res.status(500).json({ error: "Reconciliation failed" });
        res.json(JSON.parse(stdout));
    });
});

app.post('/api/forensics/sgi/parse', (req, res) => {
    const { text } = req.body;
    // Save temp file for sgi_parser
    const tmpFile = path.join(__dirname, 'tmp_sgi.txt');
    fs.writeFileSync(tmpFile, text);

    execHardened(`scripts/sgi_parser.py "${tmpFile}"`, "SGI_Parser", (err, stdout) => {
        fs.unlinkSync(tmpFile);
        if (err) return res.status(500).json({ error: "SGI Extraction failed" });
        res.json(JSON.parse(stdout));
    });
});

app.post('/api/admin/perform-backup', (req, res) => {
    // Phase 36: Operational Resilience
    exec('python3 scripts/backup_manager.py', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json({ result: stdout.trim() });
    });
});

app.post('/api/admin/lockdown', (req, res) => {
    // Phase 36: Vault Encryption
    exec('python3 scripts/vault_crypt.py encrypt', (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: stderr });
        res.json({ result: stdout.trim() });
    });
});

app.post('/api/arguments/:id/anchor', (req, res) => {
    const argId = req.params.id;
    const { fact, sourceId, sourceTitle } = req.body;

    try {
        const argsData = JSON.parse(fs.readFileSync(ARGUMENTS_FILE, 'utf8'));
        const argIdx = argsData.findIndex(a => a.id === argId);

        if (argIdx !== -1) {
            if (!argsData[argIdx].anchoredFacts) argsData[argIdx].anchoredFacts = [];
            argsData[argIdx].anchoredFacts.push({
                fact,
                sourceId,
                sourceTitle,
                timestamp: new Date().toISOString()
            });
            fs.writeFileSync(ARGUMENTS_FILE, JSON.stringify(argsData, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Argument not found" });
        }
    } catch (e) {
        res.status(500).json({ error: "Failed to anchor fact" });
    }
});

app.post('/api/ingest/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = req.file.path;
    const fileName = req.file.originalname.toLowerCase();
    let scriptToRun = null;
    let component = "Ingest";
    let isFinancial = fileName.includes('statement') || fileName.includes('bank') || fileName.includes('transfers');

    if (filePath.endsWith('.mbox')) { scriptToRun = 'mbox_parser.py'; component = "MBOX_Parser"; }
    else if (filePath.endsWith('.xml')) { scriptToRun = 'sms_parser.py'; component = "SMS_Parser"; }
    else if (filePath.match(/\.(png|jpg|jpeg|pdf)$/i)) {
        // If financial, use the financial_parser via the intelligence orchestrator later
        scriptToRun = 'ocr_processor.py';
        component = "OCR_Processor";
    }

    if (scriptToRun) {
        execHardened(`python3 scripts/${scriptToRun} "${filePath}"`, component, (err, stdout) => {
            if (!err) broadcastLog({ timestamp: new Date().toISOString(), level: 'INFO', component, message: "Ingestion Success." });

            // Post-process logic for financial documents
            if (isFinancial && !err) {
                broadcastLog({ timestamp: new Date().toISOString(), level: 'INFO', component: 'Forensic_Engine', message: "Automated Financial Analysis Triggered..." });
                execHardened(`python3 scripts/financial_parser.py "${filePath}"`, "Financial_Parser", (fErr, fOutput) => {
                    if (!fErr) {
                        const fData = JSON.parse(fOutput);
                        // Store extracted financial metadata in the vault entry
                        // This is a placeholder for the batch-update logic
                    }
                });
            }
        });
    }

    res.json({ success: true, message: "File ingested and routed to Flight Recorder.", filename: req.file.originalname, isFinancial });
});

app.post('/api/intelligence/correlate', (req, res) => {
    // Phase 59: Trigger Semantic Correlation Engine
    broadcastLog({ timestamp: new Date().toISOString(), message: "FORENSIC: Semantic Correlation Engine started..." });

    execHardened('python3 scripts/correlation_engine.py', "CORRELATION_ENGINE", (err, stdout) => {
        if (err) return res.status(500).json({ error: "Correlation engine failed" });
        try {
            const patterns = JSON.parse(stdout);
            // Save patterns for UI consumption
            fs.writeFileSync(path.join(__dirname, 'metadata/correlation_patterns.json'), JSON.stringify(patterns, null, 2));
            res.json({ success: true, count: patterns.length });
        } catch (e) { res.status(500).json({ error: "Parse error in patterns" }); }
    });
});

app.get('/api/governance/jurisdiction', (req, res) => {
    try {
        const jmPath = path.join(__dirname, 'metadata/jurisdiction.json');
        let active = 'Ontario';
        if (fs.existsSync(jmPath)) {
            active = JSON.parse(fs.readFileSync(jmPath, 'utf8')).active;
        }
        res.json({ active });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/governance/jurisdiction', (req, res) => {
    const { jurisdiction } = req.body;
    try {
        const jmPath = path.join(__dirname, 'metadata/jurisdiction.json');
        fs.writeFileSync(jmPath, JSON.stringify({ active: jurisdiction }));
        logToFlightRecorder(`Jurisdiction switched to ${jurisdiction}`);
        res.json({ success: true, active: jurisdiction });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/dashboard/pulse', (req, res) => {
    try {
        const vault = JSON.parse(fs.readFileSync(VAULT_INDEX, 'utf8'));
        const args = JSON.parse(fs.readFileSync(ARGUMENTS_PATH, 'utf8'));

        const totalNodes = vault.length;
        const anchoredArgs = args.filter(a => (a.items || []).length > 0).length;
        const completion = Math.min(100, Math.floor((totalNodes / 200) * 100)); // Target 200 nodes

        res.json({
            discoveryProgress: completion,
            strategicReadiness: args.length > 0 ? Math.floor((anchoredArgs / args.length) * 100) : 0,
            activeAlerts: vault.filter(e => e.severity === 'high').length,
            systemHealth: 'OPTIMAL'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/forensics/reconcile', (req, res) => {
    // Phase: Core Forensic Hardening - Reconciliation
    const { disclosedAssets } = req.body; // Array of { name, value }
    try {
        const evidenceData = JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf8'));
        const financialRecords = evidenceData.filter(e => e.isFinancial || e.type === 'bank_statement');

        const discrepancies = disclosedAssets.map(disclosure => {
            // Find evidence matching the asset name (heuristic)
            const matches = financialRecords.filter(f => f.title?.toLowerCase().includes(disclosure.name.toLowerCase()));
            const verifiedValue = matches.reduce((sum, m) => sum + (m.extractedValue || 0), 0);

            return {
                asset: disclosure.name,
                disclosed: disclosure.value,
                verified: verifiedValue,
                delta: verifiedValue - disclosure.value,
                status: Math.abs(verifiedValue - disclosure.value) > 10 ? 'DISCREPANCY' : 'RECONCILED',
                evidenceIds: matches.map(m => m.id)
            };
        });

        res.json({ success: true, discrepancies });
    } catch (e) {
        res.status(500).json({ error: "Reconciliation failed" });
    }
});

app.get('/api/intelligence/cross-reference', (req, res) => {
    try {
        const evidenceData = JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf8'));
        const tips = [];

        // Level-1: Simple Keyword Correlation
        const financialKeywords = ['transaction', 'bank', 'transfer', 'payment', 'balance', 'account', 'wire'];
        evidenceData.forEach(item => {
            const hasKeyword = financialKeywords.some(kw =>
                (item.title?.toLowerCase().includes(kw)) ||
                (item.content?.toLowerCase().includes(kw))
            );
            if (hasKeyword) {
                tips.push({
                    type: 'FINANCIAL_CORRELATION',
                    severity: 'MEDIUM',
                    message: `Potential financial vector detected in ${item.type} record: "${item.title}"`,
                    evidenceId: item.id
                });
            }
        });

        // Level-2: Import Semantic Patterns
        const patternsPath = path.join(__dirname, 'metadata/correlation_patterns.json');
        if (fs.existsSync(patternsPath)) {
            const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
            patterns.forEach(p => {
                tips.push({
                    type: p.type,
                    severity: p.severity,
                    message: p.message,
                    ids: p.ids,
                    isPattern: true
                });
            });
        }

        res.json({ tips, count: tips.length });
    } catch (e) {
        res.status(500).json({ error: "Failed to generate intelligence tips" });
    }
});

app.get('/api/pulse', (req, res) => {
    // Phase 57: Real-time Synchronous Integrity Validation
    const vault = readVault();
    const brokenLinks = vault.filter(item => {
        if (!item.path) return false;
        const fullPath = path.join(__dirname, 'evidence/processed', item.path);
        return !fs.existsSync(fullPath);
    }).length;

    res.json({
        load: 5.2, // Simulated sensor data
        latency: '8ms',
        integrity: brokenLinks > 0 ? 'COMPROMISED' : 'HEALTHY',
        brokenLinks
    });
});

app.post('/api/evidence/batch-update', (req, res) => {
    const { ids, updates } = req.body;
    if (!ids || !updates) return res.status(400).json({ error: "Missing ids or updates" });

    try {
        const allowedFields = ['source', 'sourceId', 'type', 'status', 'tags'];
        const sanitizedUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                sanitizedUpdates[key] = updates[key];
            }
        });

        const vault = readVault();
        const updatedVault = vault.map(item => {
            if (ids.includes(item.id)) {
                return { ...item, ...sanitizedUpdates, lastModified: new Date().toISOString() };
            }
            return item;
        });
        writeVault(updatedVault);
        broadcastLog({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            component: 'VAULT_OPS',
            message: `Batch update successful for ${ids.length} items.`
        });
        res.json({ success: true, count: ids.length });
    } catch (e) {
        res.status(500).json({ error: "Batch update failed" });
    }
});

app.post('/api/evidence/batch-delete', (req, res) => {
    const { ids } = req.body;
    if (!ids) return res.status(400).json({ error: "Missing ids" });

    try {
        const vault = readVault();
        const filteredVault = vault.filter(item => !ids.includes(item.id));
        writeVault(filteredVault);
        broadcastLog({
            timestamp: new Date().toISOString(),
            level: 'WARNING',
            component: 'VAULT_OPS',
            message: `Batch delete successful for ${ids.length} items.`
        });
        res.json({ success: true, count: ids.length });
    } catch (e) {
        res.status(500).json({ error: "Batch delete failed" });
    }
});

app.post('/api/evidence/auto-classify', (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Invalid IDs" });

    const vault = readVault();
    const results = [];

    // Parallel execution for industrial throughput
    const tasks = ids.map(id => {
        const item = vault.find(i => i.id === id);
        if (!item || !item.path) return Promise.resolve();

        return new Promise((resolve) => {
            execHardened(`python3 scripts/intelligence_runner.py "${id}" "${item.path}"`, "AI_CLASSIFICATION", (err, stdout) => {
                if (err) {
                    console.error(`Classification failed for ${id}:`, err);
                    resolve();
                    return;
                }

                const match = stdout.match(/RESULT_JSON:(.*)/);
                if (match) {
                    try {
                        const ai = JSON.parse(match[1]);
                        results.push({ id, ai });
                    } catch (e) { console.error("Parse error", e); }
                }
                resolve();
            });
        });
    });

    Promise.all(tasks).then(() => {
        const updatedVault = vault.map(item => {
            const aiResult = results.find(r => r.id === item.id);
            if (aiResult) {
                return {
                    ...item,
                    type: aiResult.ai.type || item.type,
                    status: aiResult.ai.status || item.status,
                    aiConfidence: aiResult.ai.confidence || 0,
                    lastModified: new Date().toISOString()
                };
            }
            return item;
        });

        writeVault(updatedVault);
        broadcastLog({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            component: 'AI_SORT',
            message: `Auto-classification complete for ${results.length} items.`
        });

        res.json({ success: true, count: results.length });
    });
});

app.post('/api/reports/ledger', (req, res) => {
    // Phase 61: Forensic Ledger Generation
    const { reportId, linkedIds } = req.body;
    try {
        const vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
        const ledger = vault
            .filter(item => (linkedIds || []).includes(item.id))
            .map(item => ({
                bates: item.bates || 'N/A',
                title: item.title,
                source: item.source,
                timestamp: item.timestamp,
                digest: item.ai?.summary || 'No summary extracted.'
            }));

        res.json({ success: true, ledger });
    } catch (e) {
        res.status(500).json({ error: "Failed to generate forensic ledger" });
    }
});

app.post('/api/wargame/start', (req, res) => {
    const { vulnerabilityId } = req.body;
    try {
        const vault = JSON.parse(fs.readFileSync(VAULT_INDEX, 'utf8'));
        const vuln = vault.find(v => v.id === vulnerabilityId) || { id: 'GENERIC', message: 'General credibility check' };

        const { spawn } = require('child_process');
        const scriptPath = path.join(__dirname, 'scripts/intelligence_runner.py');
        const pythonProcess = spawn('python3', [scriptPath, 'wargame', JSON.stringify(vuln)]);

        let output = '';
        pythonProcess.stdout.on('data', (data) => output += data.toString());
        pythonProcess.on('close', (code) => {
            const match = output.match(/RESULT_JSON:(.*)/);
            if (match) {
                res.json({
                    success: true,
                    attackLines: JSON.parse(match[1]),
                    vulnerability: vuln
                });
            } else {
                res.status(500).json({ error: "Failed to initialize wargame" });
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/wargame/evaluate', (req, res) => {
    const { questions, response, strategy } = req.body;
    // Phase 65: Lightweight heuristic evaluation for tactical readiness
    const strength = response.length > 50 ? (response.includes('refer') ? 85 : 60) : 30;
    res.json({
        strength,
        feedback: strength > 70 ? "Strong response with evidentiary anchoring." : "Response lacks specific anchoring. Refer to Bates-stamped evidence.",
        suggestions: ["Anchor to Bates #023", "Maintain neutral tone", "Avoid defensive adjectives"]
    });
});

app.get('/api/forensics/sgi/brief', (req, res) => {
    // Phase 66: Forensic SGI Tactical Brief Synthesis
    try {
        const vault = readVault();
        const intelligence = JSON.parse(fs.readFileSync(INTELLIGENCE_FILE, 'utf8'));

        // Filter for arbitration-related evidence
        const arbitrationNodes = vault.filter(item => {
            const intel = intelligence[item.id];
            return (intel && (intel.type === 'ARBITRATION' || intel.arbitration_metadata?.claim_id === '16-892471')) ||
                (item.title && item.title.includes('2449 Eastview'));
        });

        const liabilityNodes = arbitrationNodes.filter(n => intelligence[n.id]?.flags?.includes('SGI LIABILITY'));

        res.json({
            success: true,
            claim_id: '16-892471',
            adjuster: 'Robert Henderson',
            incident_date: '2025-11-20',
            nodes: arbitrationNodes.map(n => ({
                id: n.id,
                title: n.title,
                timestamp: n.timestamp,
                summary: intelligence[n.id]?.summary,
                liability_flag: intelligence[n.id]?.flags?.includes('SGI LIABILITY')
            })),
            liability_strength: liabilityNodes.length > 0 ? (liabilityNodes.length >= 3 ? 'HIGH' : 'MODERATE') : 'LOW',
            synthesis_timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ error: "Failed to synthesize SGI brief" });
    }
});

app.post('/api/forensics/sgi/reindex', (req, res) => {
    // Force re-analysis of critical arbitration assets
    const CRITICAL_SGI_FILES = ['2449 Eastview - Saskatoon.pdf', '1000006202.png'];
    const vault = readVault();
    const targeted = vault.filter(v => CRITICAL_SGI_FILES.includes(v.path));

    // Trigger AI analysis for these IDs
    res.json({ success: true, targets: targeted.map(t => t.id) });
});

app.get('/api/forensics/sgi/metadata-verify', (req, res) => {
    const { id } = req.query;
    try {
        const vault = readVault();
        const item = vault.find(v => v.id === id);
        if (!item || !item.path) return res.status(404).json({ error: "Evidence not found" });

        const imagePath = path.join(__dirname, 'evidence/processed', item.path);
        execHardened(`python3 scripts/sgi_metadata_harvester.py "${imagePath}"`, "FORENSIC_METADATA", (err, stdout) => {
            if (err) return res.status(500).json({ error: "Forensic scan failed" });
            const match = stdout.match(/FORENSIC_RESULT:(.*)/);
            if (match) {
                res.json(JSON.parse(match[1]));
            } else {
                res.status(500).json({ error: "Failed to extract forensic metadata" });
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/health', (req, res) => {
    const scriptPath = path.join(__dirname, 'scripts/intelligence_runner.py');
    exec(`python3 "${scriptPath}" --ping`, (err, stdout) => {
        const stats = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            aiEngine: "offline",
            aiLock: "IDLE"
        };

        if (!err && stdout.includes("STATUS: ONLINE")) {
            stats.aiEngine = "online";
            if (stdout.includes("LOCK: ACTIVE")) stats.aiLock = "ACTIVE";
        }

        res.json(stats);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vault Backend running on http://localhost:${PORT}`);
});
